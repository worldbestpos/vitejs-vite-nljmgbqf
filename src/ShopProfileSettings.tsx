import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type ShopProfile = {
  company_name: string;
  currency: string;
  default_language: string;
  logo_url: string;
  contact_email: string;
  phone: string;
  address: string;
  website: string;
};

const blank: ShopProfile = {
  company_name: '', currency: 'NPR', default_language: 'en', logo_url: '',
  contact_email: '', phone: '', address: '', website: '',
};

export default function ShopProfileSettings({ companyId, onSaved }: { companyId: string; onSaved?: (profile: Pick<ShopProfile, 'company_name' | 'logo_url' | 'currency'>) => void }) {
  const [profile, setProfile] = useState<ShopProfile>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError('');
      const { data, error: readError } = await supabase.from('companies')
        .select('company_name,currency,default_language,logo_url,contact_email,phone,address,website')
        .eq('id', companyId).single();
      if (!active) return;
      if (readError) setError(readError.message);
      else setProfile({
        company_name: data.company_name ?? '', currency: data.currency ?? 'NPR',
        default_language: data.default_language ?? 'en', logo_url: data.logo_url ?? '',
        contact_email: data.contact_email ?? '', phone: data.phone ?? '',
        address: data.address ?? '', website: data.website ?? '',
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [companyId]);

  async function uploadLogo(file?: File) {
    if (!file) return;
    setSaving(true); setError(''); setMessage('');
    try {
      if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Logo must be smaller than 5 MB.');
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${companyId}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('shop-logos').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('shop-logos').getPublicUrl(path);
      setProfile(current => ({ ...current, logo_url: data.publicUrl }));
      setMessage('Logo uploaded. Save the profile to apply it.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally { setSaving(false); }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const { error: updateError } = await supabase.from('companies').update({
        company_name: profile.company_name.trim(), currency: profile.currency,
        default_language: profile.default_language, logo_url: profile.logo_url.trim() || null,
        contact_email: profile.contact_email.trim() || null, phone: profile.phone.trim() || null,
        address: profile.address.trim() || null, website: profile.website.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', companyId);
      if (updateError) throw updateError;
      onSaved?.({ company_name: profile.company_name.trim(), logo_url: profile.logo_url, currency: profile.currency });
      setMessage('Shop profile saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save shop profile.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="drg-panel"><p>Loading shop profile…</p></div>;

  return (
    <div className="drg-settings-page">
      <div className="drg-settings-intro"><span className="drg-section-kicker">BUSINESS IDENTITY</span><h1>Shop Profile</h1><p>Set the name, logo and contact information customers see on your shop documents.</p></div>
      <form className="drg-panel drg-setting-card" onSubmit={saveProfile}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: '#f0eafa', display: 'grid', placeItems: 'center', overflow: 'hidden', color: '#6946b6', fontWeight: 900, fontSize: 22 }}>
            {profile.logo_url ? <img src={profile.logo_url} alt="Shop logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.company_name.slice(0, 2).toUpperCase() || 'SHOP'}
          </div>
          <div><strong>{profile.company_name || 'Your shop'}</strong><p style={{ margin: '4px 0', color: '#8b8495', fontSize: 12 }}>Shop logo preview</p><label className="drg-primary-button" style={{ display: 'inline-block', cursor: 'pointer' }}>Upload logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => void uploadLogo(e.target.files?.[0])} style={{ display: 'none' }} /></label></div>
        </div>
        <div className="drg-settings-form-grid">
          <label className="drg-label">Shop / business name<input className="drg-input" required value={profile.company_name} onChange={e => setProfile({ ...profile, company_name: e.target.value })} /></label>
          <label className="drg-label">Currency<select className="drg-input" value={profile.currency} onChange={e => setProfile({ ...profile, currency: e.target.value })}><option value="NPR">NPR</option><option value="USD">USD</option><option value="INR">INR</option><option value="AED">AED</option></select></label>
          <label className="drg-label">Contact email<input className="drg-input" type="email" value={profile.contact_email} onChange={e => setProfile({ ...profile, contact_email: e.target.value })} /></label>
          <label className="drg-label">Phone<input className="drg-input" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></label>
          <label className="drg-label">Website<input className="drg-input" value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} placeholder="https://" /></label>
          <label className="drg-label">Default language<select className="drg-input" value={profile.default_language} onChange={e => setProfile({ ...profile, default_language: e.target.value })}><option value="en">English</option><option value="ne">नेपाली</option></select></label>
          <label className="drg-label" style={{ gridColumn: '1 / -1' }}>Business address<textarea className="drg-input" rows={3} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} /></label>
        </div>
        {error && <div className="drg-error" style={{ marginTop: 16 }}>{error}</div>}
        {message && <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: '#eaf8f0', color: '#187c4d', fontSize: 12 }}>{message}</div>}
        <button className="drg-primary-button" disabled={saving} style={{ marginTop: 20 }}>{saving ? 'Saving…' : 'Save shop profile'}</button>
      </form>
    </div>
  );
}