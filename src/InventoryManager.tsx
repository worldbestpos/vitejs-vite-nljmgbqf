
import {
  useEffect,
  useState,
  type FormEvent,
  type CSSProperties,
} from 'react';
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
  unit: string | null;
  purchase_price: number;
};

type Stock = {
  id: string;
  product_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_level: number;
  average_cost: number;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity_delta: number;
  unit_cost: number;
  notes: string | null;
  created_at: string;
};

export default function InventoryManager({
  companyId,
  branchId,
  currency,
}: Props) {
  const { language } = useLanguage();
  const ne = language === 'ne';

  const tr = (english: string, nepali: string) =>
    ne ? nepali : english;

  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState('opening');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');

  const [reorderValues, setReorderValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReorder, setSavingReorder] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const money = (value: number) =>
    new Intl.NumberFormat(ne ? 'ne-NP' : 'en-IN', {
      style: 'currency',
      currency: currency || 'NPR',
      maximumFractionDigits: 2,
    }).format(value);

  const productName = (id: string) =>
    products.find((p) => p.id === id)?.product_name ||
    tr('Unknown product', 'अज्ञात सामान');

  const stockFor = (id: string) =>
    stocks.find((s) => s.product_id === id);

  async function loadData() {
    setLoading(true);
    setError('');

    const [productResult, stockResult, movementResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, product_name, sku, unit, purchase_price')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('product_name'),

      supabase
        .from('branch_inventory')
        .select(
          'id, product_id, quantity_on_hand, quantity_reserved, reorder_level, average_cost'
        )
        .eq('company_id', companyId)
        .eq('branch_id', branchId),

      supabase
        .from('stock_movements')
        .select(
          'id, product_id, movement_type, quantity_delta, unit_cost, notes, created_at'
        )
        .eq('company_id', companyId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (productResult.error) {
      setError(productResult.error.message);
    } else {
      setProducts((productResult.data || []) as Product[]);
    }

    if (stockResult.error) {
      setError(stockResult.error.message);
    } else {
      const rows = (stockResult.data || []) as Stock[];
      setStocks(rows);

      const values: Record<string, string> = {};
      rows.forEach((s) => {
        values[s.product_id] = String(s.reorder_level);
      });
      setReorderValues(values);
    }

    if (movementResult.error) {
      setError(movementResult.error.message);
    } else {
      setMovements((movementResult.data || []) as Movement[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [companyId, branchId]);

  function handleProductChange(id: string) {
    setProductId(id);
    const selected = products.find((p) => p.id === id);
    setUnitCost(selected ? String(selected.purchase_price || 0) : '');
  }

  async function handleStockSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMessage('');

    const amount = Number(quantity);
    const cost = Number(unitCost || 0);

    if (!productId) {
      setError(tr('Please select a product.', 'कृपया सामान छान्नुहोस्।'));
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        tr(
          'Enter a quantity greater than zero.',
          'शून्यभन्दा ठूलो परिमाण प्रविष्ट गर्नुहोस्।'
        )
      );
      return;
    }

    if (!Number.isFinite(cost) || cost < 0) {
      setError(
        tr('Enter a valid unit cost.', 'कृपया सही एकाइ लागत प्रविष्ट गर्नुहोस्।')
      );
      return;
    }

    const delta =
      movementType === 'reduce' || movementType === 'damage'
        ? -amount
        : amount;

    const rpcMovementType =
      movementType === 'reduce' ? 'adjustment' : movementType;

    setSaving(true);

    const { error: rpcError } = await supabase.rpc('pos_adjust_stock', {
      p_company_id: companyId,
      p_branch_id: branchId,
      p_product_id: productId,
      p_quantity_delta: delta,
      p_movement_type: rpcMovementType,
      p_unit_cost: cost,
      p_notes: notes.trim() || null,
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setMessage(
      tr('Stock updated successfully.', 'स्टक सफलतापूर्वक अपडेट भयो।')
    );
    setQuantity('');
    setNotes('');

    await loadData();
  }

  async function saveReorderLevel(product: Product) {
    setError('');
    setMessage('');

    const value = Number(reorderValues[product.id]);

    if (!Number.isFinite(value) || value < 0) {
      setError(
        tr(
          'Reorder level must be zero or greater.',
          'पुनः अर्डर स्तर शून्य वा सोभन्दा बढी हुनुपर्छ।'
        )
      );
      return;
    }

    setSavingReorder(product.id);

    const existing = stockFor(product.id);

    const { error: updateError } = await supabase
      .from('branch_inventory')
      .upsert(
        {
          company_id: companyId,
          branch_id: branchId,
          product_id: product.id,
          quantity_on_hand: existing?.quantity_on_hand ?? 0,
          quantity_reserved: existing?.quantity_reserved ?? 0,
          average_cost: existing?.average_cost ?? 0,
          reorder_level: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id,product_id' }
      );

    setSavingReorder('');

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      tr(
        `Reorder level saved for ${product.product_name}.`,
        `${product.product_name} को पुनः अर्डर स्तर सेभ भयो।`
      )
    );

    await loadData();
  }

  const filteredProducts = products.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.product_name.toLowerCase().includes(term) ||
      (p.sku || '').toLowerCase().includes(term)
    );
  });

  const getQuantities = (product: Product) => {
    const s = stockFor(product.id);
    const onHand = Number(s?.quantity_on_hand || 0);
    const reserved = Number(s?.quantity_reserved || 0);
    const available = onHand - reserved;
    const reorder = Number(
      reorderValues[product.id] ?? s?.reorder_level ?? 0
    );

    return { onHand, reserved, available, reorder };
  };

  const outOfStockCount = products.filter(
    (p) => getQuantities(p).available <= 0
  ).length;

  const lowStockCount = products.filter((p) => {
    const q = getQuantities(p);
    return q.available > 0 && q.available <= q.reorder;
  }).length;

  const totalUnits = stocks.reduce(
    (sum, s) => sum + Number(s.quantity_on_hand || 0),
    0
  );

  const filteredMovements = movements.filter((m) => {
    if (movementFilter === 'all') return true;
    if (movementFilter === 'add') return Number(m.quantity_delta) > 0;
    if (movementFilter === 'reduce') {
      return Number(m.quantity_delta) < 0 && m.movement_type !== 'damage';
    }
    if (movementFilter === 'damage') return m.movement_type === 'damage';
    return true;
  });

  const movementLabel = (movement: Movement) => {
    if (movement.movement_type === 'opening') {
      return tr('Opening Stock', 'सुरुवातीको स्टक');
    }

    if (movement.movement_type === 'damage') {
      return tr('Damaged / Lost', 'क्षति / हराएको');
    }

    if (Number(movement.quantity_delta) < 0) {
      return tr('Stock Reduced', 'स्टक घटाइयो');
    }

    return tr('Stock Added', 'स्टक थपियो');
  };

  if (loading) {
    return (
      <div style={panel}>
        {tr('Loading inventory...', 'इन्भेन्टरी लोड हुँदैछ...')}
      </div>
    );
  }

  return (
    <div style={page}>
      <div>
        <h2 style={{ marginBottom: 5 }}>
          {tr('Inventory Management', 'इन्भेन्टरी व्यवस्थापन')}
        </h2>
        <p style={muted}>
          {tr(
            'Manage stock, reorder levels and stock movements for your branch.',
            'आफ्नो शाखाको स्टक, पुनः अर्डर स्तर र स्टक कारोबार व्यवस्थापन गर्नुहोस्।'
          )}
        </p>
      </div>

      <div style={grid}>
        <div style={statCard}>
          <small>{tr('Total Products', 'कुल सामान')}</small>
          <h2>{products.length}</h2>
        </div>

        <div style={statCard}>
          <small>{tr('Total Units in Stock', 'स्टकमा रहेका कुल एकाइ')}</small>
          <h2>{totalUnits.toLocaleString(ne ? 'ne-NP' : 'en-IN')}</h2>
        </div>

        <div style={statCard}>
          <small>{tr('Low Stock', 'कम स्टक')}</small>
          <h2 style={{ color: '#d97706' }}>{lowStockCount}</h2>
        </div>

        <div style={statCard}>
          <small>{tr('Out of Stock', 'स्टक सकिएको')}</small>
          <h2 style={{ color: '#dc2626' }}>{outOfStockCount}</h2>
        </div>
      </div>

      {error && <p style={errorStyle}>{error}</p>}
      {message && <p style={successStyle}>{message}</p>}

      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div style={alertPanel}>
          <h3 style={{ marginTop: 0 }}>
            {tr('Inventory Alerts', 'इन्भेन्टरी चेतावनी')}
          </h3>

          {outOfStockCount > 0 && (
            <p style={{ color: '#b91c1c', marginBottom: 5 }}>
              {ne
                ? `${outOfStockCount} वटा सामानको स्टक सकिएको छ।`
                : `${outOfStockCount} product(s) are out of stock.`}
            </p>
          )}

          {lowStockCount > 0 && (
            <p style={{ color: '#b45309', marginBottom: 5 }}>
              {ne
                ? `${lowStockCount} वटा सामानको स्टक पुनः अर्डर स्तरभन्दा कम छ।`
                : `${lowStockCount} product(s) are below their reorder level.`}
            </p>
          )}
        </div>
      )}

      <div style={panel}>
        <h3 style={{ marginTop: 0 }}>
          {tr('Stock Actions', 'स्टक सम्बन्धी कार्यहरू')}
        </h3>

        <form onSubmit={handleStockSubmit} style={formGrid}>
          <label style={label}>
            {tr('Product', 'सामान')}
            <select
              style={input}
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              required
            >
              <option value="">
                {tr('Select product', 'सामान छान्नुहोस्')}
              </option>

              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name} {p.sku ? `(${p.sku})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            {tr('Action', 'कार्य')}
            <select
              style={input}
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="opening">
                {tr('Opening Stock', 'सुरुवातीको स्टक')}
              </option>
              <option value="adjustment">
                {tr('Add Stock', 'स्टक थप्नुहोस्')}
              </option>
              <option value="reduce">
                {tr('Reduce Stock', 'स्टक घटाउनुहोस्')}
              </option>
              <option value="damage">
                {tr('Damaged / Lost', 'क्षति / हराएको')}
              </option>
            </select>
          </label>

          <label style={label}>
            {tr('Quantity', 'परिमाण')}
            <input
              style={input}
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={tr('Enter quantity', 'परिमाण प्रविष्ट गर्नुहोस्')}
              required
            />
          </label>

          <label style={label}>
            {tr('Unit Cost', 'प्रति एकाइ लागत')}
            <input
              style={input}
              type="number"
              min="0"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder={tr('Cost per unit', 'प्रति एकाइ लागत')}
            />
          </label>

          <label style={{ ...label, gridColumn: '1 / -1' }}>
            {tr('Notes / Reference', 'कैफियत / सन्दर्भ')}
            <input
              style={input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr(
                'Optional reason, supplier or reference',
                'वैकल्पिक कारण, आपूर्तिकर्ता वा सन्दर्भ'
              )}
            />
          </label>

          <button
            type="submit"
            style={button}
            disabled={saving || products.length === 0}
          >
            {saving
              ? tr('Saving...', 'सेभ हुँदैछ...')
              : tr('Save Stock Movement', 'स्टक कारोबार सेभ गर्नुहोस्')}
          </button>
        </form>
      </div>

      <div style={panel}>
        <h3 style={{ marginTop: 0 }}>
          {tr('Current Stock', 'हालको स्टक')}
        </h3>

        <input
          style={{ ...input, maxWidth: 360, marginBottom: 15 }}
          placeholder={tr(
            'Search product or SKU...',
            'सामान वा SKU खोज्नुहोस्...'
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>{tr('Product', 'सामान')}</th>
                <th style={th}>SKU</th>
                <th style={th}>{tr('On Hand', 'मौज्दात')}</th>
                <th style={th}>{tr('Reserved', 'सुरक्षित')}</th>
                <th style={th}>{tr('Available', 'उपलब्ध')}</th>
                <th style={th}>{tr('Reorder Level', 'पुनः अर्डर स्तर')}</th>
                <th style={th}>{tr('Average Cost', 'औसत लागत')}</th>
                <th style={th}>{tr('Status', 'अवस्था')}</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((p) => {
                const q = getQuantities(p);
                const low = q.available <= q.reorder;
                const out = q.available <= 0;

                return (
                  <tr key={p.id}>
                    <td style={td}>
                      <strong>{p.product_name}</strong>
                    </td>

                    <td style={td}>{p.sku || '—'}</td>

                    <td style={td}>
                      {q.onHand} {p.unit || 'pcs'}
                    </td>

                    <td style={td}>{q.reserved}</td>

                    <td style={td}>
                      <strong>{q.available}</strong>
                    </td>

                    <td style={td}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <input
                          style={{ ...input, width: 75, padding: 7 }}
                          type="number"
                          min="0"
                          step="0.001"
                          value={reorderValues[p.id] ?? '0'}
                          onChange={(e) =>
                            setReorderValues((previous) => ({
                              ...previous,
                              [p.id]: e.target.value,
                            }))
                          }
                        />

                        <button
                          type="button"
                          style={smallButton}
                          disabled={savingReorder === p.id}
                          onClick={() => saveReorderLevel(p)}
                        >
                          {savingReorder === p.id
                            ? '...'
                            : tr('Save', 'सेभ')}
                        </button>
                      </div>
                    </td>

                    <td style={td}>
                      {money(Number(stockFor(p.id)?.average_cost || 0))}
                    </td>

                    <td style={td}>
                      <span
                        style={{
                          color: out ? '#dc2626' : low ? '#d97706' : '#15803d',
                          fontWeight: 700,
                        }}
                      >
                        {out
                          ? tr('Out of stock', 'स्टक सकिएको')
                          : low
                            ? tr('Low stock', 'कम स्टक')
                            : tr('In stock', 'स्टक उपलब्ध')}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>
                    {tr('No products found.', 'कुनै सामान भेटिएन।')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={panel}>
        <h3 style={{ marginTop: 0 }}>
          {tr('Stock Movement History', 'स्टक कारोबार इतिहास')}
        </h3>

        <p style={muted}>
          {tr(
            'Latest 100 stock movements for this branch.',
            'यस शाखाका पछिल्ला १०० स्टक कारोबारहरू।'
          )}
        </p>

        <select
          style={{ ...input, maxWidth: 220, marginBottom: 15 }}
          value={movementFilter}
          onChange={(e) => setMovementFilter(e.target.value)}
        >
          <option value="all">{tr('All movements', 'सबै कारोबार')}</option>
          <option value="add">{tr('Stock added', 'स्टक थपिएको')}</option>
          <option value="reduce">{tr('Stock reduced', 'स्टक घटाइएको')}</option>
          <option value="damage">{tr('Damaged / Lost', 'क्षति / हराएको')}</option>
        </select>

        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>{tr('Date', 'मिति')}</th>
                <th style={th}>{tr('Product', 'सामान')}</th>
                <th style={th}>{tr('Type', 'प्रकार')}</th>
                <th style={th}>{tr('Quantity Change', 'परिमाण परिवर्तन')}</th>
                <th style={th}>{tr('Unit Cost', 'प्रति एकाइ लागत')}</th>
                <th style={th}>{tr('Notes', 'कैफियत')}</th>
              </tr>
            </thead>

            <tbody>
              {filteredMovements.map((m) => (
                <tr key={m.id}>
                  <td style={td}>
                    {new Date(m.created_at).toLocaleString(
                      ne ? 'ne-NP' : 'en-IN'
                    )}
                  </td>

                  <td style={td}>{productName(m.product_id)}</td>

                  <td style={td}>{movementLabel(m)}</td>

                  <td
                    style={{
                      ...td,
                      color:
                        Number(m.quantity_delta) < 0 ? '#dc2626' : '#15803d',
                      fontWeight: 700,
                    }}
                  >
                    {Number(m.quantity_delta) > 0 ? '+' : ''}
                    {m.quantity_delta}
                  </td>

                  <td style={td}>{money(Number(m.unit_cost || 0))}</td>

                  <td style={td}>{m.notes || '—'}</td>
                </tr>
              ))}

              {filteredMovements.length === 0 && (
                <tr>
                  <td style={td} colSpan={6}>
                    {tr(
                      'No stock movements found.',
                      'कुनै स्टक कारोबार भेटिएन।'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const page: CSSProperties = {
  display: 'grid',
  gap: 22,
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
  gap: 15,
};

const statCard: CSSProperties = {
  background: 'white',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 3px 15px #1822350b',
};

const panel: CSSProperties = {
  background: 'white',
  borderRadius: 13,
  padding: 22,
  boxShadow: '0 3px 15px #1822350b',
};

const alertPanel: CSSProperties = {
  background: '#fffaf0',
  border: '1px solid #f5d9a8',
  borderRadius: 12,
  padding: 18,
};

const formGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
  gap: 14,
};

const label: CSSProperties = {
  display: 'grid',
  gap: 7,
  fontSize: 13,
  fontWeight: 600,
};

const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 11,
  border: '1px solid #dce1e8',
  borderRadius: 7,
  background: 'white',
};

const button: CSSProperties = {
  padding: '12px 18px',
  background: '#182235',
  color: 'white',
  border: 0,
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  justifySelf: 'start',
};

const smallButton: CSSProperties = {
  padding: '7px 9px',
  background: '#182235',
  color: 'white',
  border: 0,
  borderRadius: 6,
  cursor: 'pointer',
};

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  fontSize: 13,
};

const th: CSSProperties = {
  padding: 12,
  background: '#f4f6fa',
  borderBottom: '1px solid #e5e9f0',
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  padding: 12,
  borderBottom: '1px solid #edf0f4',
  whiteSpace: 'nowrap',
};

const muted: CSSProperties = {
  color: '#7b8798',
  marginTop: 0,
};

const errorStyle: CSSProperties = {
  color: '#b91c1c',
  background: '#fff1f1',
  padding: 12,
  borderRadius: 8,
};

const successStyle: CSSProperties = {
  color: '#15803d',
  background: '#ecfdf5',
  padding: 12,
  borderRadius: 8,
};
