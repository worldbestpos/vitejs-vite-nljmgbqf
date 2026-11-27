
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

type Props = {
  companyId: string;
  branchId: string;
  currency: string;
};

type Expense = {
  id: string;
  expense_number: string;
  expense_date: string;
  category_id: string | null;
  amount: number;
  payment_method: string;
  payee: string | null;
  description: string | null;
  reference_number: string | null;
};

type Category = {
  id: string;
  name: string;
  is_active: boolean;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid #d9dee7',
  borderRadius: 8,
  background: '#fff',
  color: '#172438',
  fontSize: 14,
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '11px 16px',
  background: '#172438',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

export default function ExpensesManager({
  companyId,
  branchId,
  currency,
}: Props) {
  const { language } = useLanguage();
  const ne = language === 'ne';

  const tr = (english: string, nepali: string) =>
    ne ? nepali : english;

  const money = (amount: number) =>
    `${currency} ${Number(amount || 0).toLocaleString(
      ne ? 'ne-NP' : 'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  const dateLocale = ne ? 'ne-NP' : 'en-IN';

  const paymentLabel = (method: string) => {
    const labels: Record<string, [string, string]> = {
      cash: ['Cash', 'नगद'],
      bank: ['Bank Transfer', 'बैंक ट्रान्सफर'],
      card: ['Card', 'कार्ड'],
      wallet: ['Digital Wallet', 'डिजिटल वालेट'],
      cheque: ['Cheque', 'चेक'],
      other: ['Other', 'अन्य'],
    };

    const label = labels[method];
    return label ? tr(label[0], label[1]) : method.replace('_', ' ');
  };

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const emptyForm = {
    expense_date: today(),
    category_id: '',
    amount: '',
    payment_method: 'cash',
    payee: '',
    description: '',
    reference_number: '',
  };

  const [form, setForm] = useState(emptyForm);

  async function loadData() {
    setLoading(true);
    setError('');

    const [expenseResult, categoryResult] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('company_id', companyId)
        .eq('branch_id', branchId)
        .order('expense_date', { ascending: false }),

      supabase
        .from('expense_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name'),
    ]);

    if (expenseResult.error) {
      setError(expenseResult.error.message);
    } else {
      setExpenses(expenseResult.data || []);
    }

    if (categoryResult.error) {
      setError(categoryResult.error.message);
    } else {
      setCategories(categoryResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [companyId, branchId]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const category = categories.find(
        (c) => c.id === expense.category_id
      )?.name || '';

      const searchText = [
        expense.expense_number,
        expense.payee,
        expense.description,
        expense.reference_number,
        category,
      ].join(' ').toLowerCase();

      const matchesSearch = searchText.includes(search.toLowerCase());

      const month = expense.expense_date?.slice(0, 7);
      const matchesMonth =
        filterMonth === 'all' || month === filterMonth;

      return matchesSearch && matchesMonth;
    });
  }, [expenses, categories, search, filterMonth]);

  const totalExpenses = expenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const currentMonth = today().slice(0, 7);

  const monthlyExpenses = expenses
    .filter((item) => item.expense_date?.slice(0, 7) === currentMonth)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const averageExpense = expenses.length
    ? totalExpenses / expenses.length
    : 0;

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  }

  async function saveExpense(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        tr(
          'Please enter a valid expense amount greater than zero.',
          'कृपया शून्यभन्दा बढी सही खर्च रकम प्रविष्ट गर्नुहोस्।'
        )
      );
      return;
    }

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    const expenseData = {
      company_id: companyId,
      branch_id: branchId,
      category_id: form.category_id || null,
      expense_date: new Date(`${form.expense_date}T12:00:00`).toISOString(),
      amount,
      payment_method: form.payment_method,
      payee: form.payee.trim() || null,
      description: form.description.trim() || null,
      reference_number: form.reference_number.trim() || null,
      recorded_by: userData.user?.id || null,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', editingId)
        .eq('company_id', companyId)
        .eq('branch_id', branchId);
    } else {
      const datePart = form.expense_date.replaceAll('-', '');
      const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();

      result = await supabase
        .from('expenses')
        .insert({
          ...expenseData,
          expense_number: `EXP-${datePart}-${randomPart}`,
        });
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess(
      editingId
        ? tr('Expense updated successfully.', 'खर्च सफलतापूर्वक अपडेट भयो।')
        : tr('Expense recorded successfully.', 'खर्च सफलतापूर्वक रेकर्ड भयो।')
    );

    resetForm();
    await loadData();
  }

  function editExpense(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date?.slice(0, 10) || today(),
      category_id: expense.category_id || '',
      amount: String(expense.amount),
      payment_method: expense.payment_method || 'cash',
      payee: expense.payee || '',
      description: expense.description || '',
      reference_number: expense.reference_number || '',
    });

    setSuccess('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteExpense(expense: Expense) {
    const confirmed = window.confirm(
      tr(
        `Delete expense ${expense.expense_number}? This cannot be undone.`,
        `खर्च ${expense.expense_number} मेटाउने हो? यो कार्य फिर्ता गर्न सकिँदैन।`
      )
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)
      .eq('company_id', companyId)
      .eq('branch_id', branchId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess(tr('Expense deleted successfully.', 'खर्च सफलतापूर्वक मेटाइयो।'));
    await loadData();
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();

    const name = newCategory.trim();

    if (!name) {
      setError(
        tr('Please enter a category name.', 'कृपया खर्च शीर्षकको नाम लेख्नुहोस्।')
      );
      return;
    }

    setError('');
    setSuccess('');

    const { error: categoryError } = await supabase
      .from('expense_categories')
      .insert({
        company_id: companyId,
        name,
        is_active: true,
      });

    if (categoryError) {
      setError(categoryError.message);
      return;
    }

    setNewCategory('');
    setShowCategoryForm(false);
    setSuccess(
      tr('Expense category added.', 'खर्च शीर्षक थपियो।')
    );
    await loadData();
  }

  const activeCategories = categories.filter((c) => c.is_active);

  return (
    <div style={{ color: '#172438', display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 25 }}>
          {tr('Expenses Management', 'खर्च व्यवस्थापन')}
        </h2>
        <p style={{ color: '#718096', marginTop: 6 }}>
          {tr(
            'Record and manage your business expenses.',
            'तपाईंको व्यवसायका खर्चहरू रेकर्ड तथा व्यवस्थापन गर्नुहोस्।'
          )}
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fff0f0',
          color: '#b42318',
          padding: 12,
          borderRadius: 8,
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: '#eaf8ef',
          color: '#187443',
          padding: 12,
          borderRadius: 8,
        }}>
          {success}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
      }}>
        {[
          {
            label: tr('Total Expenses', 'कुल खर्च'),
            value: money(totalExpenses),
          },
          {
            label: tr('This Month', 'यो महिना'),
            value: money(monthlyExpenses),
          },
          {
            label: tr('Total Records', 'कुल रेकर्ड'),
            value: expenses.length.toLocaleString(dateLocale),
          },
          {
            label: tr('Average Expense', 'औसत खर्च'),
            value: money(averageExpense),
          },
        ].map((item) => (
          <div key={item.label} style={{
            background: '#fff',
            border: '1px solid #e6e9ef',
            borderRadius: 12,
            padding: 18,
          }}>
            <div style={{ color: '#718096', fontSize: 13 }}>
              {item.label}
            </div>
            <div style={{
              fontSize: 21,
              fontWeight: 700,
              marginTop: 9,
              overflowWrap: 'anywhere',
            }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid #e6e9ef',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}>
          <h3 style={{ margin: 0 }}>
            {editingId
              ? tr('Edit Expense', 'खर्च सम्पादन गर्नुहोस्')
              : tr('Record New Expense', 'नयाँ खर्च रेकर्ड गर्नुहोस्')}
          </h3>

          {editingId && (
            <button type="button" style={buttonStyle} onClick={resetForm}>
              {tr('Cancel Editing', 'सम्पादन रद्द गर्नुहोस्')}
            </button>
          )}
        </div>

        <form onSubmit={saveExpense}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 15,
          }}>
            <label>
              <span style={labelText}>
                {tr('Expense Date *', 'खर्च मिति *')}
              </span>
              <input
                style={inputStyle}
                type="date"
                required
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </label>

            <label>
              <span style={labelText}>{tr('Category', 'शीर्षक')}</span>
              <select
                style={inputStyle}
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">{tr('Select category', 'शीर्षक छान्नुहोस्')}</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span style={labelText}>
                {tr('Amount', 'रकम')} ({currency}) *
              </span>
              <input
                style={inputStyle}
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder={tr('Enter amount', 'रकम लेख्नुहोस्')}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>

            <label>
              <span style={labelText}>
                {tr('Payment Method *', 'भुक्तानी विधि *')}
              </span>
              <select
                style={inputStyle}
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                <option value="cash">{tr('Cash', 'नगद')}</option>
                <option value="bank">{tr('Bank Transfer', 'बैंक ट्रान्सफर')}</option>
                <option value="card">{tr('Card', 'कार्ड')}</option>
                <option value="wallet">{tr('Digital Wallet', 'डिजिटल वालेट')}</option>
                <option value="cheque">{tr('Cheque', 'चेक')}</option>
                <option value="other">{tr('Other', 'अन्य')}</option>
              </select>
            </label>

            <label>
              <span style={labelText}>
                {tr('Paid To / Payee', 'भुक्तानी प्राप्त गर्ने व्यक्ति / संस्था')}
              </span>
              <input
                style={inputStyle}
                value={form.payee}
                placeholder={tr('Person or business name', 'व्यक्ति वा व्यवसायको नाम')}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
              />
            </label>

            <label>
              <span style={labelText}>
                {tr('Reference Number', 'सन्दर्भ नम्बर')}
              </span>
              <input
                style={inputStyle}
                value={form.reference_number}
                placeholder={tr('Receipt or transaction number', 'रसिद वा कारोबार नम्बर')}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
              />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              <span style={labelText}>
                {tr('Description / Notes', 'विवरण / टिप्पणी')}
              </span>
              <textarea
                style={{ ...inputStyle, minHeight: 85, resize: 'vertical' }}
                value={form.description}
                placeholder={tr('Write expense details...', 'खर्चको विवरण लेख्नुहोस्...')}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
          </div>

          <div style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 18,
          }}>
            <button type="submit" disabled={saving} style={{
              ...buttonStyle,
              background: '#b18b45',
              opacity: saving ? 0.6 : 1,
            }}>
              {saving
                ? tr('Saving...', 'सेभ हुँदैछ...')
                : editingId
                  ? tr('Update Expense', 'खर्च अपडेट गर्नुहोस्')
                  : tr('Save Expense', 'खर्च सेभ गर्नुहोस्')}
            </button>

            <button
              type="button"
              style={{
                ...buttonStyle,
                background: '#edf0f5',
                color: '#172438',
              }}
              onClick={() => setShowCategoryForm(!showCategoryForm)}
            >
              {showCategoryForm
                ? tr('Close Categories', 'शीर्षक बन्द गर्नुहोस्')
                : tr('+ Add Category', '+ शीर्षक थप्नुहोस्')}
            </button>
          </div>
        </form>

        {showCategoryForm && (
          <form
            onSubmit={addCategory}
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 10,
              background: '#f5f6f8',
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <input
              style={{ ...inputStyle, flex: '1 1 220px' }}
              placeholder={tr(
                'New category name (e.g. Rent, Salary, Electricity)',
                'नयाँ शीर्षकको नाम (जस्तै: भाडा, तलब, बिजुली)'
              )}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button type="submit" style={buttonStyle}>
              {tr('Save Category', 'शीर्षक सेभ गर्नुहोस्')}
            </button>
          </form>
        )}

        {categories.length > 0 && (
          <div style={{ marginTop: 16, color: '#718096', fontSize: 13 }}>
            {tr('Categories:', 'खर्च शीर्षकहरू:')} {categories.map((c) => c.name).join(' • ')}
          </div>
        )}
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid #e6e9ef',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}>
          <h3 style={{ margin: 0 }}>
            {tr('Expense History', 'खर्च विवरण इतिहास')}
          </h3>
          <span style={{ color: '#718096', fontSize: 13 }}>
            {filteredExpenses.length.toLocaleString(dateLocale)} {tr('records', 'रेकर्ड')}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}>
          <input
            style={inputStyle}
            placeholder={tr(
              'Search expense, payee, category...',
              'खर्च, भुक्तानी प्राप्तकर्ता वा शीर्षक खोज्नुहोस्...'
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            style={inputStyle}
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="all">{tr('All Months', 'सबै महिना')}</option>
            {[...new Set(expenses.map((e) => e.expense_date?.slice(0, 7)).filter(Boolean))]
              .sort()
              .reverse()
              .map((month) => (
                <option key={month} value={month}>
                  {new Date(`${month}-01T12:00:00`).toLocaleDateString(dateLocale, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </option>
              ))}
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#718096' }}>
            {tr('Loading expenses...', 'खर्च विवरण लोड हुँदैछ...')}
          </p>
        ) : filteredExpenses.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 35,
            color: '#718096',
          }}>
            {tr(
              'No expenses found. Record your first expense above.',
              'कुनै खर्च भेटिएन। माथिबाट आफ्नो पहिलो खर्च रेकर्ड गर्नुहोस्।'
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 760,
              fontSize: 13,
            }}>
              <thead>
                <tr style={{ background: '#f5f6f8', textAlign: 'left' }}>
                  {[
                    tr('Expense No.', 'खर्च नम्बर'),
                    tr('Date', 'मिति'),
                    tr('Category', 'शीर्षक'),
                    tr('Payee', 'भुक्तानी प्राप्तकर्ता'),
                    tr('Payment', 'भुक्तानी'),
                    tr('Amount', 'रकम'),
                    tr('Actions', 'कार्यहरू'),
                  ].map((heading) => (
                    <th key={heading} style={thStyle}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => {
                  const category = categories.find(
                    (c) => c.id === expense.category_id
                  );

                  return (
                    <tr key={expense.id}>
                      <td style={tdStyle}>
                        <strong>{expense.expense_number}</strong>
                      </td>
                      <td style={tdStyle}>
                        {new Date(expense.expense_date).toLocaleDateString(dateLocale)}
                      </td>
                      <td style={tdStyle}>
                        {category?.name || tr('Uncategorized', 'शीर्षक नभएको')}
                      </td>
                      <td style={tdStyle}>{expense.payee || '—'}</td>
                      <td style={tdStyle}>
                        {paymentLabel(expense.payment_method)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        {money(expense.amount)}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 7 }}>
                          <button
                            type="button"
                            onClick={() => editExpense(expense)}
                            style={smallButton}
                          >
                            {tr('Edit', 'सम्पादन')}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteExpense(expense)}
                            style={{
                              ...smallButton,
                              color: '#b42318',
                              background: '#fff0f0',
                            }}
                          >
                            {tr('Delete', 'मेटाउनुहोस्')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredExpenses.length > 0 && (
          <div style={{
            textAlign: 'right',
            fontWeight: 700,
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid #e6e9ef',
          }}>
            {tr('Filtered Total:', 'फिल्टर गरिएको जम्मा:')} {money(
              filteredExpenses.reduce(
                (sum, item) => sum + Number(item.amount || 0),
                0
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelText: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 7,
  color: '#344054',
};

const thStyle: React.CSSProperties = {
  padding: '12px 10px',
  color: '#526078',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #e6e9ef',
};

const tdStyle: React.CSSProperties = {
  padding: '13px 10px',
  borderBottom: '1px solid #edf0f4',
  whiteSpace: 'nowrap',
  color: '#344054',
};

const smallButton: React.CSSProperties = {
  border: 'none',
  borderRadius: 6,
  padding: '7px 10px',
  background: '#edf2f7',
  color: '#172438',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};
