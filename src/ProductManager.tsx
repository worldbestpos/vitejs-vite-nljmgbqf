
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

type Props = {
  companyId: string;
  currency: string;
  initialTab: 'Products' | 'Categories';
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  purchase_price: number;
  selling_price: number;
  unit: string;
  track_stock: boolean;
  is_active: boolean;
};

const emptyProduct = {
  product_name: '',
  sku: '',
  barcode: '',
  category_id: '',
  purchase_price: '0',
  selling_price: '0',
  unit: 'pcs',
};

export default function ProductManager({
  companyId,
  currency,
  initialTab,
}: Props) {
  const { language } = useLanguage();
  const ne = language === 'ne';

  const tr = (english: string, nepali: string) =>
    ne ? nepali : english;

  const [tab, setTab] = useState(initialTab);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadData();
  }, [companyId]);

  async function loadData() {
    setError('');

    const [p, c] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name'),
    ]);

    if (p.error) setError(p.error.message);
    else setProducts((p.data || []) as Product[]);

    if (c.error) setError(c.error.message);
    else setCategories((c.data || []) as Category[]);
  }

  function startNewProduct() {
    setEditingId(null);
    setProductForm(emptyProduct);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function editProduct(p: Product) {
    setEditingId(p.id);
    setProductForm({
      product_name: p.product_name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      category_id: p.category_id || '',
      purchase_price: String(p.purchase_price),
      selling_price: String(p.selling_price),
      unit: p.unit || 'pcs',
    });
    setShowForm(true);
    setMessage('');
    setError('');
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    const payload = {
      company_id: companyId,
      product_name: productForm.product_name.trim(),
      sku: productForm.sku.trim() || null,
      barcode: productForm.barcode.trim() || null,
      category_id: productForm.category_id || null,
      purchase_price: Number(productForm.purchase_price),
      selling_price: Number(productForm.selling_price),
      unit: productForm.unit.trim() || 'pcs',
    };

    if (
      !payload.product_name ||
      payload.purchase_price < 0 ||
      payload.selling_price < 0 ||
      !Number.isFinite(payload.purchase_price) ||
      !Number.isFinite(payload.selling_price)
    ) {
      setError(
        tr(
          'Enter a product name and valid prices.',
          'कृपया सामानको नाम र सही मूल्य प्रविष्ट गर्नुहोस्।'
        )
      );
      setBusy(false);
      return;
    }

    const result = editingId
      ? await supabase
          .from('products')
          .update(payload)
          .eq('id', editingId)
          .eq('company_id', companyId)
      : await supabase.from('products').insert(payload);

    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(
      editingId
        ? tr('Product updated.', 'सामान अपडेट भयो।')
        : tr('Product added.', 'सामान थपियो।')
    );

    setShowForm(false);
    setEditingId(null);
    setProductForm(emptyProduct);
    await loadData();
  }

  async function toggleProduct(p: Product) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !p.is_active })
      .eq('id', p.id)
      .eq('company_id', companyId);

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        p.is_active
          ? tr('Product archived.', 'सामान अभिलेखमा राखियो।')
          : tr('Product activated.', 'सामान सक्रिय गरियो।')
      );
      await loadData();
    }
  }

  async function saveCategory(e: FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setBusy(true);
    setError('');
    setMessage('');

    const { error } = await supabase.from('product_categories').insert({
      company_id: companyId,
      name: categoryName.trim(),
      description: categoryDescription.trim() || null,
    });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setCategoryName('');
    setCategoryDescription('');
    setMessage(
      tr(
        'Category added successfully.',
        'श्रेणी सफलतापूर्वक थपियो।'
      )
    );
    await loadData();
  }

  async function editCategory(c: Category) {
    const name = window.prompt(
      tr('Category name:', 'श्रेणीको नाम:'),
      c.name
    );

    if (name === null || !name.trim()) return;

    const description = window.prompt(
      tr('Category description:', 'श्रेणीको विवरण:'),
      c.description || ''
    );

    if (description === null) return;

    const { error } = await supabase
      .from('product_categories')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.id)
      .eq('company_id', companyId);

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        tr('Category updated.', 'श्रेणी अपडेट भयो।')
      );
      await loadData();
    }
  }

  async function toggleCategory(c: Category) {
    const { error } = await supabase
      .from('product_categories')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
      .eq('company_id', companyId);

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        c.is_active
          ? tr('Category archived.', 'श्रेणी अभिलेखमा राखियो।')
          : tr('Category activated.', 'श्रेणी सक्रिय गरियो।')
      );
      await loadData();
    }
  }

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.product_name.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  });

  const money = (value: number) =>
    `${currency} ${Number(value).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })}`;

  const field = {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #dce2ea',
    borderRadius: 8,
    boxSizing: 'border-box' as const,
    background: 'white',
    color: '#182235',
  };

  const button = {
    padding: '10px 16px',
    border: 0,
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  };

  const unitLabels: Record<string, string> = {
    pcs: tr('Pieces', 'थान'),
    pair: tr('Pair', 'जोडी'),
    set: tr('Set', 'सेट'),
    box: tr('Box', 'बाकस'),
    bottle: tr('Bottle', 'बोतल'),
    pack: tr('Pack', 'प्याकेट'),
    kg: tr('Kilogram', 'किलोग्राम'),
    gram: tr('Gram', 'ग्राम'),
    dozen: tr('Dozen', 'दर्जन'),
  };

  return (
    <div style={{ color: '#182235' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 22,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            {tr('Product Management', 'सामान व्यवस्थापन')}
          </h2>
          <p style={{ color: '#7b8798', fontSize: 13 }}>
            {tr(
              'Manage your products and categories',
              'आफ्ना सामान र श्रेणीहरू व्यवस्थापन गर्नुहोस्'
            )}
          </p>
        </div>

        <button
          style={{ ...button, background: '#182235', color: 'white' }}
          onClick={() => {
            if (tab === 'Products') {
              startNewProduct();
            } else {
              setCategoryName('');
              setCategoryDescription('');
              document.getElementById('category-name')?.focus();
            }
          }}
        >
          +{' '}
          {tab === 'Products'
            ? tr('Add Product', 'सामान थप्नुहोस्')
            : tr('New Category', 'नयाँ श्रेणी')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['Products', 'Categories'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setShowForm(false);
              setError('');
              setMessage('');
            }}
            style={{
              ...button,
              background: tab === t ? '#d4a64a' : 'white',
              color: '#182235',
              border: '1px solid #e1e5eb',
            }}
          >
            {t === 'Products'
              ? tr('Products', 'सामानहरू')
              : tr('Categories', 'श्रेणीहरू')}{' '}
            ({t === 'Products' ? products.length : categories.length})
          </button>
        ))}
      </div>

      {message && (
        <p
          style={{
            background: '#eaf7ee',
            color: '#267342',
            padding: 12,
            borderRadius: 8,
          }}
        >
          {message}
        </p>
      )}

      {error && (
        <p
          style={{
            background: '#fff0f0',
            color: '#c62828',
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}

      {tab === 'Products' && (
        <>
          {showForm && (
            <form
              onSubmit={saveProduct}
              style={{
                background: 'white',
                padding: 22,
                borderRadius: 12,
                marginBottom: 20,
                border: '1px solid #e5e9f0',
              }}
            >
              <h3>
                {editingId
                  ? tr('Edit Product', 'सामान सम्पादन गर्नुहोस्')
                  : tr('Add New Product', 'नयाँ सामान थप्नुहोस्')}
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                  gap: 14,
                }}
              >
                <label>
                  {tr('Product Name', 'सामानको नाम')} *
                  <input
                    required
                    style={field}
                    value={productForm.product_name}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        product_name: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  SKU
                  <input
                    style={field}
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        sku: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  {tr('Barcode', 'बारकोड')}
                  <input
                    style={field}
                    value={productForm.barcode}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        barcode: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  {tr('Category', 'श्रेणी')}
                  <select
                    style={field}
                    value={productForm.category_id}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        category_id: e.target.value,
                      })
                    }
                  >
                    <option value="">
                      {tr('Uncategorized', 'श्रेणी चयन गरिएको छैन')}
                    </option>
                    {categories
                      .filter((c) => c.is_active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  {tr('Purchase Price', 'खरिद मूल्य')} *
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    style={field}
                    value={productForm.purchase_price}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        purchase_price: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  {tr('Selling Price', 'बिक्री मूल्य')} *
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    style={field}
                    value={productForm.selling_price}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        selling_price: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  {tr('Unit', 'एकाइ')}
                  <select
                    style={field}
                    value={productForm.unit}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        unit: e.target.value,
                      })
                    }
                  >
                    {[
                      'pcs',
                      'pair',
                      'set',
                      'box',
                      'bottle',
                      'pack',
                      'kg',
                      'gram',
                      'dozen',
                    ].map((u) => (
                      <option key={u} value={u}>
                        {unitLabels[u]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  disabled={busy}
                  style={{ ...button, background: '#d4a64a' }}
                >
                  {busy
                    ? tr('Saving...', 'सेभ हुँदैछ...')
                    : tr('Save Product', 'सामान सेभ गर्नुहोस्')}
                </button>

                <button
                  type="button"
                  style={{ ...button, background: '#edf0f4' }}
                  onClick={() => setShowForm(false)}
                >
                  {tr('Cancel', 'रद्द गर्नुहोस्')}
                </button>
              </div>
            </form>
          )}

          <input
            placeholder={tr(
              'Search by product name, SKU or barcode...',
              'सामानको नाम, SKU वा बारकोडबाट खोज्नुहोस्...'
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...field, marginBottom: 16 }}
          />

          <div
            style={{
              background: 'white',
              borderRadius: 12,
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 750,
              }}
            >
              <thead>
                <tr style={{ background: '#f5f6f9', textAlign: 'left' }}>
                  {[
                    tr('Product', 'सामान'),
                    tr('SKU / Barcode', 'SKU / बारकोड'),
                    tr('Purchase', 'खरिद'),
                    tr('Selling', 'बिक्री'),
                    tr('Status', 'अवस्था'),
                    tr('Actions', 'कार्यहरू'),
                  ].map((h) => (
                    <th key={h} style={{ padding: 14, fontSize: 12 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderTop: '1px solid #edf0f4' }}
                  >
                    <td style={{ padding: 14 }}>
                      <strong>{p.product_name}</strong>
                      <div style={{ color: '#8a94a4', fontSize: 12 }}>
                        {categories.find((c) => c.id === p.category_id)
                          ?.name || tr('Uncategorized', 'श्रेणी छैन')}
                      </div>
                    </td>

                    <td style={{ padding: 14, fontSize: 12 }}>
                      {p.sku || '—'}
                      <br />
                      {p.barcode || ''}
                    </td>

                    <td style={{ padding: 14 }}>
                      {money(Number(p.purchase_price))}
                    </td>

                    <td style={{ padding: 14 }}>
                      {money(Number(p.selling_price))}
                    </td>

                    <td style={{ padding: 14 }}>
                      <span
                        style={{
                          color: p.is_active ? '#267342' : '#a15b28',
                        }}
                      >
                        {p.is_active
                          ? tr('Active', 'सक्रिय')
                          : tr('Archived', 'अभिलेखमा')}
                      </span>
                    </td>

                    <td style={{ padding: 14, whiteSpace: 'nowrap' }}>
                      <button
                        style={{
                          ...button,
                          background: '#edf1f7',
                          marginRight: 6,
                        }}
                        onClick={() => editProduct(p)}
                      >
                        {tr('Edit', 'सम्पादन')}
                      </button>

                      <button
                        style={{
                          ...button,
                          background: '#fff1e8',
                          color: '#9a4d20',
                        }}
                        onClick={() => toggleProduct(p)}
                      >
                        {p.is_active
                          ? tr('Archive', 'अभिलेखमा राख्नुहोस्')
                          : tr('Restore', 'पुनः सक्रिय गर्नुहोस्')}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 35,
                        textAlign: 'center',
                        color: '#8792a2',
                      }}
                    >
                      {tr(
                        'No products found. Add your first product.',
                        'कुनै सामान भेटिएन। आफ्नो पहिलो सामान थप्नुहोस्।'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'Categories' && (
        <>
          <form
            onSubmit={saveCategory}
            style={{
              background: 'white',
              padding: 20,
              borderRadius: 12,
              marginBottom: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
              gap: 12,
            }}
          >
            <input
              id="category-name"
              required
              placeholder={tr('Category name', 'श्रेणीको नाम')}
              style={field}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />

            <input
              placeholder={tr(
                'Description (optional)',
                'विवरण (वैकल्पिक)'
              )}
              style={field}
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
            />

            <button
              disabled={busy}
              style={{ ...button, background: '#d4a64a' }}
            >
              {busy
                ? tr('Saving...', 'सेभ हुँदैछ...')
                : tr('Add Category', 'श्रेणी थप्नुहोस्')}
            </button>
          </form>

          <div
            style={{
              background: 'white',
              borderRadius: 12,
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 500,
              }}
            >
              <thead>
                <tr style={{ background: '#f5f6f9', textAlign: 'left' }}>
                  {[
                    tr('Category', 'श्रेणी'),
                    tr('Description', 'विवरण'),
                    tr('Status', 'अवस्था'),
                    tr('Actions', 'कार्यहरू'),
                  ].map((h) => (
                    <th key={h} style={{ padding: 14, fontSize: 12 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {categories.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderTop: '1px solid #edf0f4' }}
                  >
                    <td style={{ padding: 14 }}>
                      <strong>{c.name}</strong>
                    </td>

                    <td style={{ padding: 14 }}>
                      {c.description || '—'}
                    </td>

                    <td style={{ padding: 14 }}>
                      {c.is_active
                        ? tr('Active', 'सक्रिय')
                        : tr('Archived', 'अभिलेखमा')}
                    </td>

                    <td style={{ padding: 14, whiteSpace: 'nowrap' }}>
                      <button
                        style={{
                          ...button,
                          background: '#edf1f7',
                          marginRight: 6,
                        }}
                        onClick={() => editCategory(c)}
                      >
                        {tr('Edit', 'सम्पादन')}
                      </button>

                      <button
                        style={{
                          ...button,
                          background: '#fff1e8',
                          color: '#9a4d20',
                        }}
                        onClick={() => toggleCategory(c)}
                      >
                        {c.is_active
                          ? tr('Archive', 'अभिलेखमा राख्नुहोस्')
                          : tr('Restore', 'पुनः सक्रिय गर्नुहोस्')}
                      </button>
                    </td>
                  </tr>
                ))}

                {categories.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: 35,
                        textAlign: 'center',
                        color: '#8792a2',
                      }}
                    >
                      {tr(
                        'No categories yet. Add your first category.',
                        'अहिलेसम्म कुनै श्रेणी छैन। आफ्नो पहिलो श्रेणी थप्नुहोस्।'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
