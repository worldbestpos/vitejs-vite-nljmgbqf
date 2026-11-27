import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import './PlatformOwnerDashboard.css';

const PERMISSIONS = [
  ['products.manage', 'Manage products and categories'], ['inventory.manage', 'Manage inventory and stock'],
  ['sales.create', 'Create sales'], ['sales.manage', 'Manage and edit sales'],
  ['purchases.manage', 'Manage purchases'], ['customers.manage', 'Manage customers'],
  ['suppliers.manage', 'Manage suppliers'], ['expenses.manage', 'Manage expenses'],
  ['credit.manage', 'Manage debit and credit'], ['settings.manage', 'Manage shop settings'],
  ['audit.view', 'View activity logs'], ['audit.manage', 'Manage activity logs'], ['reports.view', 'View reports'],
] as const;

type Branch = { id: string; branch_name: string; branch_code: string };
type Member = { company_id: string; user_id: string; role: string; is_active: boolean };
type Profile = { id: string; full_name: string | null; phone: string | null };

export default function ShopStaffManager({ companyId }: { companyId: string }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [branchId, setBranchId] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('cashier');
  const [permissions, setPermissions] = useState<string[]>(['sales.create']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    const [{ data: branchRows, error: branchError }, { data: memberRows, error: memberError }] = await Promise.all([
      supabase.from('branches').select('id,branch_name,branch_code').eq('company_id', companyId).eq('is_active', true).order('is_head_office', { ascending: false }),
      supabase.from('company_members').select('company_id,user_id,role,is_active').eq('company_id', companyId).order('created_at', { ascending: true }),
    ]);
    if (branchError || memberError) { setError(branchError?.message ?? memberError?.message ?? 'Could not load staff.'); setLoading(false); return; }
    const branchList = (branchRows ?? []) as Branch[];
    const memberList = (memberRows ?? []) as Member[];
    setBranches(branchList); setBranchId(current => branchList.some(item => item.id === current) ? current : (branchList[0]?.id ?? ''));
    setMembers(memberList);
    if (memberList.length) {
      const { data: profileRows, error: profileError } = await supabase.from('profiles').select('id,full_name,phone').in('id', memberList.map(item => item.user_id));
      if (profileError) setError(profileError.message);
      const map: Record<string, Profile> = {};
      (profileRows ?? []).forEach((profile: Profile) => { map[profile.id] = profile; });
      setProfiles(map);
    } else setProfiles({});
    setLoading(false);
  }

  useEffect(() => { void load(); }, [companyId]);

  async function invite(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('invite-shop-member', {
        body: { company_id: companyId, branch_id: branchId, email, full_name: fullName, role, permissions },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNotice(`Invitation sent to ${email}. They can set their password from the email link.`);
      setEmail(''); setFullName(''); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send invitation.'); }
    finally { setSaving(false); }
  }

  function toggle(permission: string) {
    setPermissions(current => current.includes(permission) ? current.filter(item => item !== permission) : [...current, permission]);
  }

  return <div className="platform-page">
    <section className="platform-section-head"><div><span className="platform-eyebrow">SHOP TEAM</span><h2>Staff & Permissions</h2><p>Create staff logins and choose exactly which POS features each person can access.</p></div></section>
    {error && <div className="platform-alert error">{error}</div>}{notice && <div className="platform-alert success">{notice}</div>}
    <section className="platform-panel"><div className="platform-panel-title"><div><h3>Current shop users</h3><p>Users assigned to this shop.</p></div><span className="platform-member-count">{members.length} members</span></div>
      {loading ? <p className="platform-muted">Loading staff…</p> : <div className="platform-member-list">{members.map(member => <div className="platform-member-row" key={member.user_id}><div className="platform-member-avatar">{(profiles[member.user_id]?.full_name || member.user_id).slice(0,1).toUpperCase()}</div><div className="platform-member-copy"><strong>{profiles[member.user_id]?.full_name || 'Shop user'}</strong><small>{profiles[member.user_id]?.phone || `Account ID: ${member.user_id.slice(0,8)}…`}</small></div><span className="platform-role-pill">{member.role.replace('_',' ')}</span><span className={`platform-member-state ${member.is_active ? 'active' : 'inactive'}`}>{member.is_active ? 'Active' : 'Disabled'}</span></div>)}{!members.length && <p className="platform-muted">No users assigned yet.</p>}</div>}
    </section>
    <form className="platform-panel platform-invite-form" onSubmit={invite}><div><span className="platform-eyebrow">ADD TO YOUR TEAM</span><h3>Invite staff member</h3><p className="platform-muted">We will email an invitation link so each staff member can set their own password.</p></div>
      <div className="platform-form-grid"><label>Full name<input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Staff name" /></label><label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@example.com" /></label><label>Branch<select required value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.branch_name} ({branch.branch_code})</option>)}</select></label><label>Role<select value={role} onChange={e => { const next=e.target.value; setRole(next); setPermissions(next==='manager' ? PERMISSIONS.map(item=>item[0]) : next==='cashier' ? ['sales.create'] : next==='stock_manager' ? ['inventory.manage','products.manage'] : next==='accountant' ? ['purchases.manage','expenses.manage','credit.manage','reports.view'] : []); }}><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="stock_manager">Stock manager</option><option value="accountant">Accountant</option><option value="custom">Custom role</option></select></label></div>
      <div className="platform-permissions"><strong>Permissions</strong><div className="platform-permission-grid">{PERMISSIONS.map(([key,label])=><label className="platform-check" key={key}><input type="checkbox" checked={permissions.includes(key)} onChange={()=>toggle(key)} />{label}</label>)}</div></div>
      <button className="platform-primary-button" disabled={saving || loading || !branchId}>{saving ? 'Sending invitation…' : 'Send staff invitation'}</button>
    </form>
  </div>;
}

