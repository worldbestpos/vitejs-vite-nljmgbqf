
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

type Props = {
  companyId: string;
  branchId: string;
  currency: string;
  initialTab?: string;
};

type Supplier = {
  id: string;
  supplier_name: string;
  supplier_code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  notes: string | null;
  is_active: boolean;
};

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  unit: string;
  purchase_price: number;
  track_stock: boolean;
};

type Purchase = {
  id: string;
  purchase_number: string;
  supplier_invoice_number: string | null;
  supplier_id: string | null;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: string;
  suppliers?: { supplier_name: string }[] | null;
};

type PurchaseLine = {
  product_id: string;
  quantity: string;
  unit_cost: string;
  discount_amount: string;
  tax_amount: string;
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box' as const,
  background: '#fff',
};

const buttonStyle = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: 8,
  background: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 18,
};

export default function SuppliersPurchases({
  companyId,
  branchId,
  currency,
  initialTab = 'Suppliers',
}: Props) {
  const { language } = useLanguage();
  const ne = language === 'ne';

  const tr = (english: string, nepali: string) =>
    ne ? nepali : english;

  const money = (value: number) =>
    `${currency} ${Number(value || 0).toLocaleString(
      ne ? 'ne-NP' : 'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  const [tab, setTab] = useState(
    initialTab === 'Purchases' ? 'History' : 'Suppliers'
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [supplierForm, setSupplierForm] = useState({
    supplier_name: '',
    supplier_code: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    opening_balance: '0',
    notes: '',
  });

  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);

  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  const [lines, setLines] = useState<PurchaseLine[]>([
    {
      product_id: '',
      quantity: '1',
      unit_cost: '0',
      discount_amount: '0',
      tax_amount: '0',
    },
  ]);

  const [paymentPurchase, setPaymentPurchase] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodForDue, setPaymentMethodForDue] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [search, setSearch] = useState('');

  const paymentMethods = [
    { value: 'cash', label: tr('Cash', 'नगद') },
    { value: 'bank', label: tr('Bank Transfer', 'बैंक ट्रान्सफर') },
    { value: 'card', label: tr('Card', 'कार्ड') },
    { value: 'wallet', label: tr('Digital Wallet', 'डिजिटल वालेट') },
    { value: 'cheque', label: tr('Cheque', 'चेक') },
    { value: 'other', label: tr('Other', 'अन्य') },
  ];

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [supplierResult, productResult, purchaseResult] =
        await Promise.all([
          supabase
            .from('suppliers')
            .select('*')
            .eq('company_id', companyId)
            .order('supplier_name'),

          supabase
            .from('products')
            .select('id,product_name,sku,unit,purchase_price,track_stock')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('product_name'),

          supabase
            .from('purchases')
            .select(`
              id,
              purchase_number,
              supplier_invoice_number,
              supplier_id,
              purchase_date,
              total_amount,
              paid_amount,
              due_amount,
              status,
              suppliers(supplier_name)
            `)
            .eq('company_id', companyId)
            .eq('branch_id', branchId)
            .order('purchase_date', { ascending: false })
            .limit(200),
        ]);

      if (supplierResult.error) throw supplierResult.error;
      if (productResult.error) throw productResult.error;
      if (purchaseResult.error) throw purchaseResult.error;

      setSuppliers((supplierResult.data || []) as Supplier[]);
      setProducts((productResult.data || []) as Product[]);
      setPurchases((purchaseResult.data || []) as Purchase[]);
    } catch (err: any) {
      setError(err.message || tr(
        'Unable to load supplier and purchase data.',
        'आपूर्तिकर्ता तथा खरिद विवरण लोड गर्न सकिएन।'
      ));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [companyId, branchId]);

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((s) =>
        `${s.supplier_name} ${s.phone || ''} ${s.supplier_code || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [suppliers, search]
  );

  const purchaseTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const quantity = Number(line.quantity) || 0;
        const cost = Number(line.unit_cost) || 0;
        const discount = Number(line.discount_amount) || 0;
        const tax = Number(line.tax_amount) || 0;
        return sum + quantity * cost - discount + tax;
      }, 0),
    [lines]
  );

  const totalDue = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.due_amount || 0),
    0
  );

  const totalPaid = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.paid_amount || 0),
    0
  );

  const activeSuppliers = suppliers.filter((s) => s.is_active).length;

  function updateLine(index: number, field: keyof PurchaseLine, value: string) {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;

        if (field === 'product_id') {
          const product = products.find((p) => p.id === value);
          return {
            ...line,
            product_id: value,
            unit_cost: product ? String(product.purchase_price || 0) : '0',
          };
        }

        return { ...line, [field]: value };
      })
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        product_id: '',
        quantity: '1',
        unit_cost: '0',
        discount_amount: '0',
        tax_amount: '0',
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  function resetSupplierForm() {
    setSupplierForm({
      supplier_name: '',
      supplier_code: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      opening_balance: '0',
      notes: '',
    });
  }

  async function saveSupplier(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supplierForm.supplier_name.trim()) {
      setError(tr('Enter the supplier name.', 'आपूर्तिकर्ताको नाम लेख्नुहोस्।'));
      return;
    }

    setSaving(true);

    const payload = {
      company_id: companyId,
      supplier_name: supplierForm.supplier_name.trim(),
      supplier_code: supplierForm.supplier_code.trim() || null,
      contact_person: supplierForm.contact_person.trim() || null,
      phone: supplierForm.phone.trim() || null,
      email: supplierForm.email.trim() || null,
      address: supplierForm.address.trim() || null,
      opening_balance: Number(supplierForm.opening_balance) || 0,
      notes: supplierForm.notes.trim() || null,
    };

    try {
      const result = editingSupplier
        ? await supabase
            .from('suppliers')
            .update(payload)
            .eq('id', editingSupplier)
            .eq('company_id', companyId)
        : await supabase.from('suppliers').insert(payload);

      if (result.error) throw result.error;

      setSuccess(
        editingSupplier
          ? tr('Supplier updated successfully.', 'आपूर्तिकर्ता सफलतापूर्वक अपडेट भयो।')
          : tr('Supplier added successfully.', 'आपूर्तिकर्ता सफलतापूर्वक थपियो।')
      );

      resetSupplierForm();
      setEditingSupplier(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || tr('Unable to save supplier.', 'आपूर्तिकर्ता सेभ गर्न सकिएन।'));
    } finally {
      setSaving(false);
    }
  }

  function editSupplier(supplier: Supplier) {
    setEditingSupplier(supplier.id);
    setSupplierForm({
      supplier_name: supplier.supplier_name || '',
      supplier_code: supplier.supplier_code || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      opening_balance: String(supplier.opening_balance || 0),
      notes: supplier.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createPurchase(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!purchaseSupplier) {
      setError(tr('Select a supplier.', 'आपूर्तिकर्ता छान्नुहोस्।'));
      return;
    }

    const validLines = lines.filter(
      (line) =>
        line.product_id &&
        Number(line.quantity) > 0 &&
        Number(line.unit_cost) >= 0
    );

    if (!validLines.length) {
      setError(tr('Add at least one valid product.', 'कम्तीमा एउटा मान्य उत्पादन थप्नुहोस्।'));
      return;
    }

    if (Number(paidAmount) < 0 || Number(paidAmount) > purchaseTotal) {
      setError(tr(
        'Paid amount cannot exceed the purchase total.',
        'तिरेको रकम खरिदको कुल रकमभन्दा बढी हुन सक्दैन।'
      ));
      return;
    }

    setSaving(true);

    const items = validLines.map((line) => ({
      product_id: line.product_id,
      quantity: Number(line.quantity),
      unit_cost: Number(line.unit_cost),
      discount_amount: Number(line.discount_amount) || 0,
      tax_amount: Number(line.tax_amount) || 0,
    }));

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'pos_create_purchase',
        {
          p_company_id: companyId,
          p_branch_id: branchId,
          p_supplier_id: purchaseSupplier,
          p_supplier_invoice_number: invoiceNumber || null,
          p_items: items,
          p_paid_amount: Number(paidAmount) || 0,
          p_payment_method: paymentMethod,
          p_purchase_date: new Date(
            `${purchaseDate}T12:00:00+05:45`
          ).toISOString(),
          p_notes: purchaseNotes || null,
        }
      );

      if (rpcError) throw rpcError;

      setSuccess(
        tr('Purchase ', 'खरिद ') +
        data.purchase_number +
        tr(
          ' saved successfully. Stock has been updated.',
          ' सफलतापूर्वक सेभ भयो। स्टक अपडेट गरिएको छ।'
        )
      );

      setPurchaseSupplier('');
      setInvoiceNumber('');
      setPaidAmount('0');
      setPurchaseNotes('');
      setLines([
        {
          product_id: '',
          quantity: '1',
          unit_cost: '0',
          discount_amount: '0',
          tax_amount: '0',
        },
      ]);

      await loadData();
      setTab('History');
    } catch (err: any) {
      setError(err.message || tr('Unable to save purchase.', 'खरिद सेभ गर्न सकिएन।'));
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!paymentPurchase || Number(paymentAmount) <= 0) {
      setError(tr(
        'Select a purchase and enter a valid payment.',
        'खरिद छान्नुहोस् र मान्य भुक्तानी रकम लेख्नुहोस्।'
      ));
      return;
    }

    setSaving(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'pos_record_purchase_payment',
        {
          p_company_id: companyId,
          p_branch_id: branchId,
          p_purchase_id: paymentPurchase,
          p_amount: Number(paymentAmount),
          p_payment_method: paymentMethodForDue,
          p_reference_number: paymentReference || null,
          p_notes: null,
        }
      );

      if (rpcError) throw rpcError;

      setSuccess(
        tr('Payment recorded. Remaining balance: ', 'भुक्तानी रेकर्ड भयो। बाँकी रकम: ') +
        money(Number(data.due_amount))
      );

      setPaymentPurchase('');
      setPaymentAmount('');
      setPaymentReference('');
      await loadData();
    } catch (err: any) {
      setError(err.message || tr('Unable to record payment.', 'भुक्तानी रेकर्ड गर्न सकिएन।'));
    } finally {
      setSaving(false);
    }
  }

  function supplierBalance(supplierId: string) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    const purchaseDue = purchases
      .filter((p) => p.supplier_id === supplierId)
      .reduce((sum, p) => sum + Number(p.due_amount || 0), 0);

    return Number(supplier?.opening_balance || 0) + purchaseDue;
  }

  const tabButton = (name: string) => ({
    padding: '10px 15px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    background: tab === name ? '#2563eb' : '#f3f4f6',
    color: tab === name ? '#fff' : '#374151',
  });

  const dateLocale = ne ? 'ne-NP' : 'en-IN';

  return (
    <div style={{ display: 'grid', gap: 18, color: '#111827' }}>
      <div>
        <h2 style={{ margin: 0 }}>
          {tr('Suppliers & Purchases', 'आपूर्तिकर्ता तथा खरिद')}
        </h2>
        <p style={{ color: '#6b7280', marginTop: 6 }}>
          {tr(
            'Manage suppliers, purchase stock and supplier payments.',
            'आपूर्तिकर्ता, खरिद स्टक तथा आपूर्तिकर्ताको भुक्तानी व्यवस्थापन गर्नुहोस्।'
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { name: 'Suppliers', label: tr('Suppliers', 'आपूर्तिकर्ता') },
          { name: 'New Purchase', label: tr('New Purchase', 'नयाँ खरिद') },
          { name: 'History', label: tr('Purchase History', 'खरिद इतिहास') },
          { name: 'Supplier Balances', label: tr('Supplier Balances', 'आपूर्तिकर्ता बाँकी रकम') },
        ].map(({ name, label }) => (
          <button
            key={name}
            style={tabButton(name)}
            onClick={() => {
              setTab(name);
              setError('');
              setSuccess('');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ ...cardStyle, color: '#b91c1c', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ ...cardStyle, color: '#166534', background: '#f0fdf4' }}>
          {success}
        </div>
      )}

      {loading ? (
        <div style={cardStyle}>{tr('Loading data...', 'विवरण लोड हुँदैछ...')}</div>
      ) : (
        <>
          {tab === 'Suppliers' && (
            <>
              <form onSubmit={saveSupplier} style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>
                  {editingSupplier
                    ? tr('Edit Supplier', 'आपूर्तिकर्ता सम्पादन गर्नुहोस्')
                    : tr('Add New Supplier', 'नयाँ आपूर्तिकर्ता थप्नुहोस्')}
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                    gap: 12,
                  }}
                >
                  <input
                    style={inputStyle}
                    placeholder={tr('Supplier name *', 'आपूर्तिकर्ताको नाम *')}
                    value={supplierForm.supplier_name}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        supplier_name: e.target.value,
                      })
                    }
                    required
                  />
                  <input
                    style={inputStyle}
                    placeholder={tr('Supplier code', 'आपूर्तिकर्ता कोड')}
                    value={supplierForm.supplier_code}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        supplier_code: e.target.value,
                      })
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder={tr('Contact person', 'सम्पर्क व्यक्ति')}
                    value={supplierForm.contact_person}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        contact_person: e.target.value,
                      })
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder={tr('Phone', 'फोन नम्बर')}
                    value={supplierForm.phone}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        phone: e.target.value,
                      })
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder={tr('Email', 'इमेल')}
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        email: e.target.value,
                      })
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder={tr('Address', 'ठेगाना')}
                    value={supplierForm.address}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        address: e.target.value,
                      })
                    }
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={tr('Opening balance', 'सुरुवाती बाँकी रकम')}
                    value={supplierForm.opening_balance}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        opening_balance: e.target.value,
                      })
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder={tr('Notes', 'कैफियत')}
                    value={supplierForm.notes}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button style={buttonStyle} disabled={saving}>
                    {saving
                      ? tr('Saving...', 'सेभ हुँदैछ...')
                      : editingSupplier
                        ? tr('Update Supplier', 'आपूर्तिकर्ता अपडेट गर्नुहोस्')
                        : tr('Save Supplier', 'आपूर्तिकर्ता सेभ गर्नुहोस्')}
                  </button>

                  {editingSupplier && (
                    <button
                      type="button"
                      style={{ ...buttonStyle, background: '#6b7280' }}
                      onClick={() => {
                        setEditingSupplier(null);
                        resetSupplierForm();
                      }}
                    >
                      {tr('Cancel', 'रद्द गर्नुहोस्')}
                    </button>
                  )}
                </div>
              </form>

              <div style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    {tr('Supplier List', 'आपूर्तिकर्ता सूची')} ({suppliers.length})
                  </h3>
                  <input
                    style={{ ...inputStyle, maxWidth: 260 }}
                    placeholder={tr('Search suppliers...', 'आपूर्तिकर्ता खोज्नुहोस्...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div style={{ overflowX: 'auto', marginTop: 14 }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: 650,
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                        {[
                          tr('Supplier', 'आपूर्तिकर्ता'),
                          tr('Phone', 'फोन'),
                          tr('Contact', 'सम्पर्क व्यक्ति'),
                          tr('Balance', 'बाँकी रकम'),
                          tr('Status', 'स्थिति'),
                          tr('Action', 'कार्य'),
                        ].map((heading) => (
                          <th key={heading} style={{ padding: 11 }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.map((supplier) => (
                        <tr key={supplier.id}>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            <strong>{supplier.supplier_name}</strong>
                            <div style={{ color: '#6b7280', fontSize: 12 }}>
                              {supplier.supplier_code || ''}
                            </div>
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {supplier.phone || '-'}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {supplier.contact_person || '-'}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {money(supplierBalance(supplier.id))}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {supplier.is_active
                              ? tr('Active', 'सक्रिय')
                              : tr('Inactive', 'निष्क्रिय')}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            <button
                              style={{ ...buttonStyle, padding: '6px 10px' }}
                              onClick={() => editSupplier(supplier)}
                            >
                              {tr('Edit', 'सम्पादन')}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredSuppliers.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: 20, textAlign: 'center' }}>
                            {tr('No suppliers found.', 'कुनै आपूर्तिकर्ता भेटिएन।')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === 'New Purchase' && (
            <form onSubmit={createPurchase} style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>
                {tr('Create Purchase', 'खरिद सिर्जना गर्नुहोस्')}
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                  gap: 12,
                }}
              >
                <select
                  style={inputStyle}
                  value={purchaseSupplier}
                  onChange={(e) => setPurchaseSupplier(e.target.value)}
                  required
                >
                  <option value="">{tr('Select supplier *', 'आपूर्तिकर्ता छान्नुहोस् *')}</option>
                  {suppliers
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name}
                      </option>
                    ))}
                </select>

                <input
                  style={inputStyle}
                  placeholder={tr('Supplier invoice number', 'आपूर्तिकर्ताको बिल नम्बर')}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />

                <input
                  style={inputStyle}
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
              </div>

              <h4 style={{ marginBottom: 10 }}>
                {tr('Purchase Products', 'खरिद गरिएका उत्पादनहरू')}
              </h4>

              <div style={{ display: 'grid', gap: 12 }}>
                {lines.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
                        gap: 10,
                      }}
                    >
                      <select
                        style={inputStyle}
                        value={line.product_id}
                        onChange={(e) =>
                          updateLine(index, 'product_id', e.target.value)
                        }
                        required
                      >
                        <option value="">{tr('Select product *', 'उत्पादन छान्नुहोस् *')}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.product_name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>

                      <input
                        style={inputStyle}
                        type="number"
                        min="0.001"
                        step="0.001"
                        placeholder={tr('Quantity', 'परिमाण')}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(index, 'quantity', e.target.value)
                        }
                        required
                      />

                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={tr('Unit cost', 'प्रति एकाइ लागत')}
                        value={line.unit_cost}
                        onChange={(e) =>
                          updateLine(index, 'unit_cost', e.target.value)
                        }
                        required
                      />

                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={tr('Discount amount', 'छुट रकम')}
                        value={line.discount_amount}
                        onChange={(e) =>
                          updateLine(index, 'discount_amount', e.target.value)
                        }
                      />

                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={tr('Tax amount', 'कर रकम')}
                        value={line.tax_amount}
                        onChange={(e) =>
                          updateLine(index, 'tax_amount', e.target.value)
                        }
                      />

                      <button
                        type="button"
                        style={{ ...buttonStyle, background: '#dc2626' }}
                        disabled={lines.length === 1}
                        onClick={() => removeLine(index)}
                      >
                        {tr('Remove', 'हटाउनुहोस्')}
                      </button>
                    </div>

                    <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
                      {tr('Line total:', 'लाइन जम्मा:')}{' '}
                      <strong>
                        {money(
                          Math.max(
                            0,
                            Number(line.quantity || 0) *
                              Number(line.unit_cost || 0) -
                              Number(line.discount_amount || 0) +
                              Number(line.tax_amount || 0)
                          )
                        )}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                style={{ ...buttonStyle, background: '#4b5563', marginTop: 12 }}
                onClick={addLine}
              >
                + {tr('Add Another Product', 'अर्को उत्पादन थप्नुहोस्')}
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                  gap: 12,
                  marginTop: 20,
                }}
              >
                <div>
                  <label>{tr('Amount Paid', 'तिरेको रकम')}</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label>{tr('Payment Method', 'भुक्तानी विधि')}</label>
                  <select
                    style={inputStyle}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>{tr('Purchase Notes', 'खरिद सम्बन्धी कैफियत')}</label>
                  <input
                    style={inputStyle}
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder={tr('Optional notes', 'वैकल्पिक कैफियत')}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 10,
                  background: '#f9fafb',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{tr('Purchase Total', 'कुल खरिद रकम')}</span>
                  <strong>{money(purchaseTotal)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{tr('Paid Now', 'अहिले तिरेको')}</span>
                  <strong>{money(Number(paidAmount) || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{tr('Remaining Due', 'बाँकी तिर्नुपर्ने')}</span>
                  <strong>
                    {money(
                      Math.max(0, purchaseTotal - (Number(paidAmount) || 0))
                    )}
                  </strong>
                </div>
              </div>

              <button
                style={{ ...buttonStyle, marginTop: 16 }}
                disabled={saving || products.length === 0 || suppliers.length === 0}
              >
                {saving
                  ? tr('Saving Purchase...', 'खरिद सेभ हुँदैछ...')
                  : tr('Save Purchase & Receive Stock', 'खरिद सेभ गरी स्टक प्राप्त गर्नुहोस्')}
              </button>
            </form>
          )}

          {tab === 'History' && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                  gap: 12,
                }}
              >
                <div style={cardStyle}>
                  <div style={{ color: '#6b7280' }}>
                    {tr('Total Purchases', 'कुल खरिद')}
                  </div>
                  <h2>{purchases.length}</h2>
                </div>
                <div style={cardStyle}>
                  <div style={{ color: '#6b7280' }}>
                    {tr('Total Paid', 'कुल भुक्तानी')}
                  </div>
                  <h2>{money(totalPaid)}</h2>
                </div>
                <div style={cardStyle}>
                  <div style={{ color: '#6b7280' }}>
                    {tr('Outstanding Due', 'तिर्न बाँकी रकम')}
                  </div>
                  <h2 style={{ color: '#dc2626' }}>
                    {money(totalDue)}
                  </h2>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>
                  {tr('Purchase History', 'खरिद इतिहास')}
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: 750,
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                        {[
                          tr('Purchase No.', 'खरिद नम्बर'),
                          tr('Date', 'मिति'),
                          tr('Supplier', 'आपूर्तिकर्ता'),
                          tr('Total', 'जम्मा'),
                          tr('Paid', 'तिरेको'),
                          tr('Due', 'बाँकी'),
                          tr('Status', 'स्थिति'),
                        ].map((heading) => (
                          <th key={heading} style={{ padding: 11 }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((purchase) => (
                        <tr key={purchase.id}>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            <strong>{purchase.purchase_number}</strong>
                            <div style={{ color: '#6b7280', fontSize: 12 }}>
                              {purchase.supplier_invoice_number || ''}
                            </div>
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {new Date(purchase.purchase_date).toLocaleDateString(dateLocale)}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {purchase.suppliers?.[0]?.supplier_name||
                              tr('Supplier unavailable', 'आपूर्तिकर्ता उपलब्ध छैन')}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {money(Number(purchase.total_amount))}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {money(Number(purchase.paid_amount))}
                          </td>
                          <td style={{
                            padding: 11,
                            borderTop: '1px solid #eee',
                            color: Number(purchase.due_amount) > 0 ? '#dc2626' : '#166534'
                          }}>
                            {money(Number(purchase.due_amount))}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {purchase.status === 'cancelled'
                              ? tr('Cancelled', 'रद्द गरिएको')
                              : purchase.status === 'paid'
                                ? tr('Paid', 'भुक्तानी भएको')
                                : purchase.status === 'partial'
                                  ? tr('Partially Paid', 'आंशिक भुक्तानी')
                                  : purchase.status}
                          </td>
                        </tr>
                      ))}
                      {purchases.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 20, textAlign: 'center' }}>
                            {tr('No purchases recorded yet.', 'अहिलेसम्म कुनै खरिद रेकर्ड गरिएको छैन।')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <form onSubmit={recordPayment} style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>
                  {tr('Record Supplier Payment', 'आपूर्तिकर्तालाई भुक्तानी रेकर्ड गर्नुहोस्')}
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                    gap: 12,
                  }}
                >
                  <select
                    style={inputStyle}
                    value={paymentPurchase}
                    onChange={(e) => setPaymentPurchase(e.target.value)}
                    required
                  >
                    <option value="">
                      {tr('Select purchase with due', 'बाँकी रकम भएको खरिद छान्नुहोस्')}
                    </option>
                    {purchases
                      .filter((p) => Number(p.due_amount) > 0 && p.status !== 'cancelled')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.purchase_number} — {tr('Due', 'बाँकी')} {money(Number(p.due_amount))}
                        </option>
                      ))}
                  </select>

                  <input
                    style={inputStyle}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={tr('Payment amount', 'भुक्तानी रकम')}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />

                  <select
                    style={inputStyle}
                    value={paymentMethodForDue}
                    onChange={(e) => setPaymentMethodForDue(e.target.value)}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>

                  <input
                    style={inputStyle}
                    placeholder={tr('Reference number (optional)', 'रेफरेन्स नम्बर (वैकल्पिक)')}
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>

                <button style={{ ...buttonStyle, marginTop: 14 }} disabled={saving}>
                  {saving
                    ? tr('Recording...', 'रेकर्ड हुँदैछ...')
                    : tr('Record Payment', 'भुक्तानी रेकर्ड गर्नुहोस्')}
                </button>
              </form>
            </>
          )}

          {tab === 'Supplier Balances' && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>
                {tr('Supplier Balances', 'आपूर्तिकर्ताको बाँकी रकम')}
              </h3>
              <div style={{ color: '#6b7280', marginBottom: 14 }}>
                {tr(
                  'Balance = opening balance + outstanding purchases. Payments are deducted through the purchase due amount.',
                  'बाँकी रकम = सुरुवाती बाँकी रकम + तिर्न बाँकी खरिद। भुक्तानी गरेपछि खरिदको बाँकी रकम घट्छ।'
                )}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: 550,
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                      <th style={{ padding: 11 }}>{tr('Supplier', 'आपूर्तिकर्ता')}</th>
                      <th style={{ padding: 11 }}>{tr('Opening Balance', 'सुरुवाती बाँकी')}</th>
                      <th style={{ padding: 11 }}>{tr('Purchase Due', 'खरिद बाँकी')}</th>
                      <th style={{ padding: 11 }}>{tr('Total Balance', 'कुल बाँकी')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((supplier) => {
                      const purchaseDue = purchases
                        .filter((p) => p.supplier_id === supplier.id)
                        .reduce((sum, p) => sum + Number(p.due_amount || 0), 0);

                      return (
                        <tr key={supplier.id}>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {supplier.supplier_name}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {money(Number(supplier.opening_balance))}
                          </td>
                          <td style={{ padding: 11, borderTop: '1px solid #eee' }}>
                            {money(purchaseDue)}
                          </td>
                          <td style={{
                            padding: 11,
                            borderTop: '1px solid #eee',
                            fontWeight: 700
                          }}>
                            {money(Number(supplier.opening_balance) + purchaseDue)}
                          </td>
                        </tr>
                      );
                    })}
                    {suppliers.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: 20, textAlign: 'center' }}>
                          {tr('No suppliers found.', 'कुनै आपूर्तिकर्ता भेटिएन।')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ color: '#6b7280', fontSize: 12 }}>
        {tr('Active suppliers:', 'सक्रिय आपूर्तिकर्ता:')} {activeSuppliers}
        {' · '}
        {tr('Products available:', 'उपलब्ध उत्पादनहरू:')} {products.length}
      </div>
    </div>
  );
}
