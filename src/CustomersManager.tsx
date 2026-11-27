
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

type Customer = {
  id: string;
  company_id: string;
  customer_code: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  opening_balance: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type Sale = {
  id: string;
  customer_id: string | null;
  bill_number: string;
  sale_date: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  notes: string | null;
};

type SaleItem = {
  sale_id: string;
  product_name_snapshot: string;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Payment = {
  id: string;
  sale_id: string | null;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number: string | null;
};

type CustomerForm = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  bank_account_name: string;
  bank_account_number: string;
  opening_balance: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  bank_account_name: '',
  bank_account_number: '',
  opening_balance: '0',
  notes: '',
};

export default function CustomersManager({
  companyId,
  branchId,
  currency,
}: {
  companyId: string;
  branchId: string;
  currency: string;
}) {
  const { language } = useLanguage();
  const ne = language === 'ne';
  const tr = (english: string, nepali: string) => ne ? nepali : english;
  const locale = ne ? 'ne-NP' : 'en-IN';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const money = (value: number) =>
    `${currency} ${Number(value || 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value: string) =>
    value ? new Date(value).toLocaleString(locale) : '—';

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [customerResult, salesResult] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),

        supabase
          .from('sales')
          .select('id,customer_id,bill_number,sale_date,status,subtotal,discount_amount,tax_amount,total_amount,paid_amount,due_amount,notes')
          .eq('company_id', companyId)
          .eq('branch_id', branchId)
          .order('sale_date', { ascending: false })
          .limit(2000),
      ]);

      if (customerResult.error) throw customerResult.error;
      if (salesResult.error) throw salesResult.error;

      setCustomers((customerResult.data || []) as Customer[]);
      setSales((salesResult.data || []) as Sale[]);
    } catch (err: any) {
      setError(err.message || tr('Unable to load customer information.', 'ग्राहकको जानकारी लोड गर्न सकिएन।'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [companyId, branchId]);

  const customerSales = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales.filter(sale => sale.customer_id === selectedCustomer.id);
  }, [sales, selectedCustomer]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerHistory() {
      setSaleItems([]);
      setPayments([]);

      if (!selectedCustomer) return;

      const saleIds = sales
        .filter(sale => sale.customer_id === selectedCustomer.id)
        .map(sale => sale.id);

      if (saleIds.length === 0) return;

      try {
        const [itemsResult, paymentsResult] = await Promise.all([
          supabase
            .from('sale_items')
            .select('sale_id,product_name_snapshot,sku_snapshot,quantity,unit_price,line_total')
            .in('sale_id', saleIds),

          supabase
            .from('payments')
            .select('id,sale_id,amount,payment_method,payment_date,reference_number')
            .in('sale_id', saleIds)
            .order('payment_date', { ascending: false }),
        ]);

        if (itemsResult.error) throw itemsResult.error;
        if (paymentsResult.error) throw paymentsResult.error;

        if (!cancelled) {
          setSaleItems((itemsResult.data || []) as SaleItem[]);
          setPayments((paymentsResult.data || []) as Payment[]);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(`${tr('Unable to load customer history:', 'ग्राहकको इतिहास लोड गर्न सकिएन:')} ${err.message}`);
        }
      }
    }

    loadCustomerHistory();

    return () => {
      cancelled = true;
    };
  }, [selectedCustomer, sales]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return customers.filter(customer => {
      if (!showInactive && !customer.is_active) return false;
      if (showInactive && customer.is_active) return false;

      if (!term) return true;

      return [
        customer.full_name,
        customer.phone,
        customer.email,
        customer.customer_code,
      ].some(value => String(value || '').toLowerCase().includes(term));
    });
  }, [customers, search, showInactive]);

  const totalPurchases = (customerId: string) =>
    sales
      .filter(sale => sale.customer_id === customerId)
      .reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);

  const totalPaid = (customerId: string) =>
    sales
      .filter(sale => sale.customer_id === customerId)
      .reduce((sum, sale) => sum + Number(sale.paid_amount || 0), 0);

  const totalDue = (customer: Customer) =>
    Number(customer.opening_balance || 0) +
    sales
      .filter(sale => sale.customer_id === customer.id)
      .reduce((sum, sale) => sum + Number(sale.due_amount || 0), 0);

  const activeCustomers = customers.filter(c => c.is_active).length;
  const inactiveCustomers = customers.filter(c => !c.is_active).length;

  const allPurchases = sales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  const allOutstanding =
    customers.reduce((sum, customer) => sum + Number(customer.opening_balance || 0), 0) +
    sales.reduce((sum, sale) => sum + Number(sale.due_amount || 0), 0);

  function startNewCustomer() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setShowForm(true);
    setSelectedCustomer(null);
    setError('');
    setMessage('');
  }

  function startEditCustomer(customer: Customer) {
    setEditingCustomer(customer);
    setForm({
      full_name: customer.full_name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      bank_account_name: customer.bank_account_name || '',
      bank_account_number: customer.bank_account_number || '',
      opening_balance: String(customer.opening_balance || 0),
      notes: customer.notes || '',
    });
    setShowForm(true);
    setSelectedCustomer(null);
    setError('');
    setMessage('');
  }

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();

    if (!form.full_name.trim()) {
      setError(tr('Please enter the customer name.', 'कृपया ग्राहकको नाम लेख्नुहोस्।'));
      return;
    }

    if (Number(form.opening_balance) < 0 || !Number.isFinite(Number(form.opening_balance))) {
      setError(tr('Please enter a valid opening balance.', 'कृपया सही सुरुवाती मौज्दात लेख्नुहोस्।'));
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const customerData = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      bank_account_name: form.bank_account_name.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      opening_balance: Number(form.opening_balance || 0),
      notes: form.notes.trim() || null,
    };

    try {
      if (editingCustomer) {
        const { error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id)
          .eq('company_id', companyId);

        if (updateError) throw updateError;
        setMessage(tr('Customer updated successfully.', 'ग्राहक सफलतापूर्वक अपडेट भयो।'));
      } else {
        const customerCode = `CUS-${Date.now().toString().slice(-8)}`;

        const { error: insertError } = await supabase
          .from('customers')
          .insert({
            ...customerData,
            company_id: companyId,
            customer_code: customerCode,
            is_active: true,
          });

        if (insertError) throw insertError;
        setMessage(tr('New customer added successfully.', 'नयाँ ग्राहक सफलतापूर्वक थपियो।'));
      }

      setForm(emptyForm);
      setShowForm(false);
      setEditingCustomer(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || tr('Unable to save customer.', 'ग्राहक सुरक्षित गर्न सकिएन।'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCustomerStatus(customer: Customer) {
    const action = customer.is_active ? 'deactivate' : 'reactivate';
    const actionText = customer.is_active
      ? tr('deactivate', 'निष्क्रिय')
      : tr('reactivate', 'पुनः सक्रिय');

    if (!window.confirm(
      tr(
        `Are you sure you want to ${action} ${customer.full_name}?`,
        `के तपाईं ${customer.full_name} लाई ${actionText} गर्न निश्चित हुनुहुन्छ?`
      )
    )) {
      return;
    }

    setError('');
    setMessage('');

    const { error: updateError } = await supabase
      .from('customers')
      .update({ is_active: !customer.is_active })
      .eq('id', customer.id)
      .eq('company_id', companyId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSelectedCustomer(null);
    setMessage(
      customer.is_active
        ? tr('Customer deactivated successfully.', 'ग्राहक सफलतापूर्वक निष्क्रिय गरियो।')
        : tr('Customer reactivated successfully.', 'ग्राहक सफलतापूर्वक पुनः सक्रिय गरियो।')
    );
    await loadData();
  }

  function openCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setShowForm(false);
    setError('');
    setMessage('');
  }

  const cardStyle = {
    background: '#ffffff',
    border: '1px solid #e6e8ec',
    borderRadius: 12,
    padding: 18,
    boxShadow: '0 2px 8px rgba(20,30,50,0.04)',
  } as const;

  const buttonStyle = {
    border: 'none',
    borderRadius: 8,
    padding: '10px 15px',
    cursor: 'pointer',
    fontWeight: 700,
  } as const;

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    border: '1px solid #d8dce3',
    borderRadius: 8,
    padding: '11px 12px',
    color: '#172438',
    background: '#ffffff',
    fontSize: 14,
  };

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: '#344054',
    marginBottom: 6,
  } as const;

  return (
    <div style={{ padding: 4, color: '#172438' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 27 }}>{tr('Customers', 'ग्राहकहरू')}</h1>
          <p style={{ color: '#667085', margin: '6px 0 0' }}>
            {tr('Manage customer profiles, purchases and outstanding balances.', 'ग्राहक विवरण, खरिद र बाँकी रकम व्यवस्थापन गर्नुहोस्।')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            style={{ ...buttonStyle, background: '#eef1f5', color: '#172438' }}
            onClick={loadData}
          >
            ↻ {tr('Refresh', 'रिफ्रेस')}
          </button>

          <button
            style={{ ...buttonStyle, background: '#d8b66c', color: '#172438' }}
            onClick={startNewCustomer}
          >
            + {tr('Add Customer', 'ग्राहक थप्नुहोस्')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 12,
          marginBottom: 15,
          background: '#fff0f0',
          color: '#b42318',
          borderRadius: 8,
        }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{
          padding: 12,
          marginBottom: 15,
          background: '#ecfdf3',
          color: '#067647',
          borderRadius: 8,
        }}>
          {message}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={cardStyle}>
          <div style={{ color: '#667085', fontSize: 13 }}>{tr('Active Customers', 'सक्रिय ग्राहक')}</div>
          <div style={{ fontSize: 27, fontWeight: 800, marginTop: 7 }}>
            {activeCustomers.toLocaleString(locale)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#667085', fontSize: 13 }}>{tr('Inactive Customers', 'निष्क्रिय ग्राहक')}</div>
          <div style={{ fontSize: 27, fontWeight: 800, marginTop: 7 }}>
            {inactiveCustomers.toLocaleString(locale)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#667085', fontSize: 13 }}>{tr('Total Sales', 'कुल बिक्री')}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 7 }}>
            {money(allPurchases)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#667085', fontSize: 13 }}>{tr('Outstanding Balance', 'बाँकी रकम')}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#b54708', marginTop: 7 }}>
            {money(allOutstanding)}
          </div>
        </div>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>
            {editingCustomer ? tr('Edit Customer', 'ग्राहक सम्पादन') : tr('Add New Customer', 'नयाँ ग्राहक थप्नुहोस्')}
          </h2>

          <form onSubmit={saveCustomer}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 14,
            }}>
              <div>
                <label style={labelStyle}>{tr('Customer Name', 'ग्राहकको नाम')} *</label>
                <input
                  style={inputStyle}
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder={tr('Enter full name', 'पूरा नाम लेख्नुहोस्')}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>{tr('Phone Number', 'फोन नम्बर')}</label>
                <input
                  style={inputStyle}
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="98XXXXXXXX"
                />
              </div>

              <div>
                <label style={labelStyle}>{tr('Email Address', 'इमेल ठेगाना')}</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="customer@email.com"
                />
              </div>

              <div>
                <label style={labelStyle}>{tr('Opening Balance', 'सुरुवाती मौज्दात')} ({currency})</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                />
              </div>

              <div>
                <label style={labelStyle}>{tr('Address', 'ठेगाना')}</label>
                <input
                  style={inputStyle}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder={tr('Customer address', 'ग्राहकको ठेगाना')}
                />
              </div>

              <div>
                <label style={labelStyle}>{tr('Bank Account Name', 'बैंक खातावालाको नाम')}</label>
                <input
                  style={inputStyle}
                  value={form.bank_account_name}
                  onChange={e => setForm({ ...form, bank_account_name: e.target.value })}
                  placeholder={tr('Account holder name', 'खातावालाको नाम')}
                />
              </div>

              <div>
                <label style={labelStyle}>{tr('Bank Account Number', 'बैंक खाता नम्बर')}</label>
                <input
                  style={inputStyle}
                  value={form.bank_account_number}
                  onChange={e => setForm({ ...form, bank_account_number: e.target.value })}
                  placeholder={tr('Account number', 'खाता नम्बर')}
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>{tr('Notes', 'कैफियत')}</label>
              <textarea
                style={{ ...inputStyle, minHeight: 75, resize: 'vertical' }}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder={tr('Additional customer information...', 'ग्राहकसम्बन्धी थप जानकारी...')}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ ...buttonStyle, background: '#172438', color: '#ffffff' }}
              >
                {saving
                  ? tr('Saving...', 'सेभ हुँदैछ...')
                  : editingCustomer
                    ? tr('Save Changes', 'परिवर्तनहरू सेभ गर्नुहोस्')
                    : tr('Create Customer', 'ग्राहक सिर्जना गर्नुहोस्')}
              </button>

              <button
                type="button"
                style={{ ...buttonStyle, background: '#eef1f5', color: '#172438' }}
                onClick={() => {
                  setShowForm(false);
                  setEditingCustomer(null);
                  setForm(emptyForm);
                }}
              >
                {tr('Cancel', 'रद्द गर्नुहोस्')}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedCustomer ? (
        <div style={cardStyle}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 18,
          }}>
            <div>
              <button
                style={{ ...buttonStyle, background: '#eef1f5', color: '#172438', marginBottom: 12 }}
                onClick={() => setSelectedCustomer(null)}
              >
                ← {tr('Back to Customers', 'ग्राहक सूचीमा फर्कनुहोस्')}
              </button>
              <h2 style={{ margin: 0 }}>{selectedCustomer.full_name}</h2>
              <div style={{ color: '#667085', marginTop: 5 }}>
                {selectedCustomer.customer_code || tr('No customer code', 'ग्राहक कोड छैन')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                style={{ ...buttonStyle, background: '#172438', color: '#ffffff' }}
                onClick={() => startEditCustomer(selectedCustomer)}
              >
                {tr('Edit Customer', 'ग्राहक सम्पादन')}
              </button>

              <button
                style={{
                  ...buttonStyle,
                  background: selectedCustomer.is_active ? '#fff0f0' : '#ecfdf3',
                  color: selectedCustomer.is_active ? '#b42318' : '#067647',
                }}
                onClick={() => toggleCustomerStatus(selectedCustomer)}
              >
                {selectedCustomer.is_active ? tr('Deactivate', 'निष्क्रिय गर्नुहोस्') : tr('Reactivate', 'पुनः सक्रिय गर्नुहोस्')}
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
            gap: 12,
            marginBottom: 20,
          }}>
            <div style={cardStyle}>
              <div style={{ color: '#667085', fontSize: 13 }}>{tr('Total Purchases', 'कुल खरिद')}</div>
              <b style={{ display: 'block', fontSize: 21, marginTop: 7 }}>
                {money(totalPurchases(selectedCustomer.id))}
              </b>
            </div>

            <div style={cardStyle}>
              <div style={{ color: '#667085', fontSize: 13 }}>{tr('Amount Paid', 'भुक्तानी भएको रकम')}</div>
              <b style={{ display: 'block', fontSize: 21, marginTop: 7 }}>
                {money(totalPaid(selectedCustomer.id))}
              </b>
            </div>

            <div style={cardStyle}>
              <div style={{ color: '#667085', fontSize: 13 }}>{tr('Outstanding Balance', 'बाँकी रकम')}</div>
              <b style={{ display: 'block', fontSize: 21, color: '#b54708', marginTop: 7 }}>
                {money(totalDue(selectedCustomer))}
              </b>
            </div>
          </div>

          <h3>{tr('Contact Information', 'सम्पर्क जानकारी')}</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 12,
            marginBottom: 20,
          }}>
            <div><b>{tr('Phone:', 'फोन:')}</b> {selectedCustomer.phone || '—'}</div>
            <div><b>{tr('Email:', 'इमेल:')}</b> {selectedCustomer.email || '—'}</div>
            <div><b>{tr('Address:', 'ठेगाना:')}</b> {selectedCustomer.address || '—'}</div>
            <div><b>{tr('Bank Account Name:', 'बैंक खातावालाको नाम:')}</b> {selectedCustomer.bank_account_name || '—'}</div>
            <div><b>{tr('Bank Account Number:', 'बैंक खाता नम्बर:')}</b> {selectedCustomer.bank_account_number || '—'}</div>
            <div><b>{tr('Opening Balance:', 'सुरुवाती मौज्दात:')}</b> {money(Number(selectedCustomer.opening_balance || 0))}</div>
            <div><b>{tr('Notes:', 'कैफियत:')}</b> {selectedCustomer.notes || '—'}</div>
            <div><b>{tr('Customer Since:', 'ग्राहक बनेको मिति:')}</b> {formatDate(selectedCustomer.created_at)}</div>
          </div>

          <h3>{tr('Purchase History', 'खरिद इतिहास')}</h3>

          {customerSales.length === 0 ? (
            <p style={{ color: '#667085' }}>{tr('No sales recorded for this customer yet.', 'यस ग्राहकका लागि अहिलेसम्म बिक्री रेकर्ड गरिएको छैन।')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                <thead>
                  <tr style={{ background: '#f4f2ed', textAlign: 'left' }}>
                    {[
                      tr('Bill Number', 'बिल नम्बर'),
                      tr('Date', 'मिति'),
                      tr('Total', 'जम्मा'),
                      tr('Paid', 'तिरेको'),
                      tr('Due', 'बाँकी'),
                      tr('Status', 'स्थिति'),
                    ].map(label => (
                      <th key={label} style={{ padding: 11, borderBottom: '1px solid #ddd' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerSales.map(sale => (
                    <tr key={sale.id}>
                      <td style={{ padding: 11, borderBottom: '1px solid #eee' }}>
                        <b>{sale.bill_number}</b>
                      </td>
                      <td style={{ padding: 11, borderBottom: '1px solid #eee' }}>
                        {formatDate(sale.sale_date)}
                      </td>
                      <td style={{ padding: 11, borderBottom: '1px solid #eee' }}>
                        {money(Number(sale.total_amount))}
                      </td>
                      <td style={{ padding: 11, borderBottom: '1px solid #eee' }}>
                        {money(Number(sale.paid_amount))}
                      </td>
                      <td style={{ padding: 11, borderBottom: '1px solid #eee', color: '#b54708' }}>
                        {money(Number(sale.due_amount))}
                      </td>
                      <td style={{ padding: 11, borderBottom: '1px solid #eee' }}>
                        {tr(sale.status, sale.status === 'paid' ? 'भुक्तानी भयो' : sale.status === 'partial' ? 'आंशिक भुक्तानी' : sale.status === 'due' ? 'बाँकी' : sale.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ marginTop: 25 }}>{tr('Products Purchased', 'खरिद गरिएका उत्पादनहरू')}</h3>

          {saleItems.length === 0 ? (
            <p style={{ color: '#667085' }}>{tr('No product details available.', 'उत्पादनको विवरण उपलब्ध छैन।')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                <thead>
                  <tr style={{ background: '#f4f2ed', textAlign: 'left' }}>
                    {[
                      tr('Bill', 'बिल'),
                      tr('Product', 'उत्पादन'),
                      'SKU',
                      tr('Quantity', 'परिमाण'),
                      tr('Unit Price', 'प्रति एकाइ मूल्य'),
                      tr('Line Total', 'जम्मा रकम'),
                    ].map(label => (
                      <th key={label} style={{ padding: 10, borderBottom: '1px solid #ddd' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saleItems.map((item, index) => (
                    <tr key={`${item.sale_id}-${index}`}>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {customerSales.find(s => s.id === item.sale_id)?.bill_number || '—'}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {item.product_name_snapshot}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {item.sku_snapshot || '—'}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {Number(item.quantity).toLocaleString(locale)}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {money(Number(item.unit_price))}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {money(Number(item.line_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ marginTop: 25 }}>{tr('Payment History', 'भुक्तानी इतिहास')}</h3>

          {payments.length === 0 ? (
            <p style={{ color: '#667085' }}>{tr('No payment records found.', 'भुक्तानी रेकर्ड फेला परेन।')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: '#f4f2ed', textAlign: 'left' }}>
                    {[
                      tr('Date', 'मिति'),
                      tr('Bill', 'बिल'),
                      tr('Method', 'विधि'),
                      tr('Reference', 'सन्दर्भ'),
                      tr('Amount', 'रकम'),
                    ].map(label => (
                      <th key={label} style={{ padding: 10, borderBottom: '1px solid #ddd' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {formatDate(payment.payment_date)}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {customerSales.find(s => s.id === payment.sale_id)?.bill_number || '—'}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {tr(payment.payment_method, payment.payment_method === 'cash' ? 'नगद' : payment.payment_method === 'bank' ? 'बैंक' : payment.payment_method === 'card' ? 'कार्ड' : payment.payment_method === 'wallet' ? 'वालेट' : payment.payment_method === 'cheque' ? 'चेक' : payment.payment_method)}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {payment.reference_number || '—'}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {money(Number(payment.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : !showForm ? (
        <div style={cardStyle}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>
              {showInactive ? tr('Inactive Customers', 'निष्क्रिय ग्राहकहरू') : tr('Customer Directory', 'ग्राहक सूची')}
            </h2>

            <button
              style={{ ...buttonStyle, background: '#eef1f5', color: '#172438' }}
              onClick={() => {
                setShowInactive(!showInactive);
                setSearch('');
              }}
            >
              {showInactive ? tr('Show Active Customers', 'सक्रिय ग्राहकहरू देखाउनुहोस्') : tr('Show Inactive Customers', 'निष्क्रिय ग्राहकहरू देखाउनुहोस्')}
            </button>
          </div>

          <input
            style={{ ...inputStyle, marginBottom: 16 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tr('Search name, phone, email or customer code...', 'नाम, फोन, इमेल वा ग्राहक कोड खोज्नुहोस्...')}
          />

          {loading ? (
            <p>{tr('Loading customers...', 'ग्राहकहरू लोड हुँदैछन्...')}</p>
          ) : filteredCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 35, color: '#667085' }}>
              <h3>{tr('No customers found', 'कुनै ग्राहक फेला परेन')}</h3>
              <p>{tr('Add a new customer or change your search.', 'नयाँ ग्राहक थप्नुहोस् वा खोजी परिवर्तन गर्नुहोस्।')}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#f4f2ed', textAlign: 'left' }}>
                    {[
                      tr('Customer', 'ग्राहक'),
                      tr('Phone', 'फोन'),
                      tr('Total Purchases', 'कुल खरिद'),
                      tr('Paid', 'तिरेको'),
                      tr('Balance Due', 'बाँकी रकम'),
                      tr('Actions', 'कार्यहरू'),
                    ].map(label => (
                      <th key={label} style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => (
                    <tr key={customer.id}>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        <button
                          onClick={() => openCustomer(customer)}
                          style={{
                            padding: 0,
                            border: 0,
                            background: 'transparent',
                            color: '#172438',
                            fontWeight: 800,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {customer.full_name}
                        </button>
                        <div style={{ color: '#667085', fontSize: 12, marginTop: 4 }}>
                          {customer.customer_code || tr('No code', 'कोड छैन')} · {customer.email || tr('No email', 'इमेल छैन')}
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        {customer.phone || '—'}
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        {money(totalPurchases(customer.id))}
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        {money(totalPaid(customer.id))}
                      </td>
                      <td style={{
                        padding: 12,
                        borderBottom: '1px solid #eee',
                        color: totalDue(customer) > 0 ? '#b54708' : '#067647',
                        fontWeight: 700,
                      }}>
                        {money(totalDue(customer))}
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            style={{ ...buttonStyle, padding: '7px 10px', background: '#eef1f5', color: '#172438' }}
                            onClick={() => openCustomer(customer)}
                          >
                            {tr('View', 'हेर्नुहोस्')}
                          </button>
                          {!showInactive && (
                            <button
                              style={{ ...buttonStyle, padding: '7px 10px', background: '#fff4e5', color: '#9a6700' }}
                              onClick={() => startEditCustomer(customer)}
                            >
                              {tr('Edit', 'सम्पादन')}
                            </button>
                          )}
                          <button
                            style={{
                              ...buttonStyle,
                              padding: '7px 10px',
                              background: showInactive ? '#ecfdf3' : '#fff0f0',
                              color: showInactive ? '#067647' : '#b42318',
                            }}
                            onClick={() => toggleCustomerStatus(customer)}
                          >
                            {showInactive ? tr('Restore', 'पुनर्स्थापना') : tr('Deactivate', 'निष्क्रिय')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 14, color: '#667085', fontSize: 12 }}>
            {tr('Showing', 'देखाइँदैछ')} {filteredCustomers.length.toLocaleString(locale)} {tr('customer(s). Customer records are kept when deactivated.', 'ग्राहक(हरू)। निष्क्रिय गर्दा पनि ग्राहकको रेकर्ड सुरक्षित रहन्छ।')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
