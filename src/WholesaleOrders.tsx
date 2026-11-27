
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type Props = {
  companyId: string;
  branchId: string;
  currency: string;
};

type Quote = {
  id: string;
  quote_number: string;
  customer_id: string | null;
  status: string;
  quote_date: string;
  total_amount: number;
  notes: string | null;
};

type QuoteItem = {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  sku_snapshot: string | null;
  unit_snapshot: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
};

type Customer = {
  id: string;
  full_name: string;
  company_name: string | null;
};

type Order = {
  id: string;
  order_number: string;
  quote_id: string | null;
  status: string;
  order_date: string;
  total_amount: number;
};

export default function WholesaleOrders({
  companyId,
  branchId,
  currency,
}: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedQuote, setSelectedQuote] = useState('');
  const [selectedItems, setSelectedItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const money = (value: number) =>
    `${currency} ${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const customerName = (id: string | null) => {
    if (!id) return 'Walk-in customer';
    const customer = customers.find((item) => item.id === id);
    return customer
      ? customer.company_name || customer.full_name
      : 'Customer';
  };

  async function loadData() {
    setLoading(true);
    setError('');

    const [quoteResult, orderResult, customerResult] =
      await Promise.all([
        supabase
          .from('wholesale_quotes')
          .select(
            'id, quote_number, customer_id, status, quote_date, total_amount, notes'
          )
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),

        supabase
          .from('wholesale_sales_orders')
          .select('id, order_number, quote_id, status, order_date, total_amount')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),

        supabase
          .from('customers')
          .select('id, full_name, company_name')
          .eq('company_id', companyId),
      ]);

    if (quoteResult.error) {
      setError(quoteResult.error.message);
    } else {
      setQuotes((quoteResult.data || []) as Quote[]);
    }

    if (orderResult.error) {
      setError(orderResult.error.message);
    } else {
      setOrders((orderResult.data || []) as Order[]);
    }

    if (customerResult.error) {
      setError(customerResult.error.message);
    } else {
      setCustomers((customerResult.data || []) as Customer[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [companyId]);

  async function selectQuote(quoteId: string) {
    setSelectedQuote(quoteId);
    setSelectedItems([]);
    setMessage('');
    setError('');

    if (!quoteId) return;

    const { data, error: itemError } = await supabase
      .from('wholesale_quote_items')
      .select(
        'id, quote_id, product_id, product_name_snapshot, sku_snapshot, unit_snapshot, quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total'
      )
      .eq('quote_id', quoteId)
      .eq('company_id', companyId);

    if (itemError) {
      setError(itemError.message);
      return;
    }

    setSelectedItems((data || []) as QuoteItem[]);
  }

  const selectedQuoteData = quotes.find(
    (quote) => quote.id === selectedQuote
  );

  const alreadyConverted = useMemo(
    () =>
      orders.some(
        (order) => order.quote_id === selectedQuote
      ),
    [orders, selectedQuote]
  );

  async function convertToOrder() {
    if (!selectedQuoteData) {
      setError('Please select a quotation first.');
      return;
    }

    if (alreadyConverted) {
      setError('This quotation has already been converted.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('This quotation has no products.');
      return;
    }

    if (
      !['draft', 'sent', 'accepted'].includes(
        selectedQuoteData.status
      )
    ) {
      setError('This quotation cannot be converted in its current status.');
      return;
    }

    const confirmed = window.confirm(
      `Convert quotation ${selectedQuoteData.quote_number} into a Sales Order?`
    );

    if (!confirmed) return;

    setConverting(true);
    setError('');
    setMessage('');

    const orderNumber =
      `SO-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;

    let createdOrderId = '';

    try {
      const { data: order, error: orderError } = await supabase
        .from('wholesale_sales_orders')
        .insert({
          company_id: companyId,
          branch_id: branchId,
          customer_id: selectedQuoteData.customer_id,
          quote_id: selectedQuoteData.id,
          order_number: orderNumber,
          status: 'draft',
          order_date: new Date().toISOString().slice(0, 10),
          subtotal: selectedItems.reduce(
            (sum, item) =>
              sum + Number(item.quantity) * Number(item.unit_price),
            0
          ),
          discount_amount: selectedItems.reduce(
            (sum, item) => sum + Number(item.discount_amount || 0),
            0
          ),
          tax_amount: selectedItems.reduce(
            (sum, item) => sum + Number(item.tax_amount || 0),
            0
          ),
          total_amount: Number(selectedQuoteData.total_amount),
          notes: selectedQuoteData.notes,
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      createdOrderId = order.id;

      const orderItems = selectedItems.map((item) => ({
        company_id: companyId,
        order_id: order.id,
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        sku_snapshot: item.sku_snapshot,
        unit_snapshot: item.unit_snapshot,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
      }));

      const { error: itemsError } = await supabase
        .from('wholesale_sales_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      const { error: quoteUpdateError } = await supabase
        .from('wholesale_quotes')
        .update({
          status: 'converted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedQuoteData.id)
        .eq('company_id', companyId);

      if (quoteUpdateError) throw quoteUpdateError;

      setMessage(
        `Success! ${selectedQuoteData.quote_number} converted to ${orderNumber}.`
      );

      setSelectedQuote('');
      setSelectedItems([]);
      await loadData();
    } catch (err: any) {
      if (createdOrderId) {
        await supabase
          .from('wholesale_sales_orders')
          .delete()
          .eq('id', createdOrderId)
          .eq('company_id', companyId);
      }

      setError(
        err?.message ||
          'Could not convert quotation. Please check your permissions and try again.'
      );
    } finally {
      setConverting(false);
    }
  }

  const statusColor = (status: string) => {
    if (status === 'confirmed' || status === 'shipped' || status === 'invoiced') {
      return '#16a34a';
    }
    if (status === 'cancelled') return '#dc2626';
    if (status === 'draft') return '#64748b';
    return '#d97706';
  };

  if (loading) {
    return <div style={{ padding: 30 }}>Loading sales orders...</div>;
  }

  return (
    <div style={{ padding: 24, color: 'var(--text-h, #172033)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 25 }}>Sales Orders</h2>
          <p style={{ color: '#64748b', marginTop: 7 }}>
            Convert customer quotations into wholesale orders.
          </p>
        </div>

        <button
          onClick={loadData}
          style={{
            padding: '11px 18px',
            border: '1px solid #ddd',
            borderRadius: 9,
            background: 'white',
            cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: '#dcfce7',
            color: '#166534',
            marginBottom: 16,
          }}
        >
          ✓ {message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: '#fee2e2',
            color: '#991b1b',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 14,
          marginBottom: 25,
        }}
      >
        {[
          {
            label: 'Total Orders',
            value: orders.length,
            color: '#2563eb',
            icon: '📦',
          },
          {
            label: 'Draft Orders',
            value: orders.filter((o) => o.status === 'draft').length,
            color: '#64748b',
            icon: '📝',
          },
          {
            label: 'Confirmed',
            value: orders.filter((o) => o.status === 'confirmed').length,
            color: '#16a34a',
            icon: '✓',
          },
          {
            label: 'Order Value',
            value: money(
              orders.reduce(
                (sum, order) => sum + Number(order.total_amount || 0),
                0
              )
            ),
            color: '#9333ea',
            icon: '💰',
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: 19,
              borderRadius: 14,
              border: '1px solid #e5e7eb',
              background: 'var(--card-bg, #fff)',
            }}
          >
            <div style={{ fontSize: 24 }}>{item.icon}</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 9 }}>
              {item.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 750,
                color: item.color,
                marginTop: 5,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: 'var(--card-bg, #fff)',
          border: '1px solid #e5e7eb',
          borderRadius: 15,
          padding: 22,
          marginBottom: 25,
        }}
      >
        <h3 style={{ marginTop: 0 }}>🔄 Convert Quotation to Sales Order</h3>

        <p style={{ color: '#64748b', fontSize: 13 }}>
          Choose a quotation to create a draft order. This step does not
          deduct physical inventory.
        </p>

        <label style={{ display: 'block', fontWeight: 650, marginBottom: 8 }}>
          Select quotation
        </label>

        <select
          value={selectedQuote}
          onChange={(e) => selectQuote(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 9,
            border: '1px solid #d1d5db',
            marginBottom: 17,
            background: 'var(--card-bg, #fff)',
            color: 'inherit',
          }}
        >
          <option value="">Choose a quotation...</option>
          {quotes
            .filter((quote) =>
              ['draft', 'sent', 'accepted'].includes(quote.status)
            )
            .map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.quote_number} — {customerName(quote.customer_id)} —{' '}
                {money(Number(quote.total_amount))}
              </option>
            ))}
        </select>

        {selectedQuoteData && (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: '#f8fafc',
              marginBottom: 18,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {selectedQuoteData.quote_number}
            </div>
            <div style={{ color: '#64748b', marginTop: 5 }}>
              Customer: {customerName(selectedQuoteData.customer_id)}
            </div>
            <div style={{ color: '#64748b', marginTop: 4 }}>
              Date: {selectedQuoteData.quote_date}
            </div>
            <div style={{ fontWeight: 750, marginTop: 10 }}>
              Total: {money(Number(selectedQuoteData.total_amount))}
            </div>

            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 520,
                }}
              >
                <thead>
                  <tr style={{ textAlign: 'left', background: '#eef2ff' }}>
                    <th style={{ padding: 10 }}>Product</th>
                    <th style={{ padding: 10 }}>Qty</th>
                    <th style={{ padding: 10 }}>Unit</th>
                    <th style={{ padding: 10 }}>Price</th>
                    <th style={{ padding: 10 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {item.product_name_snapshot}
                        {item.sku_snapshot && (
                          <div style={{ color: '#94a3b8', fontSize: 12 }}>
                            {item.sku_snapshot}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        {item.unit_snapshot}
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

            {alreadyConverted ? (
              <p style={{ color: '#16a34a', fontWeight: 700 }}>
                ✓ This quotation has already been converted.
              </p>
            ) : (
              <button
                onClick={convertToOrder}
                disabled={converting || selectedItems.length === 0}
                style={{
                  marginTop: 18,
                  padding: '13px 20px',
                  border: 0,
                  borderRadius: 9,
                  color: 'white',
                  background: converting ? '#94a3b8' : '#2563eb',
                  fontWeight: 700,
                  cursor: converting ? 'wait' : 'pointer',
                }}
              >
                {converting ? 'Converting...' : '✓ Convert to Sales Order'}
              </button>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          background: 'var(--card-bg, #fff)',
          border: '1px solid #e5e7eb',
          borderRadius: 15,
          padding: 22,
        }}
      >
        <h3 style={{ marginTop: 0 }}>📋 Sales Order History</h3>

        {orders.length === 0 ? (
          <p style={{ color: '#64748b' }}>
            No sales orders yet. Convert a quotation to create your first order.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 650,
              }}
            >
              <thead>
                <tr style={{ textAlign: 'left', background: '#f1f5f9' }}>
                  <th style={{ padding: 12 }}>Order Number</th>
                  <th style={{ padding: 12 }}>Date</th>
                  <th style={{ padding: 12 }}>Quotation</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const quote = quotes.find((q) => q.id === order.quote_id);

                  return (
                    <tr key={order.id}>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee', fontWeight: 700 }}>
                        {order.order_number}
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        {order.order_date}
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        {quote?.quote_number || '—'}
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        <span
                          style={{
                            color: statusColor(order.status),
                            background: `${statusColor(order.status)}18`,
                            padding: '5px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: 12, borderBottom: '1px solid #eee', fontWeight: 700 }}>
                        {money(Number(order.total_amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
