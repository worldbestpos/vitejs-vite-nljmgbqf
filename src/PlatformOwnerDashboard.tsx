import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import './PlatformOwnerDashboard.css';

type Shop = {
  id: string;
  company_name: string;
  currency: string;
  default_language: string;
  created_at: string;
  logo_url: string | null;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  status: 'active' | 'suspended' | 'trial';
  plan_name: string;
};

type ShopStats = {
  company_id: string;
  sales_count: number;
  sales_total: number;
  purchases_count: number;
  purchases_total: number;
  expenses_total: number;
  products_count: number;
  customers_count: number;
};

type Member = { company_id: string; user_id: string; role: string; is_active: boolean };
type Profile = { id: string; full_name: string | null; phone: string | null };
type Branch = { id: string; branch_name: string; branch_code: string };

const PERMISSIONS = [
  ['products.manage', 'Manage products and categories'],
  ['inventory.manage', 'Manage inventory and stock'],
  ['sales.create', 'Create sales'],
  ['sales.manage', 'Manage and edit sales'],
  ['purchases.manage', 'Manage purchases'],
  ['customers.manage', 'Manage customers'],
  ['suppliers.manage', 'Manage suppliers'],
  ['expenses.manage', 'Manage expenses'],
  ['credit.manage', 'Manage debit and credit'],
  ['settings.manage', 'Manage shop settings'],
  ['audit.view', 'View activity logs'],
  ['audit.manage', 'Manage activity logs'],
  ['reports.view', 'View reports'],
] as const;

const emptyShopForm = {
  company_name: '', owner_name: '', owner_email: '', branch_name: 'Head Office',
  branch_code: 'HQ', currency: 'NPR', phone: '', address: '',
};

const money = (value: number, currency = 'NPR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export default function PlatformOwnerDashboard({
  userEmail,
  onOpenShop,
}: {
  userEmail: string;
  onOpenShop: (companyId: string) => void;
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [stats, setStats] = useState<ShopStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyShopForm);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Shop>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('cashier');
  const [staffPermissions, setStaffPermissions] = useState<string[]>(['sales.create']);

  const selectedShop = shops.find(shop => shop.id === selectedId) ?? null;
  const selectedStats = stats.find(item => item.company_id === selectedId);
  const totalSalesCount = useMemo(() => stats.reduce((sum, item) => sum + Number(item.sales_count || 0), 0), [stats]);
  const totalPurchasesCount = useMemo(() => stats.reduce((sum, item) => sum + Number(item.purchases_count || 0), 0), [stats]);
  const totalProducts = useMemo(() => stats.reduce((sum, item) => sum + Number(item.products_count || 0), 0), [stats]);
  const totalCustomers = useMemo(() => stats.reduce((sum, item) => sum + Number(item.customers_count || 0), 0), [stats]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: companyRows, error: companyError }, { data: summaryRows, error: summaryError }] = await Promise.all([
        supabase.from('companies')
          .select('id,company_name,currency,default_language,created_at,logo_url,contact_email,phone,address,website,status,plan_name')
          .order('created_at', { ascending: false }),
        supabase.rpc('platform_shop_summary'),
      ]);
      if (companyError) throw companyError;
      if (summaryError) throw summaryError;
      const loadedShops = (companyRows ?? []) as Shop[];
      setShops(loadedShops);
      setStats((summaryRows ?? []) as ShopStats[]);
      setSelectedId(current => current && loadedShops.some(shop => shop.id === current) ? current : (loadedShops[0]?.id ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load platform data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!selectedShop) {
      setBranches([]); setMembers([]); setProfiles({}); setSelectedBranch('');
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: branchRows, error: branchError }, { data: memberRows, error: memberError }] = await Promise.all([
        supabase.from('branches').select('id,branch_name,branch_code').eq('company_id', selectedShop.id).eq('is_active', true).order('is_head_office', { ascending: false }),
        supabase.from('company_members').select('company_id,user_id,role,is_active').eq('company_id', selectedShop.id).order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      if (branchError || memberError) {
        setError(branchError?.message ?? memberError?.message ?? 'Could not load shop members.');
        return;
      }
      const loadedBranches = (branchRows ?? []) as Branch[];
      const loadedMembers = (memberRows ?? []) as Member[];
      setBranches(loadedBranches);
      setSelectedBranch(current => loadedBranches.some(branch => branch.id === current) ? current : (loadedBranches[0]?.id ?? ''));
      setMembers(loadedMembers);
      if (loadedMembers.length) {
        const { data: profileRows } = await supabase.from('profiles').select('id,full_name,phone').in('id', loadedMembers.map(member => member.user_id));
        if (!cancelled) {
          const lookup: Record<string, Profile> = {};
          (profileRows ?? []).forEach((profile: Profile) => { lookup[profile.id] = profile; });
          setProfiles(lookup);
        }
      } else setProfiles({});
    })();
    return () => { cancelled = true; };
  }, [selectedShop?.id]);

  async function createShop(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-shop', { body: form });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNotice(data?.warning || `Shop created. An invitation has been sent to ${form.owner_email}.`);
      setForm(emptyShopForm);
      setShowCreate(false);
      await refresh();
      if (data?.company_id) setSelectedId(data.company_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create shop.');
    } finally { setSaving(false); }
  }

  function startEdit(shop: Shop) {
    setEditForm({ ...shop });
    setEditing(true);
    setNotice(''); setError('');
  }

  async function uploadShopLogo(file?: File) {
    if (!file || !selectedShop) return;
    setSaving(true); setError(''); setNotice('');
    try {
      if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Logo must be smaller than 5 MB.');
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${selectedShop.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('shop-logos').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('shop-logos').getPublicUrl(path);
      setEditForm(current => ({ ...current, logo_url: data.publicUrl }));
      setNotice('Logo uploaded. Click Save shop profile to apply it.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload logo.');
    } finally { setSaving(false); }
  }

  async function saveShop(event: FormEvent) {
    event.preventDefault();
    if (!selectedShop) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = {
        company_name: String(editForm.company_name ?? '').trim(),
        currency: String(editForm.currency ?? 'NPR').trim().toUpperCase(),
        logo_url: String(editForm.logo_url ?? '').trim() || null,
        contact_email: String(editForm.contact_email ?? '').trim() || null,
        phone: String(editForm.phone ?? '').trim() || null,
        address: String(editForm.address ?? '').trim() || null,
        website: String(editForm.website ?? '').trim() || null,
        status: editForm.status,
        plan_name: String(editForm.plan_name ?? 'standard').trim(),
        updated_at: new Date().toISOString(),
      };
      if (!payload.company_name) throw new Error('Shop name is required.');
      const { error: updateError } = await supabase.from('companies').update(payload).eq('id', selectedShop.id);
      if (updateError) throw updateError;
      setNotice('Shop profile updated successfully.');
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update shop profile.');
    } finally { setSaving(false); }
  }

  async function inviteStaff(event: FormEvent) {
    event.preventDefault();
    if (!selectedShop || !selectedBranch) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('invite-shop-member', {
        body: {
          company_id: selectedShop.id,
          branch_id: selectedBranch,
          email: staffEmail,
          full_name: staffName,
          role: staffRole,
          permissions: staffPermissions,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNotice(`Invitation sent to ${staffEmail}. They can set their password from the email link.`);
      setStaffEmail(''); setStaffName('');
      const { data: memberRows } = await supabase.from('company_members').select('company_id,user_id,role,is_active').eq('company_id', selectedShop.id);
      setMembers((memberRows ?? []) as Member[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite staff member.');
    } finally { setSaving(false); }
  }

  function togglePermission(permission: string) {
    setStaffPermissions(current => current.includes(permission)
      ? current.filter(item => item !== permission)
      : [...current, permission]);
  }

  return (
    <div className="platform-page">
      <header className="platform-header">
        <div className="platform-brand-mark">DR</div>
        <div className="platform-heading-copy">
          <span className="platform-eyebrow">D.R GLOBAL BUSINESS SUITE</span>
          <h1>Platform Owner</h1>
          <p>Manage every shop, its business profile, reports and staff access.</p>
        </div>
        <div className="platform-account"><span className="platform-live-dot" />{userEmail}</div>
      </header>

      {error && <div className="platform-alert error">{error}</div>}
      {notice && <div className="platform-alert success">{notice}</div>}

      <section className="platform-kpi-grid">
        <article className="platform-kpi purple"><span>Registered shops</span><strong>{shops.length}</strong><small>All businesses on your platform</small></article>
        <article className="platform-kpi blue"><span>Sales transactions</span><strong>{totalSalesCount.toLocaleString()}</strong><small>Across all shops</small></article>
        <article className="platform-kpi orange"><span>Purchase records</span><strong>{totalPurchasesCount.toLocaleString()}</strong><small>Across all shops</small></article>
        <article className="platform-kpi pink"><span>Products / customers</span><strong>{totalProducts.toLocaleString()} / {totalCustomers.toLocaleString()}</strong><small>Across all shops</small></article>
      </section>

      <section className="platform-section-head">
        <div><span className="platform-eyebrow">YOUR BUSINESS NETWORK</span><h2>All shops</h2><p>Each shop has separate products, customers, transactions and reports.</p></div>
        <button className="platform-primary-button" onClick={() => { setShowCreate(value => !value); setEditing(false); }}>＋ Create new shop</button>
      </section>

      {showCreate && (
        <form className="platform-panel platform-form" onSubmit={createShop}>
          <div className="platform-panel-title"><div><h3>Create a shop</h3><p>Set up its first branch and invite its shop admin.</p></div><button type="button" className="platform-quiet-button" onClick={() => setShowCreate(false)}>Close</button></div>
          <div className="platform-form-grid">
            <label>Shop / business name<input required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="Example: Shop A" /></label>
            <label>Shop admin full name<input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} placeholder="Admin name" /></label>
            <label>Shop admin email<input required type="email" value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })} placeholder="admin@example.com" /></label>
            <label>First branch name<input required value={form.branch_name} onChange={e => setForm({ ...form, branch_name: e.target.value })} /></label>
            <label>Branch code<input required value={form.branch_code} onChange={e => setForm({ ...form, branch_code: e.target.value })} /></label>
            <label>Currency<select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}><option value="NPR">NPR — Nepalese Rupee</option><option value="USD">USD — US Dollar</option><option value="INR">INR — Indian Rupee</option><option value="AED">AED — UAE Dirham</option></select></label>
            <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Shop phone" /></label>
            <label>Address<input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Shop address" /></label>
          </div>
          <div className="platform-form-actions"><button className="platform-primary-button" disabled={saving}>{saving ? 'Creating shop…' : 'Create shop and invite admin'}</button></div>
        </form>
      )}

      <section className="platform-shop-grid">
        {loading ? <div className="platform-panel platform-loading">Loading shop information…</div> : shops.length === 0 ? <div className="platform-panel platform-loading">No shops found yet. Create your first shop above.</div> : shops.map(shop => {
          const item = stats.find(stat => stat.company_id === shop.id);
          return <button key={shop.id} className={`platform-shop-card ${selectedId === shop.id ? 'selected' : ''}`} onClick={() => { setSelectedId(shop.id); setEditing(false); }}>
            <div className="platform-shop-card-top"><div className="platform-shop-logo">{shop.logo_url ? <img src={shop.logo_url} alt="" /> : shop.company_name.slice(0, 2).toUpperCase()}</div><span className={`platform-status ${shop.status}`}>{shop.status}</span></div>
            <h3>{shop.company_name}</h3><p>{shop.contact_email || 'No contact email added'}</p>
            <div className="platform-shop-metrics"><div><strong>{item?.sales_count ?? 0}</strong><small>Sales</small></div><div><strong>{item?.products_count ?? 0}</strong><small>Products</small></div><div><strong>{item?.customers_count ?? 0}</strong><small>Customers</small></div></div>
            <div className="platform-shop-total">Sales total <strong>{money(Number(item?.sales_total ?? 0), shop.currency || 'NPR')}</strong></div>
          </button>;
        })}
      </section>

      {selectedShop && (
        <section className="platform-detail-grid">
          <div className="platform-panel">
            <div className="platform-panel-title"><div><span className="platform-eyebrow">SHOP PROFILE</span><h3>{selectedShop.company_name}</h3><p>Review or update this business information.</p></div><button className="platform-secondary-button" onClick={() => editing ? setEditing(false) : startEdit(selectedShop)}>{editing ? 'Cancel edit' : '✎ Edit profile'}</button></div>
            {editing ? <form onSubmit={saveShop} className="platform-form compact">
              <div className="platform-form-grid">
                <label>Business name<input required value={String(editForm.company_name ?? '')} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} /></label>
                <label>Currency<select value={String(editForm.currency ?? 'NPR')} onChange={e => setEditForm({ ...editForm, currency: e.target.value })}><option>NPR</option><option>USD</option><option>INR</option><option>AED</option></select></label>
                <label>Logo image URL<input value={String(editForm.logo_url ?? '')} onChange={e => setEditForm({ ...editForm, logo_url: e.target.value })} placeholder="https://…" /></label>
                <label>Upload logo image<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => void uploadShopLogo(e.target.files?.[0])} /></label>
                <label>Contact email<input type="email" value={String(editForm.contact_email ?? '')} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} /></label>
                <label>Phone<input value={String(editForm.phone ?? '')} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></label>
                <label>Website<input value={String(editForm.website ?? '')} onChange={e => setEditForm({ ...editForm, website: e.target.value })} /></label>
                <label className="wide">Address<input value={String(editForm.address ?? '')} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></label>
                <label>Account status<select value={String(editForm.status ?? 'active')} onChange={e => setEditForm({ ...editForm, status: e.target.value as Shop['status'] })}><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select></label>
                <label>Plan name<input value={String(editForm.plan_name ?? 'standard')} onChange={e => setEditForm({ ...editForm, plan_name: e.target.value })} /></label>
              </div>
              <button className="platform-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save shop profile'}</button>
            </form> : <div className="platform-profile-grid">
              <div><small>Business name</small><strong>{selectedShop.company_name}</strong></div><div><small>Currency</small><strong>{selectedShop.currency}</strong></div>
              <div><small>Contact email</small><strong>{selectedShop.contact_email || '—'}</strong></div><div><small>Phone</small><strong>{selectedShop.phone || '—'}</strong></div>
              <div><small>Address</small><strong>{selectedShop.address || '—'}</strong></div><div><small>Plan / status</small><strong>{selectedShop.plan_name} · {selectedShop.status}</strong></div>
            </div>}
            <div className="platform-detail-actions"><button className="platform-primary-button" onClick={() => onOpenShop(selectedShop.id)}>Open this shop's POS →</button></div>
          </div>

          <div className="platform-panel platform-report-panel">
            <span className="platform-eyebrow">BUSINESS SNAPSHOT</span><h3>Shop reports</h3><p>Lifetime totals recorded in this shop.</p>
            <div className="platform-report-list">
              <div><span>Sales</span><strong>{money(Number(selectedStats?.sales_total ?? 0), selectedShop.currency)}</strong><small>{selectedStats?.sales_count ?? 0} transactions</small></div>
              <div><span>Purchases</span><strong>{money(Number(selectedStats?.purchases_total ?? 0), selectedShop.currency)}</strong><small>{selectedStats?.purchases_count ?? 0} records</small></div>
              <div><span>Expenses</span><strong>{money(Number(selectedStats?.expenses_total ?? 0), selectedShop.currency)}</strong><small>Recorded expenses</small></div>
              <div><span>Products / customers</span><strong>{selectedStats?.products_count ?? 0} / {selectedStats?.customers_count ?? 0}</strong><small>Current records</small></div>
            </div>
          </div>
        </section>
      )}

      {selectedShop && (
        <section className="platform-panel platform-staff-panel">
          <div className="platform-panel-title"><div><span className="platform-eyebrow">TEAM ACCESS</span><h3>Shop users and staff</h3><p>Invite the shop admin or staff and control their access.</p></div><span className="platform-member-count">{members.length} members</span></div>
          <div className="platform-member-list">
            {members.map(member => <div className="platform-member-row" key={member.user_id}><div className="platform-member-avatar">{(profiles[member.user_id]?.full_name || member.user_id).slice(0, 1).toUpperCase()}</div><div className="platform-member-copy"><strong>{profiles[member.user_id]?.full_name || 'Invited user'}</strong><small>{profiles[member.user_id]?.phone || `Account ID: ${member.user_id.slice(0, 8)}…`}</small></div><span className="platform-role-pill">{member.role.replace('_', ' ')}</span><span className={`platform-member-state ${member.is_active ? 'active' : 'inactive'}`}>{member.is_active ? 'Active' : 'Disabled'}</span></div>)}
            {members.length === 0 && <p className="platform-muted">No users are assigned to this shop yet.</p>}
          </div>
          <form className="platform-invite-form" onSubmit={inviteStaff}>
            <h4>Invite a user to this shop</h4>
            <div className="platform-form-grid">
              <label>Full name<input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Staff name" /></label>
              <label>Email address<input required type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} placeholder="staff@example.com" /></label>
              <label>Branch<select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} required>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.branch_name} ({branch.branch_code})</option>)}</select></label>
              <label>Role<select value={staffRole} onChange={e => { const role = e.target.value; setStaffRole(role); setStaffPermissions(role === 'manager' ? PERMISSIONS.map(item => item[0]) : role === 'cashier' ? ['sales.create'] : []); }}><option value="owner">Shop admin / owner</option><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="stock_manager">Stock manager</option><option value="accountant">Accountant</option><option value="custom">Custom role</option></select></label>
            </div>
            <div className="platform-permissions"><strong>Permissions</strong><div className="platform-permission-grid">{PERMISSIONS.map(([key, label]) => <label key={key} className="platform-check"><input type="checkbox" checked={staffPermissions.includes(key)} onChange={() => togglePermission(key)} />{label}</label>)}</div></div>
            <button className="platform-primary-button" disabled={saving || !selectedBranch}>{saving ? 'Sending invitation…' : 'Send staff invitation'}</button>
          </form>
        </section>
      )}

      <footer className="platform-footer">D.R GLOBAL BUSINESS SUITE <span>Platform administration · {shops.length} shop(s)</span></footer>
    </div>
  );
}