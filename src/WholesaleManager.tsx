import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type Props = {
  companyId: string;
  branchId: string;
  currency: string;
};

type Tab = 'profile' | 'warehouses' | 'units' | 'tiers' | 'customers';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 10,
  background: 'var(--card, #fff)',
  color: 'var(--text, #222)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: '11px 16px',
  background: 'var(--drg-accent, #7655E8)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--card, #fff)',
  border: '1px solid var(--border, #e8e8ee)',
  borderRadius: 16,
  padding: 20,
  minWidth: 0,
};

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: 7,
  marginBottom: 15,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text, #555)',
};

export default function WholesaleManager({
  companyId,
  branchId,
  currency,
}: Props) {
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [profile, setProfile] = useState({
    display_name: '',
    legal_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    website: '',
    tax_registration_number: '',
    tax_enabled: false,
    default_tax_rate: '0',
    invoice_prefix: 'INV',
    invoice_footer: '',
    receipt_footer: '',
  });

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [warehouseBranch, setWarehouseBranch] = useState(branchId);

  const [units, setUnits] = useState<any[]>([]);
  const [unitName, setUnitName] = useState('');
  const [unitAbbreviation, setUnitAbbreviation] = useState('');

  const [tiers, setTiers] = useState<any[]>([]);
  const [tierName, setTierName] = useState('');
  const [tierDescription, setTierDescription] = useState('');

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerEdits, setCustomerEdits] = useState<Record<string, any>>({});

  function notify(message: string) {
    setSuccess(message);
    setError('');
    window.setTimeout(() => setSuccess(''), 3500);
  }

  function fail(message: string) {
    setError(message);
    setSuccess('');
  }

  async function loadProfile() {
    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', companyId)
      .single();

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw error;

    setProfile({
      display_name: data?.display_name || company?.company_name || '',
      legal_name: data?.legal_name || '',
      business_address: data?.business_address || '',
      business_phone: data?.business_phone || '',
      business_email: data?.business_email || '',
      website: data?.website || '',
      tax_registration_number: data?.tax_registration_number || '',
      tax_enabled: data?.tax_enabled ?? false,
      default_tax_rate: String(data?.default_tax_rate ?? 0),
      invoice_prefix: data?.invoice_prefix || 'INV',
      invoice_footer: data?.invoice_footer || '',
      receipt_footer: data?.receipt_footer || '',
    });
  }

  async function loadWarehouses() {
    const [warehouseResult, branchResult] = await Promise.all([
      supabase
        .from('warehouses')
        .select('id, branch_id, warehouse_code, warehouse_name, address, is_default, is_active')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      supabase
        .from('branches')
        .select('id, branch_name, branch_code')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('branch_name'),
    ]);

    if (warehouseResult.error) throw warehouseResult.error;
    if (branchResult.error) throw branchResult.error;

    setWarehouses(warehouseResult.data || []);
    setBranches(branchResult.data || []);
  }

  async function loadUnits() {
    const { data, error } = await supabase
      .from('product_units')
      .select('*')
      .eq('company_id', companyId)
      .order('unit_name');

    if (error) throw error;
    setUnits(data || []);
  }

  async function loadTiers() {
    const { data, error } = await supabase
      .from('customer_price_tiers')
      .select('*')
      .eq('company_id', companyId)
      .order('tier_name');

    if (error) throw error;
    setTiers(data || []);
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, company_name, phone, email, tax_exempt, payment_terms, credit_limit, price_tier_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    setCustomers(data || []);

    const edits: Record<string, any> = {};
    (data || []).forEach((customer: any) => {
      edits[customer.id] = {
        company_name: customer.company_name || '',
        tax_exempt: customer.tax_exempt || false,
        payment_terms: customer.payment_terms || 'due_on_receipt',
        credit_limit: String(customer.credit_limit ?? 0),
        price_tier_id: customer.price_tier_id || '',
      };
    });
    setCustomerEdits(edits);
  }

  async function loadAll() {
    setLoading(true);
    setError('');

    try {
      await Promise.all([
        loadProfile(),
        loadWarehouses(),
        loadUnits(),
        loadTiers(),
        loadCustomers(),
      ]);
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [companyId]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { data: userResult } = await supabase.auth.getUser();

      const payload = {
        company_id: companyId,
        ...profile,
        default_tax_rate: Number(profile.default_tax_rate || 0),
        updated_by: userResult.user?.id || null,
        updated_at: new Date().toISOString(),
      };

      const { error: settingsError } = await supabase
        .from('company_settings')
        .upsert(payload, { onConflict: 'company_id' });

      if (settingsError) throw settingsError;

      if (profile.display_name.trim()) {
        const { error: companyError } = await supabase
          .from('companies')
          .update({ company_name: profile.display_name.trim() })
          .eq('id', companyId);

        if (companyError) throw companyError;
      }

      notify('Business profile saved successfully.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function addWarehouse(e: FormEvent) {
    e.preventDefault();

    if (!warehouseName.trim() || !warehouseCode.trim()) {
      fail('Enter a warehouse name and code.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from('warehouses').insert({
        company_id: companyId,
        branch_id: warehouseBranch,
        warehouse_name: warehouseName.trim(),
        warehouse_code: warehouseCode.trim().toUpperCase(),
        address: warehouseAddress.trim() || null,
        is_default: false,
        is_active: true,
      });

      if (error) throw error;

      setWarehouseName('');
      setWarehouseCode('');
      setWarehouseAddress('');
      await loadWarehouses();
      notify('Warehouse added successfully.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Unable to add warehouse.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleWarehouse(warehouse: any) {
    if (warehouse.is_default) {
      fail('The default warehouse cannot be deactivated.');
      return;
    }

    const { error } = await supabase
      .from('warehouses')
      .update({ is_active: !warehouse.is_active })
      .eq('id', warehouse.id)
      .eq('company_id', companyId);

    if (error) {
      fail(error.message);
      return;
    }

    await loadWarehouses();
    notify('Warehouse status updated.');
  }

  async function addUnit(e: FormEvent) {
    e.preventDefault();

    if (!unitName.trim() || !unitAbbreviation.trim()) {
      fail('Enter the unit name and abbreviation.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from('product_units').insert({
        company_id: companyId,
        unit_name: unitName.trim(),
        abbreviation: unitAbbreviation.trim(),
        is_base_unit: false,
        is_active: true,
      });

      if (error) throw error;

      setUnitName('');
      setUnitAbbreviation('');
      await loadUnits();
      notify('Unit added successfully.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Unable to add unit.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleUnit(unit: any) {
    if (unit.is_base_unit) {
      fail('The base unit cannot be deactivated.');
      return;
    }

    const { error } = await supabase
      .from('product_units')
      .update({ is_active: !unit.is_active })
      .eq('id', unit.id)
      .eq('company_id', companyId);

    if (error) {
      fail(error.message);
      return;
    }

    await loadUnits();
    notify('Unit status updated.');
  }

  async function addTier(e: FormEvent) {
    e.preventDefault();

    if (!tierName.trim()) {
      fail('Enter a price tier name.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from('customer_price_tiers').insert({
        company_id: companyId,
        tier_name: tierName.trim(),
        description: tierDescription.trim() || null,
        is_default: false,
        is_active: true,
      });

      if (error) throw error;

      setTierName('');
      setTierDescription('');
      await loadTiers();
      notify('Customer price tier added.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Unable to add price tier.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTier(tier: any) {
    if (tier.is_default) {
      fail('The default price tier cannot be deactivated.');
      return;
    }

    const { error } = await supabase
      .from('customer_price_tiers')
      .update({ is_active: !tier.is_active })
      .eq('id', tier.id)
      .eq('company_id', companyId);

    if (error) {
      fail(error.message);
      return;
    }

    await loadTiers();
    notify('Price tier status updated.');
  }

  async function saveCustomer(customerId: string) {
    const edit = customerEdits[customerId];
    if (!edit) return;

    const limit = Number(edit.credit_limit);

    if (!Number.isFinite(limit) || limit < 0) {
      fail('Credit limit must be zero or a positive amount.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          company_name: edit.company_name.trim() || null,
          tax_exempt: edit.tax_exempt,
          payment_terms: edit.payment_terms,
          credit_limit: limit,
          price_tier_id: edit.price_tier_id || null,
        })
        .eq('id', customerId)
        .eq('company_id', companyId);

      if (error) throw error;

      await loadCustomers();
      notify('Customer wholesale settings saved.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Unable to save customer.');
    } finally {
      setSaving(false);
    }
  }

  function updateCustomer(customerId: string, field: string, value: any) {
    setCustomerEdits((old) => ({
      ...old,
      [customerId]: {
        ...old[customerId],
        [field]: value,
      },
    }));
  }

  const filteredCustomers = customers.filter((customer) => {
    const search = customerSearch.toLowerCase();
    return (
      customer.full_name?.toLowerCase().includes(search) ||
      customer.company_name?.toLowerCase().includes(search) ||
      customer.phone?.toLowerCase().includes(search)
    );
  });

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Business Profile', icon: '🏢' },
    { id: 'warehouses', label: 'Warehouses', icon: '🏬' },
    { id: 'units', label: 'Product Units', icon: '📦' },
    { id: 'tiers', label: 'Price Tiers', icon: '🏷️' },
    { id: 'customers', label: 'B2B Customers', icon: '🤝' },
  ];

  if (loading) {
    return (
      <div style={cardStyle}>
        <h2>Loading business management...</h2>
        <p>Please wait while your company data is loaded.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20, color: 'var(--text, #222)' }}>
      <div
        style={{
          ...cardStyle,
          background: 'linear-gradient(120deg, #30205f, #7655E8)',
          color: '#fff',
          border: 0,
          padding: 25,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.8 }}>
          WHOLESALE & BUSINESS CONTROL
        </div>
        <h1 style={{ margin: '8px 0', fontSize: 27 }}>
          Business Management
        </h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          Configure your company, warehouses, units, customer pricing and credit terms.
        </p>
        <div style={{ marginTop: 15, fontSize: 12, opacity: 0.8 }}>
          Currency: {currency}
        </div>
      </div>

      {error && (
        <div style={{
          padding: 13, borderRadius: 10, background: '#fff0f0',
          color: '#b42318', border: '1px solid #ffc9c9'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: 13, borderRadius: 10, background: '#eafaf0',
          color: '#147d42', border: '1px solid #b8ebca'
        }}>
          ✓ {success}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        background: 'var(--card, #fff)', border: '1px solid var(--border, #eee)',
        padding: 8, borderRadius: 14
      }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              border: 0,
              borderRadius: 10,
              padding: '11px 14px',
              cursor: 'pointer',
              fontWeight: 700,
              background: tab === item.id ? 'var(--drg-accent, #7655E8)' : 'transparent',
              color: tab === item.id ? '#fff' : 'var(--text, #555)',
            }}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form onSubmit={saveProfile} style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Company Profile & Invoice Settings</h2>
          <p style={{ color: 'var(--muted, #777)', marginTop: -8 }}>
            These details can be used on your future invoices and receipts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '0 18px' }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Business display name</span>
              <input style={inputStyle} value={profile.display_name}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                required />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Legal company name</span>
              <input style={inputStyle} value={profile.legal_name}
                onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })} />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Business phone</span>
              <input style={inputStyle} value={profile.business_phone}
                onChange={(e) => setProfile({ ...profile, business_phone: e.target.value })} />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Business email</span>
              <input style={inputStyle} type="email" value={profile.business_email}
                onChange={(e) => setProfile({ ...profile, business_email: e.target.value })} />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Website</span>
              <input style={inputStyle} value={profile.website}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Tax / VAT registration number</span>
              <input style={inputStyle} value={profile.tax_registration_number}
                onChange={(e) => setProfile({ ...profile, tax_registration_number: e.target.value })} />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Invoice prefix</span>
              <input style={inputStyle} value={profile.invoice_prefix}
                onChange={(e) => setProfile({ ...profile, invoice_prefix: e.target.value.toUpperCase() })} />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Default tax rate (%)</span>
              <input style={inputStyle} type="number" min="0" step="0.01"
                value={profile.default_tax_rate}
                onChange={(e) => setProfile({ ...profile, default_tax_rate: e.target.value })} />
            </label>
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Business address</span>
            <textarea style={{ ...inputStyle, minHeight: 75 }} value={profile.business_address}
              onChange={(e) => setProfile({ ...profile, business_address: e.target.value })} />
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0 18px' }}>
            <input type="checkbox" checked={profile.tax_enabled}
              onChange={(e) => setProfile({ ...profile, tax_enabled: e.target.checked })} />
            <strong>Enable tax on business documents</strong>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Invoice footer message</span>
            <textarea style={{ ...inputStyle, minHeight: 65 }} value={profile.invoice_footer}
              onChange={(e) => setProfile({ ...profile, invoice_footer: e.target.value })} />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Receipt footer message</span>
            <textarea style={{ ...inputStyle, minHeight: 65 }} value={profile.receipt_footer}
              onChange={(e) => setProfile({ ...profile, receipt_footer: e.target.value })} />
          </label>

          <button style={buttonStyle} disabled={saving}>
            {saving ? 'Saving...' : 'Save Business Profile'}
          </button>
        </form>
      )}

      {tab === 'warehouses' && (
        <>
          <form onSubmit={addWarehouse} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Add New Warehouse</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Warehouse name</span>
                <input style={inputStyle} placeholder="e.g. Main Warehouse"
                  value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Warehouse code</span>
                <input style={inputStyle} placeholder="e.g. WH-02"
                  value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Branch</span>
                <select style={inputStyle} value={warehouseBranch}
                  onChange={(e) => setWarehouseBranch(e.target.value)}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={labelStyle}>Warehouse address</span>
              <input style={inputStyle} value={warehouseAddress}
                onChange={(e) => setWarehouseAddress(e.target.value)} />
            </label>
            <button style={buttonStyle} disabled={saving}>＋ Add Warehouse</button>
          </form>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Your Warehouses ({warehouses.length})</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {warehouses.map((warehouse) => (
                <div key={warehouse.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 12, flexWrap: 'wrap', padding: 14,
                  border: '1px solid var(--border, #eee)', borderRadius: 12
                }}>
                  <div>
                    <strong>{warehouse.warehouse_name}</strong>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      {warehouse.warehouse_code} · {branches.find((b) => b.id === warehouse.branch_id)?.branch_name || 'Branch'}
                    </div>
                    {warehouse.is_default && <small style={{ color: '#16834a' }}>Default warehouse</small>}
                  </div>
                  <span style={{
                    padding: '5px 9px', borderRadius: 20, fontSize: 12,
                    background: warehouse.is_active ? '#e8f8ef' : '#fff0f0',
                    color: warehouse.is_active ? '#16834a' : '#b42318'
                  }}>
                    {warehouse.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {!warehouse.is_default && (
                    <button type="button" onClick={() => toggleWarehouse(warehouse)}
                      style={{ ...buttonStyle, background: warehouse.is_active ? '#b42318' : '#16834a' }}>
                      {warehouse.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              ))}
              {warehouses.length === 0 && <p>No warehouses found.</p>}
            </div>
          </div>
        </>
      )}

      {tab === 'units' && (
        <>
          <form onSubmit={addUnit} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Create Product Unit</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Unit name</span>
                <input style={inputStyle} placeholder="e.g. Carton"
                  value={unitName} onChange={(e) => setUnitName(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Abbreviation</span>
                <input style={inputStyle} placeholder="e.g. ctn"
                  value={unitAbbreviation} onChange={(e) => setUnitAbbreviation(e.target.value)} />
              </label>
            </div>
            <button style={buttonStyle} disabled={saving}>＋ Add Unit</button>
          </form>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Available Units ({units.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              {units.map((unit) => (
                <div key={unit.id} style={{
                  padding: 16, borderRadius: 12, border: '1px solid var(--border, #eee)'
                }}>
                  <strong style={{ fontSize: 17 }}>{unit.unit_name}</strong>
                  <div style={{ opacity: 0.7, margin: '4px 0 12px' }}>{unit.abbreviation}</div>
                  <div style={{ fontSize: 12, marginBottom: 10 }}>
                    {unit.is_base_unit ? 'Base unit' : 'Additional unit'}
                  </div>
                  <button type="button" onClick={() => toggleUnit(unit)}
                    disabled={unit.is_base_unit}
                    style={{
                      ...buttonStyle,
                      padding: '7px 10px',
                      background: unit.is_active ? '#16834a' : '#777',
                      opacity: unit.is_base_unit ? 0.5 : 1
                    }}>
                    {unit.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'tiers' && (
        <>
          <form onSubmit={addTier} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Create Customer Price Tier</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Tier name</span>
                <input style={inputStyle} placeholder="e.g. Wholesale Gold"
                  value={tierName} onChange={(e) => setTierName(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Description</span>
                <input style={inputStyle} placeholder="Optional description"
                  value={tierDescription} onChange={(e) => setTierDescription(e.target.value)} />
              </label>
            </div>
            <button style={buttonStyle} disabled={saving}>＋ Add Price Tier</button>
          </form>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Customer Pricing Groups ({tiers.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              {tiers.map((tier) => (
                <div key={tier.id} style={{
                  border: '1px solid var(--border, #eee)', borderRadius: 13, padding: 16
                }}>
                  <strong style={{ fontSize: 17 }}>{tier.tier_name}</strong>
                  <p style={{ fontSize: 13, opacity: 0.7, minHeight: 35 }}>
                    {tier.description || 'Customer pricing group'}
                  </p>
                  {tier.is_default && <small style={{ color: '#16834a' }}>Default tier</small>}
                  <div style={{ marginTop: 12 }}>
                    <button type="button" disabled={tier.is_default}
                      onClick={() => toggleTier(tier)}
                      style={{
                        ...buttonStyle,
                        padding: '7px 10px',
                        background: tier.is_active ? '#16834a' : '#777',
                        opacity: tier.is_default ? 0.5 : 1
                      }}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'customers' && (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>B2B Customer Credit & Terms</h2>
          <p style={{ color: 'var(--muted, #777)' }}>
            Set a customer company name, tax exemption, payment terms, credit limit and price tier.
          </p>

          <input style={{ ...inputStyle, maxWidth: 420, marginBottom: 18 }}
            placeholder="Search customer, company or phone..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)} />

          <div style={{ display: 'grid', gap: 15 }}>
            {filteredCustomers.map((customer) => {
              const edit = customerEdits[customer.id] || {};
              return (
                <div key={customer.id} style={{
                  border: '1px solid var(--border, #eee)', borderRadius: 13, padding: 16
                }}>
                  <div style={{ marginBottom: 13 }}>
                    <strong style={{ fontSize: 17 }}>{customer.full_name}</strong>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {customer.phone || customer.email || 'No contact details'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Customer business name</span>
                      <input style={inputStyle} value={edit.company_name || ''}
                        onChange={(e) => updateCustomer(customer.id, 'company_name', e.target.value)} />
                    </label>

                    <label style={fieldStyle}>
                      <span style={labelStyle}>Payment terms</span>
                      <select style={inputStyle} value={edit.payment_terms || 'due_on_receipt'}
                        onChange={(e) => updateCustomer(customer.id, 'payment_terms', e.target.value)}>
                        <option value="due_on_receipt">Due on Receipt</option>
                        <option value="net_15">Net 15</option>
                        <option value="net_30">Net 30</option>
                        <option value="net_60">Net 60</option>
                      </select>
                    </label>

                    <label style={fieldStyle}>
                      <span style={labelStyle}>Credit limit ({currency})</span>
                      <input style={inputStyle} type="number" min="0" step="0.01"
                        value={edit.credit_limit ?? '0'}
                        onChange={(e) => updateCustomer(customer.id, 'credit_limit', e.target.value)} />
                    </label>

                    <label style={fieldStyle}>
                      <span style={labelStyle}>Customer price tier</span>
                      <select style={inputStyle} value={edit.price_tier_id || ''}
                        onChange={(e) => updateCustomer(customer.id, 'price_tier_id', e.target.value)}>
                        <option value="">No tier selected</option>
                        {tiers.filter((tier) => tier.is_active).map((tier) => (
                          <option key={tier.id} value={tier.id}>{tier.tier_name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label style={{ display: 'flex', gap: 9, alignItems: 'center', margin: '4px 0 14px' }}>
                    <input type="checkbox" checked={!!edit.tax_exempt}
                      onChange={(e) => updateCustomer(customer.id, 'tax_exempt', e.target.checked)} />
                    <strong style={{ fontSize: 13 }}>Tax exempt customer</strong>
                  </label>

                  <button type="button" style={buttonStyle} disabled={saving}
                    onClick={() => saveCustomer(customer.id)}>
                    Save Customer Settings
                  </button>
                </div>
              );
            })}

            {filteredCustomers.length === 0 && (
              <p>No matching customers found.</p>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.65, textAlign: 'center' }}>
        Business Management · Company-specific settings · {currency}
      </div>
    </div>
  );
}