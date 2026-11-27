
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

type Props = {
  companyId: string;
  branchId: string;
  currency: string;
};

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  selling_price: number;
  tax_rate: number;
  track_stock: boolean;
  stock: number;
};

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Sale = {
  id: string;
  bill_number: string;
  sale_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: string;
  customer_id: string | null;
};

const paymentMethods = ['cash', 'bank', 'card', 'wallet', 'cheque', 'other'];

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: 20, color: '#172438' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 25, fontWeight: 800, margin: 0 },
  muted: { color: '#718096', fontSize: 13 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: { border: '1px solid #DCE1E8', borderRadius: 9, padding: '10px 16px', background: '#fff', color: '#26364D', cursor: 'pointer', fontWeight: 700 },
  activeTab: { background: '#172438', color: '#fff', borderColor: '#172438' },
  panel: { background: '#fff', border: '1px solid #E5E8ED', borderRadius: 14, padding: 20, minWidth: 0 },
  input: { width: '100%', padding: '11px 12px', border: '1px solid #D7DDE5', borderRadius: 8, background: '#fff', color: '#172438', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#59677B', marginBottom: 6 },
  button: { border: 0, borderRadius: 8, padding: '11px 16px', background: '#172438', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  goldButton: { border: 0, borderRadius: 8, padding: '11px 16px', background: '#B18A42', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  secondaryButton: { border: '1px solid #DCE1E8', borderRadius: 8, padding: '9px 12px', background: '#fff', color: '#26364D', cursor: 'pointer', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  product: { border: '1px solid #E4E8ED', borderRadius: 10, padding: 13, background: '#fff', display: 'grid', gap: 8 },
  tableWrap: { overflowX: 'auto', width: '100%' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 650 },
  th: { textAlign: 'left', padding: 12, background: '#F4F2ED', color: '#45536A', fontSize: 12, whiteSpace: 'nowrap' },
  td: { padding: 12, borderBottom: '1px solid #ECEFF2', fontSize: 13 },
  total: { display: 'flex', justifyContent: 'space-between', gap: 15, padding: '8px 0', fontSize: 14 },
  error: { padding: 12, borderRadius: 8, background: '#FFF0F0', color: '#A32D2D', fontSize: 13 },
  success: { padding: 12, borderRadius: 8, background: '#EAF8EF', color: '#247443', fontSize: 13 },
};

export default function SalesManager({ companyId, branchId, currency }: Props) {
  const { language } = useLanguage();
  const ne = language === 'ne';

  const tr = (english: string, nepali: string) =>
    ne ? nepali : english;

  const locale = ne ? 'ne-NP' : 'en-IN';

  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [saleCostItems, setSaleCostItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastBill, setLastBill] = useState<any>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const money = (value: number) =>
    `${currency} ${Number(value || 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  function paymentLabel(method: string) {
    const labels: Record<string, [string, string]> = {
      cash: ['Cash', 'नगद'],
      bank: ['Bank Transfer', 'बैंक ट्रान्सफर'],
      card: ['Card', 'कार्ड'],
      wallet: ['Digital Wallet', 'डिजिटल वालेट'],
      cheque: ['Cheque', 'चेक'],
      other: ['Other', 'अन्य'],
    };

    const label = labels[method.toLowerCase()];
    return label ? tr(label[0], label[1]) : method;
  }

  function statusLabel(status: string) {
    const value = status.toLowerCase();

    if (value === 'paid') return tr('Paid', 'भुक्तानी भयो');
    if (value === 'partial') return tr('Partially Paid', 'आंशिक भुक्तानी');
    if (value === 'unpaid') return tr('Unpaid', 'भुक्तानी बाँकी');
    if (value === 'pending') return tr('Pending', 'विचाराधीन');
    if (value === 'completed') return tr('Completed', 'पूरा भयो');

    return status;
  }

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [productResult, stockResult, customerResult, salesResult] =
        await Promise.all([
          supabase
            .from('products')
            .select('id,product_name,sku,barcode,unit,selling_price,tax_rate,track_stock')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('product_name'),

          supabase
            .from('branch_inventory')
            .select('product_id,quantity_on_hand')
            .eq('company_id', companyId)
            .eq('branch_id', branchId),

          supabase
            .from('customers')
            .select('id,full_name,phone')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('full_name'),

          supabase
            .from('sales')
            .select('*')
            .eq('company_id', companyId)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

      if (productResult.error) throw productResult.error;
      if (stockResult.error) throw stockResult.error;
      if (customerResult.error) throw customerResult.error;
      if (salesResult.error) throw salesResult.error;

      // Load the product costs for the sales displayed in history.
      const saleIds = (salesResult.data || []).map(
        (sale: any) => sale.id
      );

      let costItems: any[] = [];

      if (saleIds.length > 0) {
        const { data: costData, error: costError } = await supabase
          .from('sale_items')
          .select('sale_id,quantity,unit_cost')
          .eq('company_id', companyId)
          .in('sale_id', saleIds);

        if (costError) throw costError;

        costItems = costData || [];
      }

      setSaleCostItems(costItems);

      const stockMap = new Map(
        (stockResult.data || []).map((item: any) => [
          item.product_id,
          Number(item.quantity_on_hand || 0),
        ])
      );

      setProducts(
        (productResult.data || []).map((p: any) => ({
          ...p,
          selling_price: Number(p.selling_price || 0),
          tax_rate: Number(p.tax_rate || 0),
          stock: Number(stockMap.get(p.id) || 0),
        }))
      );

      setCustomers(customerResult.data || []);
      setSales(salesResult.data || []);
    } catch (err: any) {
      setError(
        err.message ||
        tr('Unable to load sales data.', 'बिक्री विवरण लोड गर्न सकिएन।')
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [companyId, branchId]);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return products;

    return products.filter(
      p =>
        p.product_name.toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term)
    );
  }, [products, search]);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.selling_price * item.quantity,
    0
  );

  const taxTotal = cart.reduce(
    (sum, item) =>
      sum +
      (item.product.selling_price *
        item.quantity *
        item.product.tax_rate) /
        100,
    0
  );

  const total = Number((subtotal + taxTotal).toFixed(2));
  const paid = Number(paidAmount || 0);
  const due = Math.max(0, total - paid);

  // Calculate all financial totals for the loaded sales.
  const salesSummary = useMemo(() => {
    const validSales = sales.filter(
      sale =>
        !['cancelled', 'void', 'draft'].includes(
          String(sale.status || '').toLowerCase()
        )
    );

    const validSaleIds = new Set(
      validSales.map(sale => sale.id)
    );

    const totalSales = validSales.reduce(
      (sum, sale) => sum + Number(sale.total_amount || 0),
      0
    );

    const totalCost = saleCostItems.reduce((sum, item) => {
      if (!validSaleIds.has(item.sale_id)) return sum;

      return (
        sum +
        Number(item.quantity || 0) *
          Number(item.unit_cost || 0)
      );
    }, 0);

    return {
      totalSales,

      totalReceived: validSales.reduce(
        (sum, sale) => sum + Number(sale.paid_amount || 0),
        0
      ),

      totalDue: validSales.reduce(
        (sum, sale) => sum + Number(sale.due_amount || 0),
        0
      ),

      totalDiscount: validSales.reduce(
        (sum, sale) =>
          sum + Number((sale as any).discount_amount || 0),
        0
      ),

      totalCost,

      totalProfit: totalSales - totalCost,

      count: validSales.length,
    };
  }, [sales, saleCostItems]);

  function addToCart(product: Product) {
    setError('');
    setMessage('');
    setQuantityDrafts(current => {
      const updated = { ...current };
      delete updated[product.id];
      return updated;
    });

    if (product.track_stock && product.stock <= 0) {
      setError(
        `${product.product_name} ${
          tr('is out of stock.', 'को स्टक सकिएको छ।')
        }`
      );
      return;
    }

    setCart(current => {
      const existing = current.find(
        item => item.product.id === product.id
      );

      if (existing) {
        if (
          product.track_stock &&
          existing.quantity + 1 > product.stock
        ) {
          setError(
            `${tr('Only', 'जम्मा')} ${product.stock} ${
              tr('units of', 'एकाइ मात्र उपलब्ध छन्:')
            } ${product.product_name}.`
          );
          return current;
        }

        return current.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return;
  
    const product = products.find(p => p.id === productId);
  
    if (product?.track_stock && quantity > product.stock) {
      setError(
        `${tr('Available stock is only', 'उपलब्ध स्टक जम्मा')} ${product.stock}.`
      );
      return;
    }
  
    setError('');
  
    setCart(current =>
      current.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  }
  
  function handleQuantityInput(productId: string, value: string) {
    setQuantityDrafts(current => ({
      ...current,
      [productId]: value,
    }));
  
    if (value.trim() === '') return;
  
    const quantity = Number(value);
  
    if (Number.isInteger(quantity) && quantity >= 1) {
      changeQuantity(productId, quantity);
    }
  }
  
  function finishQuantityEdit(productId: string) {
    const item = cart.find(item => item.product.id === productId);
  
    if (!item) return;
  
    setQuantityDrafts(current => ({
      ...current,
      [productId]: String(item.quantity),
    }));
  }
  
  function removeCartItem(productId: string) {
    setCart(current =>
      current.filter(item => item.product.id !== productId)
    );
  
    setQuantityDrafts(current => {
      const updated = { ...current };
      delete updated[productId];
      return updated;
    });
  
    setError('');
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!newCustomerName.trim()) {
      setError(tr('Enter the customer name.', 'ग्राहकको नाम लेख्नुहोस्।'));
      return;
    }

    setSaving(true);

    try {
      const { data, error: insertError } = await supabase
        .from('customers')
        .insert({
          company_id: companyId,
          full_name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
        })
        .select('id,full_name,phone')
        .single();

      if (insertError) throw insertError;

      setCustomers(current => [...current, data]);
      setCustomerId(data.id);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setShowCustomerForm(false);

      setMessage(
        tr('Customer added successfully.', 'ग्राहक सफलतापूर्वक थपियो।')
      );
    } catch (err: any) {
      setError(
        err.message ||
        tr('Could not create customer.', 'ग्राहक थप्न सकिएन।')
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeSale() {
    setError('');
    setMessage('');

    if (cart.length === 0) {
      setError(
        tr('Please add at least one product.', 'कम्तीमा एउटा उत्पादन थप्नुहोस्।')
      );
      return;
    }

    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      setError(
        tr('Enter a valid received amount.', 'प्राप्त रकम सही रूपमा लेख्नुहोस्।')
      );
      return;
    }

    if (due > 0 && !customerId) {
      setError(
        tr(
          'Select a customer before creating a bill with an unpaid balance.',
          'भुक्तानी बाँकी राखेर बिल बनाउनुअघि ग्राहक छान्नुहोस्।'
        )
      );
      return;
    }

    if (
      !window.confirm(
        `${tr('Complete this sale for', 'यो बिक्री पूरा गर्ने रकम')} ${money(total)}?`
      )
    ) return;

    setSaving(true);

    try {
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      const { data, error: saleError } = await supabase.rpc(
        'pos_create_sale',
        {
          p_company_id: companyId,
          p_branch_id: branchId,
          p_customer_id: customerId || null,
          p_items: items,
          p_paid_amount: paid,
          p_payment_method: paymentMethod,
        }
      );

      if (saleError) throw saleError;

      setLastBill({
        ...data,
        customer_name:
          customers.find(c => c.id === customerId)?.full_name ||
          tr('Walk-in Customer', 'साधारण ग्राहक'),
        items: [...cart],
        date: new Date().toISOString(),
      });

      setCart([]);
      setQuantityDrafts({});
      setCustomerId('');
      setPaidAmount('');
      setPaymentMethod('cash');
      setSearch('');

      setMessage(
        `${tr('Sale completed. Bill number:', 'बिक्री पूरा भयो। बिल नम्बर:')} ${data.bill_number}`
      );

      await loadData();
    } catch (err: any) {
      setError(
        err.message ||
        tr('Could not complete the sale.', 'बिक्री पूरा गर्न सकिएन।')
      );
    } finally {
      setSaving(false);
    }
  }

  async function openSale(sale: Sale) {
    setSelectedSale(sale);
    setError('');

    const { data, error: itemError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale.id)
      .eq('company_id', companyId);

    if (itemError) {
      setError(itemError.message);
      return;
    }

    setSaleItems(data || []);
  }

  function printReceipt(sale?: any) {
    if (!sale) return;

    const receiptText = {
      title: tr('Sales Receipt', 'बिक्री रसिद'),
      bill: tr('Bill Number:', 'बिल नम्बर:'),
      customer: tr('Customer:', 'ग्राहक:'),
      date: tr('Date:', 'मिति:'),
      product: tr('Product', 'उत्पादन'),
      qty: tr('Qty', 'परिमाण'),
      price: tr('Price', 'मूल्य'),
      total: tr('Total', 'जम्मा'),
      noProducts: tr('No product details available', 'उत्पादन विवरण उपलब्ध छैन'),
      grandTotal: tr('Grand Total', 'कुल जम्मा'),
      amountPaid: tr('Amount Paid', 'तिरेको रकम'),
      balanceDue: tr('Balance Due', 'तिर्न बाँकी'),
      thanks: tr(
        'Thank you for shopping with D.R GLOBAL!',
        'D.R GLOBAL मा किनमेल गर्नुभएकोमा धन्यवाद!'
      ),
    };

    const escapeHtml = (value: any) =>
      String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char] || char));

    const items = sale.items || saleItems.map((item: any) => ({
      product: {
        product_name: item.product_name_snapshot,
        sku: item.sku_snapshot,
        selling_price: Number(item.unit_price),
      },
      quantity: Number(item.quantity),
      lineTotal: Number(item.line_total),
    }));

    const rows = items.map((item: any) => {
      const name =
        item.product?.product_name ||
        item.product_name_snapshot ||
        tr('Product', 'उत्पादन');

      const price =
        item.product?.selling_price ??
        item.unit_price ??
        0;

      const lineTotal =
        item.lineTotal ??
        item.line_total ??
        Number(price) * Number(item.quantity);

      return `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td>${Number(item.quantity)}</td>
          <td>${escapeHtml(money(Number(price)))}</td>
          <td>${escapeHtml(money(Number(lineTotal)))}</td>
        </tr>
      `;
    }).join('');

    const billNumber = sale.bill_number || 'N/A';

    const customerName =
      sale.customer_name ||
      customers.find(c => c.id === sale.customer_id)?.full_name ||
      tr('Walk-in Customer', 'साधारण ग्राहक');

    const totalAmount = Number(sale.total_amount ?? sale.total ?? 0);
    const paidAmountValue = Number(sale.paid_amount ?? sale.paid ?? 0);
    const dueAmount = Number(sale.due_amount ?? sale.due ?? 0);

    const saleDate = sale.sale_date || sale.date || new Date().toISOString();

    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="${ne ? 'ne' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(receiptText.title)} ${escapeHtml(billNumber)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #172438;
            max-width: 750px;
            margin: auto;
          }
          h1 {
            text-align: center;
            margin-bottom: 5px;
            font-size: 28px;
          }
          .sub {
            text-align: center;
            color: #666;
            margin-bottom: 25px;
          }
          .details {
            line-height: 1.8;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
          }
          th, td {
            border-bottom: 1px solid #ddd;
            padding: 12px 7px;
            text-align: left;
            font-size: 13px;
          }
          th {
            background: #f4f2ed;
          }
          .totals {
            margin-top: 25px;
            margin-left: auto;
            width: 280px;
          }
          .totals p {
            display: flex;
            justify-content: space-between;
          }
          .grand {
            border-top: 2px solid #172438;
            padding-top: 10px;
            font-size: 18px;
          }
          .thanks {
            text-align: center;
            margin-top: 45px;
            font-weight: bold;
          }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <h1>D.R GLOBAL</h1>
        <div class="sub">${escapeHtml(receiptText.title)}</div>

        <div class="details">
          <div><b>${escapeHtml(receiptText.bill)}</b> ${escapeHtml(billNumber)}</div>
          <div><b>${escapeHtml(receiptText.customer)}</b> ${escapeHtml(customerName)}</div>
          <div><b>${escapeHtml(receiptText.date)}</b> ${escapeHtml(new Date(saleDate).toLocaleString(locale))}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(receiptText.product)}</th>
              <th>${escapeHtml(receiptText.qty)}</th>
              <th>${escapeHtml(receiptText.price)}</th>
              <th>${escapeHtml(receiptText.total)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4">${escapeHtml(receiptText.noProducts)}</td></tr>`}
          </tbody>
        </table>

        <div class="totals">
          <p><span>${escapeHtml(receiptText.grandTotal)}</span><b>${escapeHtml(money(totalAmount))}</b></p>
          <p><span>${escapeHtml(receiptText.amountPaid)}</span><b>${escapeHtml(money(paidAmountValue))}</b></p>
          <p class="grand"><span>${escapeHtml(receiptText.balanceDue)}</span><b>${escapeHtml(money(dueAmount))}</b></p>
        </div>

        <div class="thanks">
          ${escapeHtml(receiptText.thanks)}
        </div>
      </body>
      </html>
    `;

    const printFrame = document.createElement('iframe');

    printFrame.style.position = 'fixed';
    printFrame.style.width = '1px';
    printFrame.style.height = '1px';
    printFrame.style.left = '-10000px';
    printFrame.style.top = '0';
    printFrame.style.border = '0';

    document.body.appendChild(printFrame);

    const frameDocument = printFrame.contentDocument;
    const frameWindow = printFrame.contentWindow;

    if (!frameDocument || !frameWindow) {
      printFrame.remove();
      setError(
        tr(
          'Unable to prepare receipt for printing. Please try again.',
          'रसिद प्रिन्टका लागि तयार गर्न सकिएन। फेरि प्रयास गर्नुहोस्।'
        )
      );
      return;
    }

    frameWindow.onafterprint = () => {
      printFrame.remove();
    };

    frameDocument.open();
    frameDocument.write(receiptHtml);
    frameDocument.close();

    window.setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } catch (error) {
        printFrame.remove();
        setError(
          tr('Printing failed. Please try again.', 'प्रिन्ट गर्न सकिएन। फेरि प्रयास गर्नुहोस्।')
        );
      }
    }, 700);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            {tr('Sales & Billing', 'बिक्री तथा बिलिङ')}
          </h1>
          <div style={styles.muted}>
            {tr(
              'Create bills, receive payments and manage sales.',
              'बिल बनाउनुहोस्, भुक्तानी लिनुहोस् र बिक्री व्यवस्थापन गर्नुहोस्।'
            )}
          </div>
        </div>

        <button style={styles.secondaryButton} onClick={loadData}>
          {tr('Refresh', 'रिफ्रेस गर्नुहोस्')}
        </button>
      </div>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'new' ? styles.activeTab : {}) }}
          onClick={() => { setTab('new'); setSelectedSale(null); }}
        >
          + {tr('New Sale', 'नयाँ बिक्री')}
        </button>

        <button
          style={{ ...styles.tab, ...(tab === 'history' ? styles.activeTab : {}) }}
          onClick={() => { setTab('history'); setSelectedSale(null); }}
        >
          {tr('Sales History', 'बिक्री इतिहास')}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      {loading && (
        <div style={styles.panel}>
          {tr('Loading sales data...', 'बिक्री विवरण लोड हुँदैछ...')}
        </div>
      )}

      {!loading && tab === 'new' && (
        <>
          {lastBill && (
            <div style={styles.panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <b>{tr('Last sale completed successfully', 'पछिल्लो बिक्री सफलतापूर्वक पूरा भयो')}</b>
                  <div style={styles.muted}>
                    {tr('Bill:', 'बिल:')} {lastBill.bill_number}
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 800 }}>
                    {money(Number(lastBill.total_amount))}
                  </div>
                </div>

                <button style={styles.goldButton} onClick={() => printReceipt(lastBill)}>
                  {tr('Print Receipt', 'रसिद प्रिन्ट गर्नुहोस्')}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18, alignItems: 'start' }}>
            <section style={styles.panel}>
              <h3 style={{ marginTop: 0 }}>
                {tr('Select Products', 'उत्पादन छान्नुहोस्')}
              </h3>

              <input
                style={styles.input}
                placeholder={tr(
                  'Search product name, SKU or barcode...',
                  'उत्पादनको नाम, SKU वा बारकोड खोज्नुहोस्...'
                )}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div style={{ ...styles.grid, marginTop: 15 }}>
                {filteredProducts.map(product => (
                  <div key={product.id} style={styles.product}>
                    <b>{product.product_name}</b>

                    <span style={styles.muted}>
                      {product.sku || tr('No SKU', 'SKU छैन')} · {product.unit}
                    </span>

                    <b style={{ color: '#A77E32' }}>
                      {money(product.selling_price)}
                    </b>

                    <span style={styles.muted}>
                      {product.track_stock
                        ? `${tr('Stock:', 'स्टक:')} ${product.stock}`
                        : tr('Stock not tracked', 'स्टक ट्र्याक गरिएको छैन')}
                    </span>

                    <button
                      style={styles.secondaryButton}
                      onClick={() => addToCart(product)}
                      disabled={product.track_stock && product.stock <= 0}
                    >
                      {product.track_stock && product.stock <= 0
                        ? tr('Out of stock', 'स्टक सकियो')
                        : tr('Add to bill', 'बिलमा थप्नुहोस्')}
                    </button>
                  </div>
                ))}

                {filteredProducts.length === 0 && (
                  <div style={styles.muted}>
                    {tr('No matching products found.', 'मिल्ने उत्पादन भेटिएन।')}
                  </div>
                )}
              </div>
            </section>

            <section style={styles.panel}>
              <h3 style={{ marginTop: 0 }}>
                {tr('Current Bill', 'हालको बिल')}
              </h3>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{tr('Product', 'उत्पादन')}</th>
                      <th style={styles.th}>{tr('Qty', 'परिमाण')}</th>
                      <th style={styles.th}>{tr('Price', 'मूल्य')}</th>
                      <th style={styles.th}>{tr('Total', 'जम्मा')}</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>

                  <tbody>
                    {cart.map(item => (
                      <tr key={item.product.id}>
                        <td style={styles.td}>
                          <b>{item.product.product_name}</b>
                        </td>

                        <td style={styles.td}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={quantityDrafts[item.product.id] ?? String(item.quantity)}
                            style={{ ...styles.input, width: 80, padding: 7 }}
                            onChange={e =>
                              handleQuantityInput(item.product.id, e.target.value)
                            }
                            onBlur={() => finishQuantityEdit(item.product.id)}
                          />
                        </td>

                        <td style={styles.td}>
                          {money(item.product.selling_price)}
                        </td>

                        <td style={styles.td}>
                          {money(item.product.selling_price * item.quantity)}
                        </td>

                        <td style={styles.td}>
                          <button
                            type="button"
                            style={{
                              ...styles.secondaryButton,
                              color: '#D14343',
                              borderColor: '#F0CACA',
                              padding: '6px 9px',
                            }}
                            onClick={() => removeCartItem(item.product.id)}
                            aria-label={tr('Remove product', 'उत्पादन हटाउनुहोस्')}
                          >
                            × {tr('Remove', 'हटाउनुहोस्')}
                          </button>
                        </td>
                      </tr>
                    ))}

                    {cart.length === 0 && (
                      <tr>
                        <td style={styles.td} colSpan={5}>
                          {tr('No products added yet.', 'अहिलेसम्म उत्पादन थपिएको छैन।')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={styles.total}>
                  <span>{tr('Subtotal', 'उप-जम्मा')}</span>
                  <b>{money(subtotal)}</b>
                </div>

                <div style={styles.total}>
                  <span>{tr('Tax', 'कर')}</span>
                  <b>{money(taxTotal)}</b>
                </div>

                <div style={{ ...styles.total, borderTop: '1px solid #E5E8ED', paddingTop: 14, fontSize: 19 }}>
                  <b>{tr('Grand Total', 'कुल जम्मा')}</b>
                  <b>{money(total)}</b>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <label style={styles.label}>
                  {tr('Customer', 'ग्राहक')}
                </label>

                <select
                  style={styles.input}
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                >
                  <option value="">
                    {tr('Walk-in Customer (no credit)', 'साधारण ग्राहक (उधारो छैन)')}
                  </option>

                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}{customer.phone ? ` - ${customer.phone}` : ''}
                    </option>
                  ))}
                </select>

                <button
                  style={{ ...styles.secondaryButton, marginTop: 9 }}
                  onClick={() => setShowCustomerForm(!showCustomerForm)}
                >
                  + {tr('Add New Customer', 'नयाँ ग्राहक थप्नुहोस्')}
                </button>
              </div>

              {showCustomerForm && (
                <form onSubmit={createCustomer} style={{ display: 'grid', gap: 10, marginTop: 14, padding: 14, background: '#F7F8FA', borderRadius: 10 }}>
                  <b>{tr('New Customer', 'नयाँ ग्राहक')}</b>

                  <input
                    style={styles.input}
                    placeholder={tr('Customer full name', 'ग्राहकको पूरा नाम')}
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                  />

                  <input
                    style={styles.input}
                    placeholder={tr('Phone number', 'फोन नम्बर')}
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                  />

                  <button style={styles.button} disabled={saving}>
                    {saving
                      ? tr('Saving...', 'सेभ हुँदैछ...')
                      : tr('Save Customer', 'ग्राहक सेभ गर्नुहोस्')}
                  </button>
                </form>
              )}

              <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
                <div>
                  <label style={styles.label}>
                    {tr('Amount Received', 'प्राप्त रकम')}
                  </label>

                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    style={styles.input}
                    placeholder={tr('Enter received amount', 'प्राप्त रकम लेख्नुहोस्')}
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                  />

                  <div style={styles.muted}>
                    {tr(
                      'Enter the amount actually received from the customer.',
                      'ग्राहकबाट वास्तवमै प्राप्त भएको रकम लेख्नुहोस्।'
                    )}
                  </div>
                </div>

                <div>
                  <label style={styles.label}>
                    {tr('Payment Method', 'भुक्तानी विधि')}
                  </label>

                  <select
                    style={styles.input}
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    {paymentMethods.map(method => (
                      <option key={method} value={method}>
                        {paymentLabel(method)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ background: '#F4F2ED', padding: 14, borderRadius: 9 }}>
                  <div style={styles.total}>
                    <span>{tr('Received', 'प्राप्त भयो')}</span>
                    <b>{money(paid)}</b>
                  </div>

                  <div style={styles.total}>
                    <span>{tr('Balance Due', 'तिर्न बाँकी')}</span>
                    <b style={{ color: due > 0 ? '#B34B38' : '#247443' }}>
                      {money(due)}
                    </b>
                  </div>
                </div>

                <button
                  style={styles.goldButton}
                  disabled={saving || cart.length === 0}
                  onClick={completeSale}
                >
                  {saving
                    ? tr('Processing Sale...', 'बिक्री प्रक्रिया हुँदैछ...')
                    : `${tr('Complete Sale', 'बिक्री पूरा गर्नुहोस्')} · ${money(total)}`}
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={() => {
                    setCart([]);
                    setQuantityDrafts({});
                    setPaidAmount('');
                    setCustomerId('');
                    setError('');
                  }}
                >
                  {tr('Clear Bill', 'बिल खाली गर्नुहोस्')}
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      {!loading && tab === 'history' && (
        <section style={styles.panel}>
          <h3 style={{ marginTop: 0 }}>
            {tr('Sales History', 'बिक्री इतिहास')}
          </h3>

          {/* SALES FINANCIAL SUMMARY */}
          <div style={styles.grid}>
            {[
              {
                title: tr('Total Sales', 'कुल बिक्री'),
                value: salesSummary.totalSales,
                color: '#2563EB',
                background: '#EFF6FF',
              },
              {
                title: tr('Total Received', 'कुल प्राप्त रकम'),
                value: salesSummary.totalReceived,
                color: '#15803D',
                background: '#F0FDF4',
              },
              {
                title: tr('Balance Due', 'तिर्न बाँकी'),
                value: salesSummary.totalDue,
                color: '#D97706',
                background: '#FFFBEB',
              },
              {
                title: tr('Total Discount', 'कुल छुट'),
                value: salesSummary.totalDiscount,
                color: '#9333EA',
                background: '#FAF5FF',
              },
              {
                title: tr('Total Profit', 'कुल नाफा'),
                value: salesSummary.totalProfit,
                color: '#047857',
                background: '#ECFDF5',
              },
            ].map(item => (
              <div
                key={item.title}
                style={{
                  padding: 18,
                  borderRadius: 12,
                  background: item.background,
                  border: '1px solid #E5E8ED',
                }}
              >
                <div style={{
                  fontSize: 13,
                  color: '#64748B',
                  fontWeight: 700,
                }}>
                  {item.title}
                </div>

                <div style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: item.color,
                  marginTop: 9,
                }}>
                  {money(item.value)}
                </div>

                <div style={{
                  fontSize: 11,
                  color: '#718096',
                  marginTop: 5,
                }}>
                  {salesSummary.count} {tr('sales recorded', 'बिक्री रेकर्ड')}
                </div>
              </div>
            ))}
          </div>

          {selectedSale ? (
            <>
              <button
                style={{ ...styles.secondaryButton, marginTop: 18 }}
                onClick={() => setSelectedSale(null)}
              >
                ← {tr('Back to Sales', 'बिक्री सूचीमा फर्कनुहोस्')}
              </button>

              <h3>{selectedSale.bill_number}</h3>

              <p style={styles.muted}>
                {new Date(selectedSale.sale_date).toLocaleString(locale)}
              </p>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{tr('Product', 'उत्पादन')}</th>
                      <th style={styles.th}>{tr('Quantity', 'परिमाण')}</th>
                      <th style={styles.th}>{tr('Unit Price', 'प्रति एकाइ मूल्य')}</th>
                      <th style={styles.th}>{tr('Line Total', 'लाइन जम्मा')}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {saleItems.map((item: any) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{item.product_name_snapshot}</td>
                        <td style={styles.td}>{item.quantity}</td>
                        <td style={styles.td}>{money(Number(item.unit_price))}</td>
                        <td style={styles.td}>{money(Number(item.line_total))}</td>
                      </tr>
                    ))}

                    {saleItems.length === 0 && (
                      <tr>
                        <td style={styles.td} colSpan={4}>
                          {tr('No product details available.', 'उत्पादन विवरण उपलब्ध छैन।')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ maxWidth: 360, marginLeft: 'auto', marginTop: 15 }}>
                <div style={styles.total}>
                  <span>{tr('Total', 'जम्मा')}</span>
                  <b>{money(Number(selectedSale.total_amount))}</b>
                </div>

                <div style={styles.total}>
                  <span>{tr('Paid', 'तिरेको')}</span>
                  <b>{money(Number(selectedSale.paid_amount))}</b>
                </div>

                <div style={styles.total}>
                  <span>{tr('Due', 'बाँकी')}</span>
                  <b>{money(Number(selectedSale.due_amount))}</b>
                </div>
              </div>

              <button
                style={{ ...styles.goldButton, marginTop: 15 }}
                onClick={() => printReceipt(selectedSale)}
              >
                {tr('Print This Receipt', 'यो रसिद प्रिन्ट गर्नुहोस्')}
              </button>
            </>
          ) : (
            <div style={{ ...styles.tableWrap, marginTop: 20 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{tr('Bill Number', 'बिल नम्बर')}</th>
                    <th style={styles.th}>{tr('Date', 'मिति')}</th>
                    <th style={styles.th}>{tr('Total', 'जम्मा')}</th>
                    <th style={styles.th}>{tr('Paid', 'तिरेको')}</th>
                    <th style={styles.th}>{tr('Due', 'बाँकी')}</th>
                    <th style={styles.th}>{tr('Status', 'स्थिति')}</th>
                    <th style={styles.th}>{tr('Action', 'कार्य')}</th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id}>
                      <td style={styles.td}>
                        <b>{sale.bill_number}</b>
                      </td>

                      <td style={styles.td}>
                        {new Date(sale.sale_date).toLocaleDateString(locale)}
                      </td>

                      <td style={styles.td}>
                        {money(Number(sale.total_amount))}
                      </td>

                      <td style={styles.td}>
                        {money(Number(sale.paid_amount))}
                      </td>

                      <td style={styles.td}>
                        {money(Number(sale.due_amount))}
                      </td>

                      <td style={styles.td}>
                        {statusLabel(sale.status)}
                      </td>

                      <td style={styles.td}>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => openSale(sale)}
                        >
                          {tr('View Bill', 'बिल हेर्नुहोस्')}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {sales.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan={7}>
                        {tr('No sales recorded yet.', 'अहिलेसम्म कुनै बिक्री रेकर्ड गरिएको छैन।')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
