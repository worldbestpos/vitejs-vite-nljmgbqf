
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type Props = {
  companyId: string;
  branchId: string;
  currency: string;
};

type Customer = {
  id: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  selling_price: number;
  tax_rate: number;
};

type QuoteItem = {
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
};

type Quote = {
  id: string;
  quote_number: string;
  status: string;
  quote_date: string;
  valid_until: string | null;
  total_amount: number;
  customer_id: string | null;
  customers?: {
    full_name: string;
    company_name: string | null;
  }[] | null;
};

const money = (value: number, currency: string) =>
  `${currency} ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function WholesaleQuotes({
  companyId,
  branchId,
  currency,
}: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [customerResult, productResult, quoteResult] =
        await Promise.all([
          supabase
            .from('customers')
            .select('id, full_name, company_name, phone')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('full_name'),

          supabase
            .from('products')
            .select(
              'id, product_name, sku, barcode, unit, selling_price, tax_rate'
            )
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('product_name'),

          supabase
            .from('wholesale_quotes')
            .select(`
              id,
              quote_number,
              status,
              quote_date,
              valid_until,
              total_amount,
              customer_id,
              customers (
                full_name,
                company_name
              )
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false }),
        ]);

      if (customerResult.error) throw customerResult.error;
      if (productResult.error) throw productResult.error;
      if (quoteResult.error) throw quoteResult.error;

      setCustomers((customerResult.data || []) as Customer[]);
      setProducts((productResult.data || []) as Product[]);
      setQuotes((quoteResult.data || []) as Quote[]);
    } catch (err: any) {
      setError(err.message || 'Unable to load quotation data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [companyId]);

  const selectedProduct = products.find(p => p.id === productId);

  useEffect(() => {
    if (selectedProduct) {
      setUnitPrice(String(selectedProduct.selling_price));
    } else {
      setUnitPrice('');
    }
  }, [productId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    const discountTotal = items.reduce(
      (sum, item) => sum + item.discount,
      0
    );

    const taxableAmount = Math.max(0, subtotal - discountTotal);

    const taxTotal = items.reduce((sum, item) => {
      const lineBase = Math.max(
        0,
        item.quantity * item.unit_price - item.discount
      );
      return sum + lineBase * item.tax_rate / 100;
    }, 0);

    return {
      subtotal,
      discount: discountTotal,
      tax: taxTotal,
      total: taxableAmount + taxTotal,
    };
  }, [items]);

  function addProduct() {
    setError('');
    setMessage('');

    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }

    const qty = Number(quantity);
    const price = Number(unitPrice);
    const discountValue = Number(discount);

    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a valid quantity.');
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid unit price.');
      return;
    }

    if (
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      discountValue > qty * price
    ) {
      setError('Enter a valid line discount.');
      return;
    }

    const existingIndex = items.findIndex(
      item => item.product_id === selectedProduct.id
    );

    const newItem: QuoteItem = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.product_name,
      sku: selectedProduct.sku || '',
      unit: selectedProduct.unit || 'pcs',
      quantity: qty,
      unit_price: price,
      discount: discountValue,
      tax_rate: Number(selectedProduct.tax_rate || 0),
    };

    if (existingIndex >= 0) {
      setItems(previous =>
        previous.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: item.quantity + qty,
                unit_price: price,
                discount: item.discount + discountValue,
              }
            : item
        )
      );
    } else {
      setItems(previous => [...previous, newItem]);
    }

    setProductId('');
    setQuantity('1');
    setDiscount('0');
    setMessage('Product added to quotation.');
  }

  function removeItem(index: number) {
    setItems(previous => previous.filter((_, i) => i !== index));
  }

  function updateItem(
    index: number,
    field: 'quantity' | 'unit_price',
    value: number
  ) {
    if (!Number.isFinite(value) || value < 0) return;

    setItems(previous =>
      previous.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!customerId) {
      setError('Please select a customer.');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one product.');
      return;
    }

    if (totals.total < 0) {
      setError('The quotation total is invalid.');
      return;
    }

    setSaving(true);

    try {
      const { data: authData } = await supabase.auth.getUser();

      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
      const quoteNumber = `DRG-Q-${datePart}-${randomPart}`;

      const { data: quote, error: quoteError } = await supabase
        .from('wholesale_quotes')
        .insert({
          company_id: companyId,
          branch_id: branchId,
          customer_id: customerId,
          quote_number: quoteNumber,
          status: 'draft',
          quote_date: new Date().toISOString().slice(0, 10),
          valid_until: validUntil || null,
          subtotal: totals.subtotal,
          discount_amount: totals.discount,
          tax_amount: totals.tax,
          total_amount: totals.total,
          notes: notes.trim() || null,
          created_by: authData.user?.id || null,
        })
        .select('id')
        .single();

      if (quoteError) throw quoteError;

      const itemRows = items.map(item => {
        const lineSubtotal = item.quantity * item.unit_price;
        const taxable = Math.max(0, lineSubtotal - item.discount);
        const taxAmount = taxable * item.tax_rate / 100;

        return {
          company_id: companyId,
          quote_id: quote.id,
          product_id: item.product_id,
          product_name_snapshot: item.product_name,
          sku_snapshot: item.sku || null,
          unit_snapshot: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount,
          tax_rate: item.tax_rate,
          tax_amount: taxAmount,
          line_total: taxable + taxAmount,
        };
      });

      const { error: itemError } = await supabase
        .from('wholesale_quote_items')
        .insert(itemRows);

      if (itemError) {
        await supabase
          .from('wholesale_quotes')
          .delete()
          .eq('id', quote.id)
          .eq('company_id', companyId);

        throw itemError;
      }

      setMessage(`Quotation ${quoteNumber} saved successfully.`);
      setItems([]);
      setCustomerId('');
      setValidUntil('');
      setNotes('');
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to save quotation.');
    } finally {
      setSaving(false);
    }
  }

  async function printQuote(quote: Quote) {
    const { data, error: itemError } = await supabase
      .from('wholesale_quote_items')
      .select('*')
      .eq('quote_id', quote.id)
      .eq('company_id', companyId);

    if (itemError) {
      setError(itemError.message);
      return;
    }

    const customer = customers.find(c => c.id === quote.customer_id);
    const rows = (data || []).map((item: any) => `
      <tr>
        <td>${escapeHtml(item.product_name_snapshot)}</td>
        <td>${escapeHtml(item.sku_snapshot || '-')}</td>
        <td>${Number(item.quantity).toLocaleString()}</td>
        <td>${money(Number(item.unit_price), currency)}</td>
        <td>${money(Number(item.line_total), currency)}</td>
      </tr>
    `).join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <title>${escapeHtml(quote.quote_number)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 35px; color: #222; }
          h1 { margin-bottom: 4px; }
          .muted { color: #666; }
          .top { display: flex; justify-content: space-between; gap: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 25px; }
          th, td { border-bottom: 1px solid #ddd; padding: 11px 8px; text-align: left; }
          th { background: #f3f3f3; }
          .total { margin: 25px 0 0 auto; width: 280px; }
          .total div { display: flex; justify-content: space-between; padding: 6px; }
          .grand { font-size: 20px; font-weight: bold; border-top: 2px solid #222; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Print quotation</button>
        <div class="top">
          <div>
            <h1>D.R GLOBAL</h1>
            <div class="muted">D.R GLOBAL BUSINESS SUITE</div>
            <h2>QUOTATION</h2>
          </div>
          <div>
            <strong>Quotation:</strong> ${escapeHtml(quote.quote_number)}<br/>
            <strong>Date:</strong> ${escapeHtml(quote.quote_date)}<br/>
            <strong>Valid until:</strong> ${escapeHtml(quote.valid_until || 'Not specified')}
          </div>
        </div>
        <hr/>
        <h3>Customer</h3>
        <strong>${escapeHtml(customer?.company_name || customer?.full_name || 'Customer')}</strong><br/>
        ${escapeHtml(customer?.full_name || '')}<br/>
        ${escapeHtml(customer?.phone || '')}
        <table>
          <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total">
          <div><span>Subtotal</span><strong>${money(Number(quote.total_amount) - 0, currency)}</strong></div>
          <div class="grand"><span>Total</span><strong>${money(Number(quote.total_amount), currency)}</strong></div>
        </div>
        <p class="muted">This quotation is not an invoice. Stock is not reserved by this quotation.</p>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Please allow pop-ups to print quotations.');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
  }

  function escapeHtml(value: unknown) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char));
  }

  const filteredProducts = products.filter(product => {
    const term = search.toLowerCase();
    return (
      product.product_name.toLowerCase().includes(term) ||
      (product.sku || '').toLowerCase().includes(term) ||
      (product.barcode || '').toLowerCase().includes(term)
    );
  });

  const styles = {
    page: { display: 'grid', gap: 18 } as const,
    panel: {
      background: 'var(--panel, #fff)',
      border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 14,
      padding: 18,
    } as const,
    button: {
      border: 0,
      borderRadius: 9,
      padding: '10px 15px',
      background: 'var(--accent, #7655E8)',
      color: '#fff',
      fontWeight: 700,
      cursor: 'pointer',
    } as const,
    input: {
      width: '100%',
      padding: 11,
      borderRadius: 8,
      border: '1px solid var(--border, #ddd)',
      background: 'var(--bg, #fff)',
      color: 'var(--text-h, #222)',
      boxSizing: 'border-box' as const,
    },
    muted: { color: 'var(--text, #777)', fontSize: 13 } as const,
  };

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Wholesale Quotations</h2>
          <p style={styles.muted}>Create and manage B2B customer quotations.</p>
        </div>
        <button
          style={styles.button}
          onClick={() => {
            setShowForm(!showForm);
            setError('');
            setMessage('');
          }}
        >
          {showForm ? 'Close Form' : '+ Create Quotation'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 9, background: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{ padding: 12, borderRadius: 9, background: '#dcfce7', color: '#166534' }}>
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={saveQuote} style={{ ...styles.panel, display: 'grid', gap: 16 }}>
          <h3 style={{ margin: 0 }}>Create New Quotation</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label>
              <span style={styles.muted}>B2B Customer *</span>
              <select
                required
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                style={styles.input}
              >
                <option value="">Select customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name
                      ? `${customer.company_name} — ${customer.full_name}`
                      : customer.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span style={styles.muted}>Quotation valid until</span>
              <input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                style={styles.input}
              />
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--border, #ddd)', paddingTop: 14 }}>
            <h4>Add Products</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <label style={{ gridColumn: 'span 2' }}>
                <span style={styles.muted}>Search product</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Product name, SKU or barcode"
                  style={styles.input}
                />
              </label>

              <label style={{ gridColumn: 'span 2' }}>
                <span style={styles.muted}>Product</span>
                <select
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Select product</option>
                  {filteredProducts.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.product_name} — {product.sku || 'No SKU'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span style={styles.muted}>Quantity</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label>
                <span style={styles.muted}>Unit price ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label>
                <span style={styles.muted}>Line discount ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  style={styles.input}
                />
              </label>

              <button
                type="button"
                style={{ ...styles.button, alignSelf: 'end' }}
                onClick={addProduct}
              >
                + Add Product
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #ddd)' }}>
                  <th style={{ padding: 9 }}>Product</th>
                  <th style={{ padding: 9 }}>Qty</th>
                  <th style={{ padding: 9 }}>Unit price</th>
                  <th style={{ padding: 9 }}>Discount</th>
                  <th style={{ padding: 9 }}>Line total</th>
                  <th style={{ padding: 9 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const lineTotal = Math.max(
                    0,
                    item.quantity * item.unit_price - item.discount
                  );
                  return (
                    <tr key={`${item.product_id}-${index}`} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                      <td style={{ padding: 9 }}>
                        <strong>{item.product_name}</strong>
                        <div style={styles.muted}>{item.sku || item.unit}</div>
                      </td>
                      <td style={{ padding: 9 }}>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                          style={{ ...styles.input, width: 85 }}
                        />
                      </td>
                      <td style={{ padding: 9 }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={e => updateItem(index, 'unit_price', Number(e.target.value))}
                          style={{ ...styles.input, width: 110 }}
                        />
                      </td>
                      <td style={{ padding: 9 }}>{money(item.discount, currency)}</td>
                      <td style={{ padding: 9 }}>
                        <strong>{money(lineTotal, currency)}</strong>
                      </td>
                      <td style={{ padding: 9 }}>
                        <button type="button" onClick={() => removeItem(index)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No products added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <label>
            <span style={styles.muted}>Quotation notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Delivery details, payment notes or other terms..."
              style={styles.input}
            />
          </label>

          <div style={{ marginLeft: 'auto', width: 'min(100%, 340px)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span><strong>{money(totals.subtotal, currency)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount</span><strong>{money(totals.discount, currency)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tax</span><strong>{money(totals.tax, currency)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, borderTop: '2px solid var(--border, #ddd)', paddingTop: 10 }}>
              <strong>Grand Total</strong>
              <strong>{money(totals.total, currency)}</strong>
            </div>
          </div>

          <button type="submit" disabled={saving} style={{ ...styles.button, justifySelf: 'end', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Quotation as Draft'}
          </button>
        </form>
      )}

      <div style={styles.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Quotation History</h3>
          <button type="button" onClick={loadData}>Refresh</button>
        </div>

        {loading ? (
          <p>Loading quotations...</p>
        ) : quotes.length === 0 ? (
          <p style={styles.muted}>No quotations created yet. Click Create Quotation to begin.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #ddd)' }}>
                  <th style={{ padding: 10 }}>Quotation</th>
                  <th style={{ padding: 10 }}>Date</th>
                  <th style={{ padding: 10 }}>Customer</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>Total</th>
                  <th style={{ padding: 10 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(quote => {
                  const customer = customers.find(c => c.id === quote.customer_id);
                  return (
                    <tr key={quote.id} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                      <td style={{ padding: 10 }}><strong>{quote.quote_number}</strong></td>
                      <td style={{ padding: 10 }}>{quote.quote_date}</td>
                      <td style={{ padding: 10 }}>{customer?.company_name || customer?.full_name || 'Customer'}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '4px 9px', borderRadius: 20, fontSize: 12 }}>
                          {quote.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}><strong>{money(Number(quote.total_amount), currency)}</strong></td>
                      <td style={{ padding: 10 }}>
                        <button type="button" onClick={() => printQuote(quote)}>Print</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={styles.muted}>
        Quotations are drafts only. Saving a quotation does not reserve stock,
        create an invoice or change inventory quantities.
      </p>
    </div>
  );
}
