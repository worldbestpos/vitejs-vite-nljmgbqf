
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

type Props = {
  companyId: string;
  branchId: string;
  currency: string;
};

type Tab =
  | 'Overview'
  | 'Sales'
  | 'Quotes'
  | 'Sales Orders'
  | 'Purchases'
  | 'Expenses'
  | 'Inventory'
  | 'Outstanding';

type Period = 'Today' | 'Week' | 'Month' | 'Year' | 'Custom';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const firstDay = () => `${today().slice(0, 7)}-01`;

const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e9edf5',
  borderRadius: 16,
  padding: 18,
  boxShadow: '0 5px 20px rgba(25,40,70,.045)',
};

const input: React.CSSProperties = {
  padding: 11,
  border: '1px solid #d9e0eb',
  borderRadius: 9,
  color: '#172438',
  background: '#fff',
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  background: '#f5f7fb',
  color: '#526078',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: '1px solid #edf0f4',
  whiteSpace: 'nowrap',
};

const chartColors = {
  sales: '#6366f1',
  purchases: '#06b6d4',
  expenses: '#f59e0b',
};

function money(value: number, currency: string, language: string) {
  return `${currency} ${Number(value || 0).toLocaleString(
    language === 'ne' ? 'ne-NP' : 'en-IN',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}`;
}

function shortMoney(value: number, currency: string, language: string) {
  const n = Number(value || 0);

  if (Math.abs(n) >= 10000000) {
    return `${currency} ${(n / 10000000).toFixed(1)}${language === 'ne' ? 'करोड' : 'Cr'}`;
  }

  if (Math.abs(n) >= 100000) {
    return `${currency} ${(n / 100000).toFixed(1)}${language === 'ne' ? 'लाख' : 'L'}`;
  }

  if (Math.abs(n) >= 1000) {
    return `${currency} ${(n / 1000).toFixed(1)}${language === 'ne' ? 'हजार' : 'K'}`;
  }

  return `${currency} ${Math.round(n).toLocaleString(language === 'ne' ? 'ne-NP' : 'en-IN')}`;
}

function statusLabel(status: string, tr: (en: string, ne: string) => string) {
  const labels: Record<string, [string, string]> = {
    paid: ['Paid', 'भुक्तानी भएको'],
    unpaid: ['Unpaid', 'भुक्तानी नभएको'],
    partial: ['Partially Paid', 'आंशिक भुक्तानी'],
    pending: ['Pending', 'बाँकी'],
    completed: ['Completed', 'सम्पन्न'],
    cancelled: ['Cancelled', 'रद्द'],
    void: ['Void', 'अमान्य'],
    overdue: ['Overdue', 'म्याद नाघेको'],
    draft: ['Draft', 'ड्राफ्ट'],
    sent: ['Sent', 'पठाइएको'],
    accepted: ['Accepted', 'स्वीकृत'],
    rejected: ['Rejected', 'अस्वीकृत'],
    expired: ['Expired', 'समय सकिएको'],
    converted: ['Converted', 'रूपान्तरण गरिएको'],
    confirmed: ['Confirmed', 'पुष्टि गरिएको'],
    picking: ['Picking', 'सामान संकलन हुँदै'],
    packed: ['Packed', 'प्याक गरिएको'],
    shipped: ['Shipped', 'पठाइएको'],
    invoiced: ['Invoiced', 'बिल बनाइएको'],
  };

  const label = labels[String(status || '').toLowerCase()];
  return label ? tr(label[0], label[1]) : status || '—';
}

function AnimatedNumber({
  value,
  currency,
  language,
}: {
  value: number;
  currency: string;
  language: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = display;
    const startTime = performance.now();
    const duration = 650;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (value - start) * eased);

      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{money(display, currency, language)}</>;
}

function MetricCard({
  title,
  value,
  currency,
  color,
  icon,
  note,
  language,
}: {
  title: string;
  value: number;
  currency: string;
  color: string;
  icon: string;
  note: string;
  language: string;
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg,${color},${color}dd)`,
      borderRadius: 17,
      padding: 18,
      color: '#fff',
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 9px 22px ${color}30`,
      animation: 'reportCardIn 600ms ease both',
    }}>
      <div style={{
        position: 'absolute',
        right: -13,
        top: -25,
        width: 105,
        height: 105,
        borderRadius: '50%',
        background: 'rgba(255,255,255,.12)',
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        position: 'relative',
      }}>
        <span style={{ fontSize: 13 }}>{title}</span>
        <span style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          background: 'rgba(255,255,255,.19)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 18,
        }}>{icon}</span>
      </div>

      <div style={{
        fontSize: 19,
        fontWeight: 800,
        marginTop: 17,
        position: 'relative',
        overflowWrap: 'anywhere',
      }}>
        <AnimatedNumber value={value} currency={currency} language={language} />
      </div>

      <div style={{ fontSize: 11, opacity: .8, marginTop: 8, position: 'relative' }}>
        {note}
      </div>
    </div>
  );
}

function PerformanceChart({
  data,
  currency,
  language,
  tr,
}: {
  data: { label: string; sales: number; purchases: number; expenses: number }[];
  currency: string;
  language: string;
  tr: (en: string, ne: string) => string;
}) {
  const max = Math.max(1, ...data.flatMap(d => [d.sales, d.purchases, d.expenses]));

  const legends = [
    [tr('Sales', 'बिक्री'), chartColors.sales],
    [tr('Purchases', 'खरिद'), chartColors.purchases],
    [tr('Expenses', 'खर्च'), chartColors.expenses],
  ];

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: 18,
        flexWrap: 'wrap',
        marginBottom: 22,
        fontSize: 12,
        color: '#64748b',
      }}>
        {legends.map(([label, color]) => (
          <div key={String(label)} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: String(color) }} />
            {label}
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(data.length, 1)},minmax(0,1fr))`,
        gap: 9,
        alignItems: 'end',
        height: 220,
        borderBottom: '1px solid #e8edf5',
        padding: '12px 2px 0',
      }}>
        {data.map((item, index) => (
          <div key={item.label + index} style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'end',
            gap: 5,
            minWidth: 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'end',
              justifyContent: 'center',
              gap: 3,
              height: 175,
            }}>
              {[
                { value: item.sales, color: chartColors.sales },
                { value: item.purchases, color: chartColors.purchases },
                { value: item.expenses, color: chartColors.expenses },
              ].map((bar, i) => (
                <div
                  key={i}
                  title={money(bar.value, currency, language)}
                  style={{
                    width: '27%',
                    maxWidth: 24,
                    minWidth: 4,
                    height: `${Math.max(3, (bar.value / max) * 100)}%`,
                    background: bar.color,
                    borderRadius: '5px 5px 2px 2px',
                    transition: 'height 900ms cubic-bezier(.2,.8,.2,1)',
                    animation: 'reportBarIn 850ms ease both',
                    animationDelay: `${index * 70}ms`,
                    boxShadow: `0 3px 9px ${bar.color}35`,
                  }}
                />
              ))}
            </div>

            <div style={{
              textAlign: 'center',
              fontSize: 10,
              color: '#8490a3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
        marginTop: 16,
        color: '#718096',
        fontSize: 12,
      }}>
        <span>
          {tr('Highest sales:', 'सबैभन्दा बढी बिक्री:')} <strong style={{ color: '#4f46e5' }}>
            {shortMoney(Math.max(0, ...data.map(d => d.sales)), currency, language)}
          </strong>
        </span>
        <span>
          {tr('Highest expenses:', 'सबैभन्दा बढी खर्च:')} <strong style={{ color: '#d97706' }}>
            {shortMoney(Math.max(0, ...data.map(d => d.expenses)), currency, language)}
          </strong>
        </span>
      </div>
    </div>
  );
}

function ExpenseBreakdown({
  data,
  currency,
  language,
  tr,
}: {
  data: { label: string; value: number }[];
  currency: string;
  language: string;
  tr: (en: string, ne: string) => string;
}) {
  const colors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#64748b'];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let running = 0;

  const gradient = data.length
    ? data.map((item, index) => {
        const start = running;
        running += total ? (item.value / total) * 100 : 0;
        return `${colors[index % colors.length]} ${start}% ${running}%`;
      }).join(', ')
    : '#e9edf5 0% 100%';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(110px,145px) minmax(0,1fr)',
      gap: 20,
      alignItems: 'center',
    }}>
      <div style={{
        width: '100%',
        aspectRatio: '1',
        maxWidth: 145,
        borderRadius: '50%',
        background: `conic-gradient(${gradient})`,
        display: 'grid',
        placeItems: 'center',
        animation: 'reportSpinIn 900ms ease both',
      }}>
        <div style={{
          width: '65%',
          height: '65%',
          background: '#fff',
          borderRadius: '50%',
          display: 'grid',
          placeContent: 'center',
          textAlign: 'center',
          padding: 5,
        }}>
          <strong style={{ fontSize: 13, color: '#172438' }}>
            {shortMoney(total, currency, language)}
          </strong>
          <span style={{ fontSize: 10, color: '#8490a3' }}>
            {tr('Total expenses', 'कुल खर्च')}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {data.length === 0 ? (
          <p style={{ color: '#8490a3', fontSize: 13 }}>
            {tr('No expenses in this period.', 'यस अवधिमा कुनै खर्च छैन।')}
          </p>
        ) : data.map((item, index) => (
          <div key={item.label}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 12,
              marginBottom: 5,
            }}>
              <span style={{ color: '#526078' }}>
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 3,
                  background: colors[index % colors.length],
                  marginRight: 7,
                }} />
                {item.label}
              </span>
              <strong style={{ color: '#172438' }}>
                {money(item.value, currency, language)}
              </strong>
            </div>

            <div style={{
              height: 6,
              background: '#eef1f6',
              borderRadius: 20,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${total ? (item.value / total) * 100 : 0}%`,
                height: '100%',
                background: colors[index % colors.length],
                borderRadius: 20,
                transition: 'width 900ms ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsManager({ companyId, branchId, currency }: Props) {
  const { language } = useLanguage();
  const ne = language === 'ne';
  const tr = (english: string, nepali: string) => ne ? nepali : english;
  const dateLocale = ne ? 'ne-NP' : 'en-IN';

  const [tab, setTab] = useState<Tab>('Overview');
  const [period, setPeriod] = useState<Period>('Month');
  const [from, setFrom] = useState(firstDay());
  const [to, setTo] = useState(today());

  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function choosePeriod(next: Period) {
    setPeriod(next);
    const end = today();
    setTo(end);

    if (next === 'Today') setFrom(end);
    if (next === 'Week') setFrom(dateOffset(-6));
    if (next === 'Month') setFrom(firstDay());
    if (next === 'Year') setFrom(`${new Date().getFullYear()}-01-01`);
  }

  async function loadReports() {
    setLoading(true);
    setError('');

    try {
      const start = new Date(`${from}T00:00:00`).toISOString();
      const end = new Date(`${to}T23:59:59.999`).toISOString();

      const results = await Promise.all([
        supabase.from('sales').select('*')
          .eq('company_id', companyId).eq('branch_id', branchId)
          .gte('sale_date', start).lte('sale_date', end)
          .order('sale_date', { ascending: false }),

        supabase.from('sale_items').select('*')
          .eq('company_id', companyId).eq('branch_id', branchId),

        supabase.from('purchases').select('*')
          .eq('company_id', companyId).eq('branch_id', branchId)
          .gte('purchase_date', start).lte('purchase_date', end)
          .order('purchase_date', { ascending: false }),

        supabase.from('expenses').select('*')
          .eq('company_id', companyId).eq('branch_id', branchId)
          .gte('expense_date', start).lte('expense_date', end)
          .order('expense_date', { ascending: false }),

        supabase.from('branch_inventory').select('*, products(product_name, sku, purchase_price)')
          .eq('company_id', companyId).eq('branch_id', branchId),

        supabase.from('customers').select('id, full_name, phone, opening_balance')
          .eq('company_id', companyId),

        supabase.from('suppliers').select('id, supplier_name, phone, opening_balance')
          .eq('company_id', companyId),

        supabase.from('wholesale_quotes').select('*')
          .eq('company_id', companyId).eq('branch_id', branchId)
          .gte('quote_date', from).lte('quote_date', to)
          .order('quote_date', { ascending: false }),

        supabase.from('wholesale_sales_orders').select('*')
          .eq('company_id', companyId).eq('branch_id', branchId)
          .gte('order_date', from).lte('order_date', to)
          .order('order_date', { ascending: false }),

        supabase.from('payments').select('*')
          .eq('company_id', companyId).eq('branch_id', branchId)
          .gte('payment_date', start).lte('payment_date', end)
          .order('payment_date', { ascending: false }),
      ]);

      const failed = results.find(r => r.error);

      if (failed?.error) {
        setError(failed.error.message);
        setLoading(false);
        return;
      }

      setSales(results[0].data || []);
      setSaleItems(results[1].data || []);
      setPurchases(results[2].data || []);
      setExpenses(results[3].data || []);
      setInventory(results[4].data || []);
      setCustomers(results[5].data || []);
      setSuppliers(results[6].data || []);
      setQuotes(results[7].data || []);
      setOrders(results[8].data || []);
      setPayments(results[9].data || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load reports.');
    }

    setLoading(false);
  }

  useEffect(() => {
    loadReports();
  }, [companyId, branchId, from, to]);

  const validSales = sales.filter(s =>
    !['cancelled', 'void', 'draft'].includes(String(s.status || '').toLowerCase())
  );

  const totalSales = validSales.reduce(
    (sum, x) => sum + Number(x.total_amount || 0), 0
  );

  const totalPaid = validSales.reduce(
    (sum, x) => sum + Number(x.paid_amount || 0), 0
  );

  const totalSalesDue = validSales.reduce(
    (sum, x) => sum + Number(x.due_amount || 0), 0
  );

  const totalSalesDiscount = validSales.reduce(
    (sum, x) => sum + Number(x.discount_amount || 0), 0
  );

  const totalPurchases = purchases.reduce(
    (sum, x) => sum + Number(x.total_amount || 0), 0
  );

  const totalPurchasePaid = purchases.reduce(
    (sum, x) => sum + Number(x.paid_amount || 0), 0
  );

  const totalPurchaseDue = purchases.reduce(
    (sum, x) => sum + Number(x.due_amount || 0), 0
  );

  const totalExpenses = expenses.reduce(
    (sum, x) => sum + Number(x.amount || 0), 0
  );

  // Money received and paid, from actual payment records.
  const totalCredit = payments
    .filter(p => String(p.direction || '').toLowerCase() === 'in')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const purchasePaymentsOut = payments
    .filter(p => String(p.direction || '').toLowerCase() === 'out')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalDebit = purchasePaymentsOut + totalExpenses;

  const saleIds = new Set(validSales.map(s => s.id));
  const relevantItems = saleItems.filter(item => saleIds.has(item.sale_id));

  const costOfGoods = relevantItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0),
    0
  );

  // Sales subtotal is before discount. Tax is not treated as business revenue.
  const netSalesRevenue = validSales.reduce(
    (sum, sale) =>
      sum + Math.max(
        0,
        Number(sale.subtotal || 0) - Number(sale.discount_amount || 0)
      ),
    0
  );

  const grossProfit = netSalesRevenue - costOfGoods;
  const estimatedNetProfit = grossProfit - totalExpenses;
  const totalProfit = Math.max(0, estimatedNetProfit);
  const totalLoss = Math.max(0, -estimatedNetProfit);

  const stockQuantity = inventory.reduce(
    (sum, item) => sum + Number(item.quantity_on_hand || 0), 0
  );

  const stockValue = inventory.reduce(
    (sum, item) =>
      sum + Number(item.quantity_on_hand || 0) * Number(item.average_cost || 0), 0
  );

  const lowStock = inventory.filter(
    item => Number(item.quantity_on_hand || 0) <= Number(item.reorder_level || 0)
  );

  const outstandingCustomers = validSales.reduce((map: Record<string, number>, sale) => {
    if (sale.customer_id) {
      map[sale.customer_id] =
        (map[sale.customer_id] || 0) + Number(sale.due_amount || 0);
    }
    return map;
  }, {});

  const outstandingSuppliers = purchases.reduce((map: Record<string, number>, purchase) => {
    if (purchase.supplier_id) {
      map[purchase.supplier_id] =
        (map[purchase.supplier_id] || 0) + Number(purchase.due_amount || 0);
    }
    return map;
  }, {});

  const filteredCustomers = customers.filter(
    c => Number(c.opening_balance || 0) +
      Number(outstandingCustomers[c.id] || 0) > 0
  );

  const filteredSuppliers = suppliers.filter(
    s => Number(s.opening_balance || 0) +
      Number(outstandingSuppliers[s.id] || 0) > 0
  );

  const customerDueTotal = filteredCustomers.reduce(
    (sum, c) =>
      sum + Number(c.opening_balance || 0) +
      Number(outstandingCustomers[c.id] || 0), 0
  );

  const supplierDueTotal = filteredSuppliers.reduce(
    (sum, s) =>
      sum + Number(s.opening_balance || 0) +
      Number(outstandingSuppliers[s.id] || 0), 0
  );

  const totalQuoteValue = quotes
    .filter(q => !['cancelled', 'rejected', 'expired'].includes(String(q.status || '').toLowerCase()))
    .reduce((sum, q) => sum + Number(q.total_amount || 0), 0);

  const totalOrderValue = orders
    .filter(o => !['cancelled'].includes(String(o.status || '').toLowerCase()))
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const performanceData = useMemo(() => {
    const startDate = new Date(`${from}T12:00:00`);
    const endDate = new Date(`${to}T12:00:00`);

    const dayCount = Math.max(
      1,
      Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    );

    const bucketCount = Math.min(7, dayCount);

    const buckets = Array.from({ length: bucketCount }, () => ({
      label: '',
      sales: 0,
      purchases: 0,
      expenses: 0,
    }));

    const getBucket = (date: string) => {
      const parsed = new Date(`${String(date).slice(0, 10)}T12:00:00`);
      const day = Math.round((parsed.getTime() - startDate.getTime()) / 86400000);
      return Math.max(0, Math.min(
        bucketCount - 1,
        Math.floor(day * bucketCount / dayCount)
      ));
    };

    buckets.forEach((bucket, index) => {
      const first = Math.floor(index * dayCount / bucketCount);
      const last = Math.max(
        first,
        Math.ceil((index + 1) * dayCount / bucketCount) - 1
      );

      const a = new Date(startDate);
      const b = new Date(startDate);
      a.setDate(a.getDate() + first);
      b.setDate(b.getDate() + last);

      const format = (d: Date) => d.toLocaleDateString(dateLocale, {
        day: '2-digit',
        month: '2-digit',
      });

      bucket.label = dayCount <= 7
        ? format(a)
        : `${format(a)}–${format(b)}`;
    });

    validSales.forEach(item => {
      buckets[getBucket(item.sale_date)].sales += Number(item.total_amount || 0);
    });

    purchases.forEach(item => {
      buckets[getBucket(item.purchase_date)].purchases += Number(item.total_amount || 0);
    });

    expenses.forEach(item => {
      buckets[getBucket(item.expense_date)].expenses += Number(item.amount || 0);
    });

    return buckets;
  }, [from, to, sales, purchases, expenses, dateLocale]);

  const expenseBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};

    expenses.forEach(expense => {
      const label = expense.payment_method || 'Other';
      groups[label] = (groups[label] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(groups)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const topProducts = useMemo(() => {
    const groups: Record<string, {
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
    }> = {};

    relevantItems.forEach(item => {
      const id = item.product_id ||
        item.product_name_snapshot ||
        item.product_name ||
        'unknown';

      const product = inventory.find(
        i => i.product_id === item.product_id
      )?.products;

      if (!groups[id]) {
        groups[id] = {
          name: item.product_name_snapshot ||
            item.product_name ||
            product?.product_name ||
            'Product',
          sku: item.sku_snapshot || product?.sku || '',
          quantity: 0,
          revenue: 0,
        };
      }

      const quantity = Number(item.quantity || 0);
      groups[id].quantity += quantity;

      groups[id].revenue += Number(
        item.line_total ?? (quantity * Number(item.unit_price || 0))
      );
    });

    return Object.values(groups)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [relevantItems, inventory]);

  const averageSale = validSales.length ? totalSales / validSales.length : 0;
  const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;
  const expenseRate = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;

  const tabs: Tab[] = [
    'Overview',
    'Sales',
    'Quotes',
    'Sales Orders',
    'Purchases',
    'Expenses',
    'Inventory',
    'Outstanding',
  ];

  const tabLabel = (name: Tab) => {
    const labels: Record<Tab, [string, string]> = {
      Overview: ['Overview', 'सारांश'],
      Sales: ['Sales', 'बिक्री'],
      Quotes: ['Quotes', 'कोटेशन'],
      'Sales Orders': ['Sales Orders', 'बिक्री अर्डर'],
      Purchases: ['Purchases', 'खरिद'],
      Expenses: ['Expenses', 'खर्च'],
      Inventory: ['Inventory', 'मौज्दात'],
      Outstanding: ['Outstanding', 'बाँकी रकम'],
    };

    return tr(labels[name][0], labels[name][1]);
  };

  function downloadCSV(filename: string, rows: (string | number)[][]) {
    const csv = rows.map(row =>
      row.map(value =>
        `"${String(value ?? '').replace(/"/g, '""')}"`
      ).join(',')
    ).join('\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCurrent() {
    if (tab === 'Sales') {
      downloadCSV('sales-report.csv', [
        ['Bill Number', 'Date', 'Total', 'Discount', 'Paid', 'Due', 'Status'],
        ...validSales.map(s => [
          s.bill_number,
          s.sale_date,
          s.total_amount,
          s.discount_amount,
          s.paid_amount,
          s.due_amount,
          s.status,
        ]),
      ]);
    } else if (tab === 'Quotes') {
      downloadCSV('quotes-report.csv', [
        ['Quote Number', 'Date', 'Valid Until', 'Status', 'Total'],
        ...quotes.map(q => [
          q.quote_number,
          q.quote_date,
          q.valid_until,
          q.status,
          q.total_amount,
        ]),
      ]);
    } else if (tab === 'Sales Orders') {
      downloadCSV('sales-orders-report.csv', [
        ['Order Number', 'Date', 'Status', 'Total'],
        ...orders.map(o => [
          o.order_number,
          o.order_date,
          o.status,
          o.total_amount,
        ]),
      ]);
    } else if (tab === 'Purchases') {
      downloadCSV('purchases-report.csv', [
        ['Purchase Number', 'Date', 'Total', 'Paid', 'Due', 'Status'],
        ...purchases.map(p => [
          p.purchase_number,
          p.purchase_date,
          p.total_amount,
          p.paid_amount,
          p.due_amount,
          p.status,
        ]),
      ]);
    } else if (tab === 'Expenses') {
      downloadCSV('expenses-report.csv', [
        ['Expense Number', 'Date', 'Payee', 'Description', 'Payment Method', 'Amount'],
        ...expenses.map(e => [
          e.expense_number,
          e.expense_date,
          e.payee,
          e.description,
          e.payment_method,
          e.amount,
        ]),
      ]);
    } else if (tab === 'Inventory') {
      downloadCSV('inventory-report.csv', [
        ['Product', 'SKU', 'Quantity', 'Average Cost', 'Stock Value', 'Reorder Level'],
        ...inventory.map(i => [
          i.products?.product_name || '',
          i.products?.sku || '',
          i.quantity_on_hand,
          i.average_cost,
          Number(i.quantity_on_hand || 0) * Number(i.average_cost || 0),
          i.reorder_level,
        ]),
      ]);
    } else {
      downloadCSV('business-report.csv', [
        ['Metric', 'Amount'],
        ['Sales', totalSales],
        ['Sales Received', totalPaid],
        ['Sales Due', totalSalesDue],
        ['Sales Discount', totalSalesDiscount],
        ['Purchases', totalPurchases],
        ['Purchase Paid', totalPurchasePaid],
        ['Purchase Due', totalPurchaseDue],
        ['Expenses', totalExpenses],
        ['Total Credit', totalCredit],
        ['Total Debit', totalDebit],
        ['Cost of Goods Sold', costOfGoods],
        ['Estimated Gross Profit', grossProfit],
        ['Estimated Net Profit', estimatedNetProfit],
        ['Total Profit', totalProfit],
        ['Total Loss', totalLoss],
        ['Stock Value', stockValue],
        ['Customer Outstanding', customerDueTotal],
        ['Supplier Outstanding', supplierDueTotal],
        ['Quotes Value (separate)', totalQuoteValue],
        ['Sales Orders Value (separate)', totalOrderValue],
      ]);
    }
  }

  const rows = useMemo(() => {
    if (tab === 'Sales') return validSales;
    if (tab === 'Purchases') return purchases;
    if (tab === 'Expenses') return expenses;
    return [];
  }, [tab, sales, purchases, expenses]);

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 15px',
    borderRadius: 9,
    border: active ? '1px solid #4f46e5' : '1px solid #e0e5ee',
    background: active ? '#4f46e5' : '#fff',
    color: active ? '#fff' : '#526078',
    cursor: 'pointer',
    fontWeight: 650,
    fontSize: 13,
    whiteSpace: 'nowrap',
    boxShadow: active ? '0 4px 12px #4f46e530' : 'none',
  });

  const periodButtons: Period[] = [
    'Today',
    'Week',
    'Month',
    'Year',
    'Custom',
  ];

  return (
    <div style={{
      display: 'grid',
      gap: 20,
      color: '#172438',
      fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes reportCardIn {
          from { opacity: 0; transform: translateY(13px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes reportBarIn {
          from { transform: scaleY(.15); transform-origin: bottom; opacity: .3; }
          to { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
        }
        @keyframes reportSpinIn {
          from { transform: rotate(-90deg); opacity: .4; }
          to { transform: rotate(0); opacity: 1; }
        }
        .report-panel { min-width: 0; }
        .report-hover { transition: transform .2s ease, box-shadow .2s ease; }
        .report-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 25px rgba(25,40,70,.09) !important;
        }
        @media (max-width: 700px) {
          .report-chart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(120deg,#172554,#3730a3 65%,#6d28d9)',
        borderRadius: 19,
        padding: '23px 22px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.07)',
          right: 35,
          top: -100,
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: .75, fontWeight: 700 }}>
            D.R GLOBAL / {tr('HEAD OFFICE', 'मुख्य कार्यालय')}
          </div>
          <h2 style={{ margin: '8px 0 5px', fontSize: 25 }}>
            {tr('Business Reports', 'व्यवसाय प्रतिवेदन')}
          </h2>
          <p style={{ margin: 0, fontSize: 13, opacity: .8 }}>
            {tr(
              'Your business performance, made easy to understand.',
              'तपाईंको व्यवसायको प्रदर्शन सजिलै बुझ्नुहोस्।'
            )}
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 13,
          borderRadius: 10,
          background: '#fff0f0',
          color: '#b42318',
          border: '1px solid #ffd1d1',
        }}>
          {error}
        </div>
      )}

      <div style={{ ...card, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {periodButtons.map(p => (
            <button
              key={p}
              onClick={() => choosePeriod(p)}
              style={buttonStyle(period === p)}
            >
              {tr(
                p === 'Today' ? 'Today' :
                p === 'Week' ? 'Last 7 Days' :
                p === 'Month' ? 'This Month' :
                p === 'Year' ? 'This Year' : 'Custom Range',
                p === 'Today' ? 'आज' :
                p === 'Week' ? 'पछिल्लो ७ दिन' :
                p === 'Month' ? 'यो महिना' :
                p === 'Year' ? 'यो वर्ष' : 'आफैं मिति छान्नुहोस्'
              )}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'end',
          flexWrap: 'wrap',
        }}>
          <label style={{
            display: 'grid',
            gap: 6,
            fontSize: 12,
            color: '#64748b',
          }}>
            {tr('From Date', 'सुरु मिति')}
            <input
              type="date"
              style={input}
              value={from}
              onChange={e => {
                setFrom(e.target.value);
                setPeriod('Custom');
              }}
            />
          </label>

          <label style={{
            display: 'grid',
            gap: 6,
            fontSize: 12,
            color: '#64748b',
          }}>
            {tr('To Date', 'अन्तिम मिति')}
            <input
              type="date"
              style={input}
              value={to}
              min={from}
              onChange={e => {
                setTo(e.target.value);
                setPeriod('Custom');
              }}
            />
          </label>

          <button
            onClick={loadReports}
            style={{
              padding: '11px 16px',
              background: '#172554',
              color: '#fff',
              border: 0,
              borderRadius: 9,
              cursor: 'pointer',
              fontWeight: 650,
            }}
          >
            ↻ {tr('Refresh Reports', 'प्रतिवेदन रिफ्रेस गर्नुहोस्')}
          </button>

          <button
            onClick={exportCurrent}
            style={{
              padding: '11px 16px',
              background: '#b18b45',
              color: '#fff',
              border: 0,
              borderRadius: 9,
              cursor: 'pointer',
              fontWeight: 650,
            }}
          >
            ↓ {tr('Export CSV', 'CSV डाउनलोड गर्नुहोस्')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(name => (
          <button
            key={name}
            onClick={() => setTab(name)}
            style={buttonStyle(tab === name)}
          >
            {tabLabel(name)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{
          ...card,
          padding: 35,
          textAlign: 'center',
          color: '#64748b',
        }}>
          <div style={{ fontSize: 25, marginBottom: 8 }}>◌</div>
          {tr('Loading your business reports...', 'व्यवसाय प्रतिवेदन लोड हुँदैछ...')}
        </div>
      ) : (
        <>
          {tab === 'Overview' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(205px,1fr))',
                gap: 14,
              }}>
                <MetricCard
                  title={tr('Total Sales', 'कुल बिक्री')}
                  value={totalSales}
                  currency={currency}
                  color="#4f46e5"
                  icon="↗"
                  note={`${validSales.length.toLocaleString(dateLocale)} ${tr('sales transactions', 'बिक्री कारोबार')}`}
                  language={language}
                />

                <MetricCard
                  title={tr('Received from Sales', 'बिक्रीबाट प्राप्त')}
                  value={totalPaid}
                  currency={currency}
                  color="#0891b2"
                  icon="✓"
                  note={`${collectionRate.toLocaleString(dateLocale, { maximumFractionDigits: 1 })}% ${tr('collection rate', 'रकम संकलन दर')}`}
                  language={language}
                />

                <MetricCard
                  title={tr('Total Purchases', 'कुल खरिद')}
                  value={totalPurchases}
                  currency={currency}
                  color="#7c3aed"
                  icon="▣"
                  note={`${purchases.length} ${tr('purchase transactions', 'खरिद कारोबार')}`}
                  language={language}
                />

                <MetricCard
                  title={tr('Total Expenses', 'कुल खर्च')}
                  value={totalExpenses}
                  currency={currency}
                  color="#d97706"
                  icon="₹"
                  note={`${expenses.length} ${tr('expense records', 'खर्च रेकर्ड')}`}
                  language={language}
                />

                <MetricCard
                  title={tr('Total Credit', 'कुल क्रेडिट')}
                  value={totalCredit}
                  currency={currency}
                  color="#0284c7"
                  icon="+"
                  note={tr('Money received during this period', 'यस अवधिमा प्राप्त रकम')}
                  language={language}
                />

                <MetricCard
                  title={tr('Total Debit', 'कुल डेबिट')}
                  value={totalDebit}
                  currency={currency}
                  color="#ea580c"
                  icon="−"
                  note={tr('Purchase payments and recorded expenses', 'खरिद भुक्तानी र रेकर्ड गरिएका खर्च')}
                  language={language}
                />

                <MetricCard
                  title={tr('Total Discount', 'कुल छुट')}
                  value={totalSalesDiscount}
                  currency={currency}
                  color="#db2777"
                  icon="%"
                  note={tr('Discounts given on sales', 'बिक्रीमा दिइएको छुट')}
                  language={language}
                />

                <MetricCard
                  title={tr('Estimated Gross Profit', 'अनुमानित कुल नाफा')}
                  value={grossProfit}
                  currency={currency}
                  color="#059669"
                  icon="◆"
                  note={tr('Net sales revenue minus product costs', 'खुद बिक्री रकमबाट सामानको लागत घटाएर')}
                  language={language}
                />

                <MetricCard
                  title={tr('Total Profit', 'कुल नाफा')}
                  value={totalProfit}
                  currency={currency}
                  color="#0f766e"
                  icon="★"
                  note={tr('After recorded expenses', 'रेकर्ड गरिएका खर्च कटाएर')}
                  language={language}
                />

                <MetricCard
                  title={tr('Total Loss', 'कुल घाटा')}
                  value={totalLoss}
                  currency={currency}
                  color="#dc4655"
                  icon="↓"
                  note={tr('Shown when expenses exceed gross profit', 'खर्च कुल नाफाभन्दा बढी हुँदा देखाइन्छ')}
                  language={language}
                />

                <MetricCard
                  title={tr('Customer Outstanding', 'ग्राहकबाट उठाउन बाँकी')}
                  value={customerDueTotal}
                  currency={currency}
                  color="#be185d"
                  icon="♙"
                  note={tr('Amount customers owe', 'ग्राहकले तिर्न बाँकी रकम')}
                  language={language}
                />

                <MetricCard
                  title={tr('Supplier Outstanding', 'आपूर्तिकर्तालाई तिर्न बाँकी')}
                  value={supplierDueTotal}
                  currency={currency}
                  color="#475569"
                  icon="♧"
                  note={tr('Amount owed to suppliers', 'आपूर्तिकर्तालाई तिर्नुपर्ने रकम')}
                  language={language}
                />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.7fr) minmax(280px,1fr)',
                gap: 16,
              }} className="report-chart-grid">
                <div style={card} className="report-panel">
                  <h3 style={{ margin: '0 0 5px', fontSize: 17 }}>
                    {tr('Business Performance', 'व्यवसाय प्रदर्शन')}
                  </h3>
                  <p style={{
                    margin: '0 0 20px',
                    color: '#8490a3',
                    fontSize: 12,
                  }}>
                    {tr('Compare sales, purchases and expenses', 'बिक्री, खरिद र खर्च तुलना गर्नुहोस्')}
                  </p>
                  <PerformanceChart
                    data={performanceData}
                    currency={currency}
                    language={language}
                    tr={tr}
                  />
                </div>

                <div style={card} className="report-panel">
                  <h3 style={{ margin: 0, fontSize: 17 }}>
                    {tr('Expense Breakdown', 'खर्चको विवरण')}
                  </h3>
                  <p style={{
                    margin: '5px 0 20px',
                    color: '#8490a3',
                    fontSize: 12,
                  }}>
                    {tr('Where your money is going', 'तपाईंको रकम कहाँ खर्च भइरहेको छ')}
                  </p>
                  <ExpenseBreakdown
                    data={expenseBreakdown}
                    currency={currency}
                    language={language}
                    tr={tr}
                  />
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                gap: 13,
              }}>
                {[
                  {
                    title: tr('Average Sale', 'औसत बिक्री'),
                    value: money(averageSale, currency, language),
                    note: tr('Per sales transaction', 'प्रति बिक्री कारोबार'),
                    icon: '◈',
                    color: '#eef2ff',
                    text: '#4f46e5',
                  },
                  {
                    title: tr('Stock Quantity', 'मौज्दात परिमाण'),
                    value: stockQuantity.toLocaleString(dateLocale),
                    note: tr('Units currently in stock', 'हाल मौज्दातमा रहेका एकाइ'),
                    icon: '▦',
                    color: '#ecfeff',
                    text: '#0891b2',
                  },
                  {
                    title: tr('Stock Value', 'मौज्दात मूल्य'),
                    value: money(stockValue, currency, language),
                    note: tr('Estimated inventory value', 'अनुमानित मौज्दात मूल्य'),
                    icon: '◆',
                    color: '#ecfdf5',
                    text: '#059669',
                  },
                  {
                    title: tr('Low Stock Items', 'कम मौज्दात भएका सामान'),
                    value: lowStock.length.toLocaleString(dateLocale),
                    note: tr('At or below reorder level', 'पुनः अर्डर स्तर वा सोभन्दा कम'),
                    icon: '⚠',
                    color: '#fff7ed',
                    text: '#ea580c',
                  },
                  {
                    title: tr('Expense / Sales', 'खर्च / बिक्री'),
                    value: `${expenseRate.toLocaleString(dateLocale, { maximumFractionDigits: 1 })}%`,
                    note: tr('Expenses compared with sales', 'बिक्रीसँग खर्चको तुलना'),
                    icon: '％',
                    color: '#fdf2f8',
                    text: '#db2777',
                  },
                  {
                    title: tr('Sales Due', 'बिक्री बाँकी'),
                    value: money(totalSalesDue, currency, language),
                    note: tr('Unpaid sales in this period', 'यस अवधिको भुक्तानी हुन बाँकी बिक्री'),
                    icon: '◷',
                    color: '#f5f3ff',
                    text: '#7c3aed',
                  },
                ].map(item => (
                  <div
                    key={item.title}
                    style={{
                      ...card,
                      padding: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                    className="report-hover"
                  >
                    <div style={{
                      width: 42,
                      height: 42,
                      flexShrink: 0,
                      borderRadius: 12,
                      background: item.color,
                      color: item.text,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 20,
                    }}>{item.icon}</div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#8490a3' }}>
                        {item.title}
                      </div>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 750,
                        marginTop: 4,
                        overflowWrap: 'anywhere',
                      }}>{item.value}</div>
                      <div style={{
                        fontSize: 10,
                        color: '#98a2b3',
                        marginTop: 3,
                      }}>{item.note}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {tr('Top Selling Products', 'धेरै बिक्री भएका सामान')}
                    </h3>
                    <p style={{
                      margin: '5px 0 15px',
                      color: '#8490a3',
                      fontSize: 12,
                    }}>
                      {tr(
                        'Ranked by quantity sold in the selected period',
                        'छानिएको अवधिमा बिक्री भएको परिमाणअनुसार'
                      )}
                    </p>
                  </div>

                  <span style={{
                    background: '#eef2ff',
                    color: '#4f46e5',
                    borderRadius: 20,
                    padding: '6px 11px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {topProducts.length} {tr('Products', 'सामान')}
                  </span>
                </div>

                {topProducts.length === 0 ? (
                  <p style={{ color: '#8490a3', fontSize: 13 }}>
                    {tr(
                      'No completed sale items found in this period.',
                      'यस अवधिमा सम्पन्न बिक्रीका सामान भेटिएनन्।'
                    )}
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: 500,
                      fontSize: 13,
                    }}>
                      <thead>
                        <tr>
                          <th style={th}>#</th>
                          <th style={th}>{tr('Product', 'सामान')}</th>
                          <th style={th}>SKU</th>
                          <th style={th}>{tr('Quantity Sold', 'बिक्री परिमाण')}</th>
                          <th style={th}>{tr('Sales Value', 'बिक्री रकम')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p, index) => (
                          <tr key={`${p.name}-${index}`}>
                            <td style={td}>
                              <strong style={{
                                color: index < 3 ? '#4f46e5' : '#64748b',
                              }}>
                                {index + 1}
                              </strong>
                            </td>
                            <td style={td}>{p.name}</td>
                            <td style={td}>{p.sku || '—'}</td>
                            <td style={td}>
                              {p.quantity.toLocaleString(dateLocale)}
                            </td>
                            <td style={td}>
                              {money(p.revenue, currency, language)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={card}>
                <h3 style={{ margin: '0 0 15px' }}>
                  {tr('Quotes & Sales Orders Overview', 'कोटेशन र बिक्री अर्डर सारांश')}
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                  gap: 13,
                }}>
                  <div style={{
                    padding: 16,
                    borderRadius: 13,
                    background: '#f5f3ff',
                  }}>
                    <div style={{ color: '#7c3aed', fontSize: 12 }}>
                      {tr('Quotes Created', 'बनाइएका कोटेशन')}
                    </div>
                    <strong style={{ fontSize: 25, color: '#5b21b6' }}>
                      {quotes.length}
                    </strong>
                    <div style={{
                      fontSize: 12,
                      color: '#7c3aed',
                      marginTop: 5,
                    }}>
                      {money(totalQuoteValue, currency, language)}
                    </div>
                  </div>

                  <div style={{
                    padding: 16,
                    borderRadius: 13,
                    background: '#ecfeff',
                  }}>
                    <div style={{ color: '#0891b2', fontSize: 12 }}>
                      {tr('Sales Orders', 'बिक्री अर्डर')}
                    </div>
                    <strong style={{ fontSize: 25, color: '#0e7490' }}>
                      {orders.length}
                    </strong>
                    <div style={{
                      fontSize: 12,
                      color: '#0891b2',
                      marginTop: 5,
                    }}>
                      {money(totalOrderValue, currency, language)}
                    </div>
                  </div>
                </div>

                <p style={{
                  margin: '14px 0 0',
                  fontSize: 12,
                  color: '#64748b',
                  lineHeight: 1.6,
                }}>
                  {tr(
                    'Quotes and sales orders are shown separately. They are not included in completed sales, collections or profit calculations.',
                    'कोटेशन र बिक्री अर्डर छुट्टै देखाइएका छन्। तिनीहरू सम्पन्न बिक्री, रकम संकलन वा नाफाको गणनामा समावेश छैनन्।'
                  )}
                </p>
              </div>

              <div style={{
                ...card,
                background: 'linear-gradient(120deg,#fff,#f8faff)',
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>
                  {tr('Business Health Summary', 'व्यवसायको अवस्था सारांश')}
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                  gap: 14,
                }}>
                  {[
                    [tr('Sales Transactions', 'बिक्री कारोबार'), validSales.length, '#4f46e5'],
                    [tr('Purchase Transactions', 'खरिद कारोबार'), purchases.length, '#0891b2'],
                    [tr('Expense Records', 'खर्च रेकर्ड'), expenses.length, '#d97706'],
                    [tr('Low Stock Products', 'कम मौज्दात भएका सामान'), lowStock.length, '#dc4655'],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} style={{
                      padding: 14,
                      background: '#fff',
                      border: '1px solid #edf0f5',
                      borderRadius: 12,
                    }}>
                      <div style={{ fontSize: 12, color: '#8490a3' }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: 25,
                        fontWeight: 800,
                        color: String(color),
                        marginTop: 7,
                      }}>
                        {Number(value).toLocaleString(dateLocale)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: 16,
                  padding: 13,
                  borderRadius: 10,
                  background: '#f1f5f9',
                  color: '#64748b',
                  fontSize: 12,
                  lineHeight: 1.7,
                }}>
                  {tr(
                    'Profit is an estimate based on recorded sale item costs, sales discounts and expenses within the selected period. Purchase payments are included in Debit. Quotes and sales orders are separate from completed sales.',
                    'नाफा छानिएको अवधिमा रेकर्ड भएका बिक्री सामानको लागत, छुट र खर्चका आधारमा गरिएको अनुमान हो। खरिद भुक्तानी डेबिटमा समावेश हुन्छ। कोटेशन र बिक्री अर्डर सम्पन्न बिक्रीभन्दा छुट्टै छन्।'
                  )}
                </div>
              </div>
            </>
          )}

          {(tab === 'Sales' || tab === 'Purchases' || tab === 'Expenses') && (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>
                {tabLabel(tab)} {tr('Report', 'प्रतिवेदन')}
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 650,
                  fontSize: 13,
                }}>
                  <thead>
                    <tr>
                      {(tab === 'Sales'
                        ? ['Bill Number', 'Date', 'Total', 'Paid', 'Due', 'Status']
                        : tab === 'Purchases'
                          ? ['Purchase Number', 'Date', 'Total', 'Paid', 'Due', 'Status']
                          : ['Expense Number', 'Date', 'Payee', 'Payment Method', 'Description', 'Amount']
                      ).map(h => (
                        <th key={h} style={th}>{tr(h, h)}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td style={td} colSpan={6}>
                          {tr(
                            'No records for this date range.',
                            'यस मिति अवधिमा कुनै रेकर्ड छैन।'
                          )}
                        </td>
                      </tr>
                    ) : rows.map((item: any) => (
                      <tr key={item.id}>
                        {tab === 'Sales' && <>
                          <td style={td}>{item.bill_number}</td>
                          <td style={td}>
                            {new Date(item.sale_date).toLocaleDateString(dateLocale)}
                          </td>
                          <td style={td}>{money(item.total_amount, currency, language)}</td>
                          <td style={td}>{money(item.paid_amount, currency, language)}</td>
                          <td style={td}>{money(item.due_amount, currency, language)}</td>
                          <td style={td}>{statusLabel(item.status, tr)}</td>
                        </>}

                        {tab === 'Purchases' && <>
                          <td style={td}>{item.purchase_number}</td>
                          <td style={td}>
                            {new Date(item.purchase_date).toLocaleDateString(dateLocale)}
                          </td>
                          <td style={td}>{money(item.total_amount, currency, language)}</td>
                          <td style={td}>{money(item.paid_amount, currency, language)}</td>
                          <td style={td}>{money(item.due_amount, currency, language)}</td>
                          <td style={td}>{statusLabel(item.status, tr)}</td>
                        </>}

                        {tab === 'Expenses' && <>
                          <td style={td}>{item.expense_number}</td>
                          <td style={td}>
                            {new Date(item.expense_date).toLocaleDateString(dateLocale)}
                          </td>
                          <td style={td}>{item.payee || '—'}</td>
                          <td style={td}>{item.payment_method || '—'}</td>
                          <td style={td}>{item.description || '—'}</td>
                          <td style={td}>{money(item.amount, currency, language)}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Quotes' && (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>
                {tr('Quotation History', 'कोटेशन इतिहास')}
              </h3>

              <p style={{ color: '#8490a3', fontSize: 12 }}>
                {tr(
                  'Quotes are not completed sales until they are converted and invoiced.',
                  'कोटेशन रूपान्तरण गरी बिल नबनाएसम्म सम्पन्न बिक्री मानिँदैन।'
                )}
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 600,
                  fontSize: 13,
                }}>
                  <thead>
                    <tr>
                      {[
                        tr('Quote Number', 'कोटेशन नम्बर'),
                        tr('Date', 'मिति'),
                        tr('Valid Until', 'मान्य मिति'),
                        tr('Status', 'स्थिति'),
                        tr('Total', 'जम्मा'),
                      ].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {quotes.length === 0 ? (
                      <tr>
                        <td style={td} colSpan={5}>
                          {tr('No quotes in this period.', 'यस अवधिमा कोटेशन छैन।')}
                        </td>
                      </tr>
                    ) : quotes.map(q => (
                      <tr key={q.id}>
                        <td style={td}>{q.quote_number}</td>
                        <td style={td}>{q.quote_date}</td>
                        <td style={td}>{q.valid_until || '—'}</td>
                        <td style={td}>{statusLabel(q.status, tr)}</td>
                        <td style={td}>{money(q.total_amount, currency, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                marginTop: 15,
                padding: 14,
                borderRadius: 11,
                background: '#f5f3ff',
                color: '#5b21b6',
                fontSize: 13,
              }}>
                {tr('Total quote value:', 'कुल कोटेशन रकम:')} <strong>
                  {money(totalQuoteValue, currency, language)}
                </strong>
              </div>
            </div>
          )}

          {tab === 'Sales Orders' && (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>
                {tr('Sales Order History', 'बिक्री अर्डर इतिहास')}
              </h3>

              <p style={{ color: '#8490a3', fontSize: 12 }}>
                {tr(
                  'Orders are tracked separately and are not counted as completed sales.',
                  'अर्डर छुट्टै देखाइन्छन् र सम्पन्न बिक्रीमा गणना हुँदैनन्।'
                )}
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 550,
                  fontSize: 13,
                }}>
                  <thead>
                    <tr>
                      {[
                        tr('Order Number', 'अर्डर नम्बर'),
                        tr('Date', 'मिति'),
                        tr('Status', 'स्थिति'),
                        tr('Total', 'जम्मा'),
                      ].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td style={td} colSpan={4}>
                          {tr('No sales orders in this period.', 'यस अवधिमा बिक्री अर्डर छैन।')}
                        </td>
                      </tr>
                    ) : orders.map(o => (
                      <tr key={o.id}>
                        <td style={td}>{o.order_number}</td>
                        <td style={td}>{o.order_date}</td>
                        <td style={td}>{statusLabel(o.status, tr)}</td>
                        <td style={td}>{money(o.total_amount, currency, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                marginTop: 15,
                padding: 14,
                borderRadius: 11,
                background: '#ecfeff',
                color: '#0e7490',
                fontSize: 13,
              }}>
                {tr('Total sales order value:', 'कुल बिक्री अर्डर रकम:')} <strong>
                  {money(totalOrderValue, currency, language)}
                </strong>
              </div>
            </div>
          )}

          {tab === 'Inventory' && (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>
                {tr('Stock Report', 'मौज्दात प्रतिवेदन')}
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                gap: 12,
                marginBottom: 20,
              }}>
                <div style={{
                  background: '#eef2ff',
                  padding: 15,
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 12, color: '#6366f1' }}>
                    {tr('Stock Quantity', 'मौज्दात परिमाण')}
                  </div>
                  <strong style={{ fontSize: 22 }}>
                    {stockQuantity.toLocaleString(dateLocale)}
                  </strong>
                </div>

                <div style={{
                  background: '#ecfdf5',
                  padding: 15,
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 12, color: '#059669' }}>
                    {tr('Stock Value', 'मौज्दात मूल्य')}
                  </div>
                  <strong style={{ fontSize: 18 }}>
                    {money(stockValue, currency, language)}
                  </strong>
                </div>

                <div style={{
                  background: '#fff7ed',
                  padding: 15,
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 12, color: '#ea580c' }}>
                    {tr('Low Stock Products', 'कम मौज्दात भएका सामान')}
                  </div>
                  <strong style={{ fontSize: 22 }}>
                    {lowStock.length.toLocaleString(dateLocale)}
                  </strong>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 600,
                  fontSize: 13,
                }}>
                  <thead>
                    <tr>
                      {[
                        tr('Product', 'उत्पादन'),
                        'SKU',
                        tr('Quantity', 'परिमाण'),
                        tr('Average Cost', 'औसत लागत'),
                        tr('Stock Value', 'मौज्दात मूल्य'),
                        tr('Reorder Level', 'पुनः अर्डर स्तर'),
                      ].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {inventory.length === 0 ? (
                      <tr>
                        <td style={td} colSpan={6}>
                          {tr('No inventory records found.', 'मौज्दात रेकर्ड भेटिएन।')}
                        </td>
                      </tr>
                    ) : inventory.map(item => (
                      <tr key={item.id}>
                        <td style={td}>
                          {item.products?.product_name || tr('Unknown', 'अज्ञात')}
                        </td>
                        <td style={td}>{item.products?.sku || '—'}</td>
                        <td style={td}>
                          {Number(item.quantity_on_hand || 0).toLocaleString(dateLocale)}
                        </td>
                        <td style={td}>
                          {money(item.average_cost, currency, language)}
                        </td>
                        <td style={td}>
                          {money(
                            Number(item.quantity_on_hand || 0) *
                            Number(item.average_cost || 0),
                            currency,
                            language
                          )}
                        </td>
                        <td style={td}>
                          {Number(item.reorder_level || 0).toLocaleString(dateLocale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Outstanding' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                gap: 14,
              }}>
                <MetricCard
                  title={tr('Customer Outstanding', 'ग्राहकबाट उठाउन बाँकी')}
                  value={customerDueTotal}
                  currency={currency}
                  color="#db2777"
                  icon="♙"
                  note={tr('Total customer balances', 'ग्राहकको कुल बाँकी रकम')}
                  language={language}
                />

                <MetricCard
                  title={tr('Supplier Outstanding', 'आपूर्तिकर्तालाई तिर्न बाँकी')}
                  value={supplierDueTotal}
                  currency={currency}
                  color="#475569"
                  icon="♧"
                  note={tr('Total supplier balances', 'आपूर्तिकर्ताको कुल बाँकी रकम')}
                  language={language}
                />
              </div>

              <div style={card}>
                <h3>{tr('Customers with Outstanding Balance', 'बाँकी रकम भएका ग्राहकहरू')}</h3>

                {filteredCustomers.length === 0 ? (
                  <p>{tr('No outstanding customer balances.', 'कुनै ग्राहकको बाँकी रकम छैन।')}</p>
                ) : filteredCustomers.map(c => (
                  <div key={c.id} style={{
                    ...td,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}>
                    <span>
                      {c.full_name} {c.phone ? `(${c.phone})` : ''}
                    </span>
                    <strong>
                      {money(
                        Number(c.opening_balance || 0) +
                        Number(outstandingCustomers[c.id] || 0),
                        currency,
                        language
                      )}
                    </strong>
                  </div>
                ))}
              </div>

              <div style={card}>
                <h3>{tr('Suppliers with Outstanding Balance', 'बाँकी रकम भएका आपूर्तिकर्ताहरू')}</h3>

                {filteredSuppliers.length === 0 ? (
                  <p>{tr('No outstanding supplier balances.', 'कुनै आपूर्तिकर्ताको बाँकी रकम छैन।')}</p>
                ) : filteredSuppliers.map(s => (
                  <div key={s.id} style={{
                    ...td,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}>
                    <span>
                      {s.supplier_name} {s.phone ? `(${s.phone})` : ''}
                    </span>
                    <strong>
                      {money(
                        Number(s.opening_balance || 0) +
                        Number(outstandingSuppliers[s.id] || 0),
                        currency,
                        language
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
