
import './App.css';

import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import WholesaleManager from './WholesaleManager';
import CustomersManager from './CustomersManager';
import InventoryManager from './InventoryManager';
import ExpensesManager from './ExpensesManager';
import WholesaleQuotes from './WholesaleQuotes';
import ReportsManager from './ReportsManager';
import SuppliersPurchases from './SuppliersPurchases';
import ProductManager from './ProductManager';
import SalesManager from './SalesManager';
import WholesaleOrders from './WholesaleOrders';
import PlatformOwnerDashboard from './PlatformOwnerDashboard';
import ShopProfileSettings from './ShopProfileSettings';
import ShopStaffManager from './ShopStaffManager';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

type Workspace = {
  companyId: string;
  companyName: string;
  logoUrl: string | null;
  currency: string;
  branchId: string;
  branchName: string;
  role: string;
  permissions: string[];
};

type Counts = {
  products: number;
  categories: number;
  sales: number;
  customers: number;
};

type ThemeMode = 'light' | 'dark';
type FontChoice = 'Inter' | 'Roboto' | 'Poppins' | 'Arial';

type TranslationKey = Parameters<
  ReturnType<typeof useLanguage>['t']
>[0];


const menu = [
  { name: 'Dashboard', icon: '⌂', group: 'OVERVIEW' },
  { name: 'Products', icon: '▣', group: 'MANAGEMENT' },
  { name: 'Categories', icon: '▦', group: 'MANAGEMENT' },
  { name: 'Inventory', icon: '▤', group: 'MANAGEMENT' },
  { name: 'Sales', icon: '↗', group: 'TRANSACTIONS' },
  { name: 'Quotes', icon: '📄', group: 'TRANSACTIONS' },
  { name: 'Sales Orders', icon: '📦', group: 'TRANSACTIONS' },
  { name: 'Purchases', icon: '↙', group: 'TRANSACTIONS' },
  { name: 'Customers', icon: '♙', group: 'PEOPLE' },
  { name: 'Suppliers', icon: '♧', group: 'PEOPLE' },
  { name: 'Expenses', icon: '₹', group: 'FINANCE' },
  { name: 'Reports', icon: '▥', group: 'FINANCE' },
  { name: 'Business Management', icon: '🏢', group: 'SYSTEM' },
  { name: 'Shop Profile', icon: '🏪', group: 'SYSTEM' },
  { name: 'Staff & Permissions', icon: '♙', group: 'SYSTEM' },
  { name: 'Settings', icon: '⚙', group: 'SYSTEM' },
];


const accents = [
  { name: 'Violet', value: '#7655E8' },
  { name: 'Blue', value: '#3478F6' },
  { name: 'Pink', value: '#E84F9A' },
  { name: 'Teal', value: '#0C9B91' },
  { name: 'Orange', value: '#E58A35' },
  { name: 'Gold', value: '#B88A36' },
];

const groupTranslationKeys: Record<string, TranslationKey> = {
  OVERVIEW: 'overviewGroup',
  MANAGEMENT: 'management',
  TRANSACTIONS: 'transactions',
  PEOPLE: 'people',
  FINANCE: 'finance',
  SYSTEM: 'system',
};

function canAccessMenuItem(name: string, role: string, permissions: string[]) {
  if (role === 'owner' || name === 'Dashboard') return true;
  const required: Record<string, string[]> = {
    Products: ['products.manage'], Categories: ['products.manage'],
    Inventory: ['inventory.manage'], Sales: ['sales.create', 'sales.manage'],
    Quotes: ['sales.create', 'sales.manage'], 'Sales Orders': ['sales.create', 'sales.manage'],
    Purchases: ['purchases.manage'], Customers: ['customers.manage'],
    Suppliers: ['suppliers.manage'], Expenses: ['expenses.manage'],
    Reports: ['reports.view'], 'Business Management': ['sales.create', 'sales.manage'],
    'Shop Profile': ['settings.manage'], Settings: ['settings.manage'],
    'Staff & Permissions': [],
  };
  return (required[name] ?? []).some(permission => permissions.includes(permission));
}

export default function App() {
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const [counts, setCounts] = useState<Counts>({
    products: 0,
    categories: 0,
    sales: 0,
    customers: 0,
  });

  const [page, setPage] = useState('Dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem('drg-theme') as ThemeMode) || 'light'
  );

  const [accent, setAccent] = useState(
    () => localStorage.getItem('drg-accent') || '#7655E8'
  );

  const [font, setFont] = useState<FontChoice>(
    () => (localStorage.getItem('drg-font') as FontChoice) || 'Inter'
  );

  useEffect(() => {
    localStorage.setItem('drg-theme', theme);
    localStorage.setItem('drg-accent', accent);
    localStorage.setItem('drg-font', font);
  }, [theme, accent, font]);

  async function loadWorkspace(userId: string, selectedCompanyId?: string) {
    setError('');
    setLoadingWorkspace(true);
    setCurrentUserId(userId);

    try {
      const { data: ownerFlag, error: ownerCheckError } = await supabase.rpc('is_platform_owner');
      if (ownerCheckError) throw ownerCheckError;
      const platformOwner = ownerFlag === true;
      setIsPlatformOwner(platformOwner);

      if (platformOwner && !selectedCompanyId) {
        setWorkspace(null);
        setCounts({ products: 0, categories: 0, sales: 0, customers: 0 });
        return;
      }

      let membershipQuery = supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (selectedCompanyId) {
        membershipQuery = membershipQuery.eq('company_id', selectedCompanyId);
      }

      const { data: membership, error: memberError } = await membershipQuery
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!membership) {
        throw new Error('Your account has no active company membership.');
      }

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, company_name, currency, logo_url')
        .eq('id', membership.company_id)
        .single();

      if (companyError) throw companyError;

      const { data: branchMembership, error: branchMemberError } =
        await supabase
          .from('branch_memberships')
          .select('branch_id')
          .eq('company_id', membership.company_id)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

      if (branchMemberError) throw branchMemberError;

      let branchQuery = supabase
        .from('branches')
        .select('id, branch_name')
        .eq('company_id', membership.company_id)
        .eq('is_active', true);

      if (branchMembership?.branch_id) {
        branchQuery = branchQuery.eq('id', branchMembership.branch_id);
      } else {
        branchQuery = branchQuery.eq('is_head_office', true);
      }

      const { data: branch, error: branchError } =
        await branchQuery.maybeSingle();

      if (branchError) throw branchError;

      if (!branch) {
        throw new Error('No active branch was found for your account.');
      }

      const { data: permissionRows, error: permissionError } = await supabase
        .from('user_permissions')
        .select('permission_key')
        .eq('company_id', company.id)
        .eq('user_id', userId);

      if (permissionError) throw permissionError;

      setWorkspace({
        companyId: company.id,
        companyName: company.company_name,
        logoUrl: company.logo_url ?? null,
        currency: company.currency,
        branchId: branch.id,
        branchName: branch.branch_name,
        role: membership.role,
        permissions: (permissionRows ?? []).map((item: { permission_key: string }) => item.permission_key),
      });

      const tables = [
        'products',
        'product_categories',
        'sales',
        'customers',
      ];

      const results = await Promise.all(
        tables.map((table) =>
          supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id)
        )
      );

      const failed = results.find((result) => result.error);

      if (failed?.error) throw failed.error;

      setCounts({
        products: results[0].count ?? 0,
        categories: results[1].count ?? 0,
        sales: results[2].count ?? 0,
        customers: results[3].count ?? 0,
      });
    } catch (err) {
      setWorkspace(null);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load your workspace.'
      );
    } finally {
      setLoadingWorkspace(false);
    }
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        setError(error.message);
        setLoadingWorkspace(false);
        return;
      }

      if (data.session) {
        setUserEmail(data.session.user.email ?? '');
        setCurrentUserId(data.session.user.id);
        loadWorkspace(data.session.user.id);
      } else {
        setLoadingWorkspace(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (event === 'SIGNED_IN' && session) {
          setUserEmail(session.user.email ?? '');
          setCurrentUserId(session.user.id);
          loadWorkspace(session.user.id);
        }

        if (event === 'SIGNED_OUT' || !session) {
          setWorkspace(null);
          setIsPlatformOwner(false);
          setCurrentUserId('');
          setUserEmail('');
          setLoadingWorkspace(false);
        }
      }
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.user) {
      setUserEmail(data.user.email ?? email);
      setCurrentUserId(data.user.id);
      await loadWorkspace(data.user.id);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setWorkspace(null);
    setIsPlatformOwner(false);
    setCurrentUserId('');
    setUserEmail('');
    setPage('Dashboard');
  }

  if (loadingWorkspace && !workspace) {
    return (
      <div className="drg-loading-screen">
        <div className="drg-loading-logo">DR</div>
        <h2>D.R GLOBAL</h2>
        <p>{t('preparingWorkspace')}</p>
        <div className="drg-loader-line">
          <span />
        </div>
      </div>
    );
  }

  if (isPlatformOwner && !workspace) {
    return (
      <PlatformOwnerDashboard
        userEmail={userEmail}
        onOpenShop={(companyId) => {
          setPage('Dashboard');
          void loadWorkspace(currentUserId, companyId);
        }}
      />
    );
  }

  if (!workspace) {
    return (
      <div className="drg-login-page">
        <form onSubmit={handleLogin} className="drg-login-card">
          <div className="drg-login-logo">DR</div>

          <div className="drg-eyebrow">
            {t('businessManagementSuite')}
          </div>

          <h1>D.R GLOBAL</h1>

          <p className="drg-login-subtitle">
            {t('loginSubtitle')}
          </p>

          <label className="drg-label">
            {t('emailAddress')}
          </label>

          <input
            className="drg-input"
            type="email"
            placeholder={t('enterEmail')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="drg-label">
            {t('password')}
          </label>

          <input
            className="drg-input"
            type="password"
            placeholder={t('enterPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="drg-error">{error}</div>}

          <button className="drg-login-button" disabled={loading}>
            {loading
              ? t('signingIn')
              : `${t('signInWorkspace')} →`}
          </button>

          <p className="drg-login-footer">
            {t('secureManagement')} · D.R Global
          </p>
        </form>
      </div>
    );
  }

  const rootStyle = {
    '--drg-accent': accent,
    '--drg-font': font,
  } as CSSProperties;

  return (
    <div className={`drg-app ${theme}`} style={rootStyle}>
      <aside className="drg-sidebar">
        <div className="drg-brand">
          <div className="drg-brand-logo">{workspace.logoUrl ? <img src={workspace.logoUrl} alt={workspace.companyName} /> : 'DR'}</div>

          <div className="drg-brand-copy">
            <strong>{workspace.companyName}</strong>
            <span>{t('businessSuite')}</span>
          </div>
        </div>

        <div className="drg-sidebar-caption">
          {t('workspace')}
        </div>

        <div className="drg-workspace-chip">
          <span className="drg-workspace-dot" />

          <div>
            <strong>{workspace.companyName}</strong>
            <small>{workspace.branchName}</small>
          </div>
        </div>

        {[
          'OVERVIEW',
          'MANAGEMENT',
          'TRANSACTIONS',
          'PEOPLE',
          'FINANCE',
          'SYSTEM',
        ].map((group) => (
          <div className="drg-menu-group" key={group}>
            <div className="drg-sidebar-caption">
              {t(groupTranslationKeys[group])}
            </div>

            {menu
              .filter((item) => item.group === group && canAccessMenuItem(item.name, workspace.role, workspace.permissions))
              .map((item) => (
                <button
                  key={item.name}
                  onClick={() => setPage(item.name)}
                  className={`drg-nav-button ${
                    page === item.name ? 'active' : ''
                  }`}
                >
                  <span className="drg-nav-icon">
                    {item.icon}
                  </span>

                  <span>
                  {item.name === 'Staff & Permissions'
                      ? 'Staff & Permissions'
                      : item.name === 'Shop Profile'
                      ? 'Shop Profile'
                      : item.name === 'Business Management'
                      ? 'Business Management'
                      : item.name === 'Quotes'
                         ? 'Quotes'
                         : item.name === 'Sales Orders'
                           ? 'Sales Orders'
                           : t(item.name.toLowerCase() as TranslationKey)}
                  </span>

                  {page === item.name && (
                    <span className="drg-nav-indicator" />
                  )}
                </button>
              ))}
          </div>
        ))}

        <div className="drg-sidebar-bottom">
          {isPlatformOwner && (
            <button
              className="drg-logout-button"
              onClick={() => {
                setWorkspace(null);
                setPage('Dashboard');
                setError('');
              }}
            >
              ← <span>Platform Owner Dashboard</span>
            </button>
          )}
          <div className="drg-user-mini">
            <div className="drg-avatar">DR</div>

            <div className="drg-user-copy">
              <strong>{t('administrator')}</strong>
              <small>{userEmail}</small>
            </div>
          </div>

          <button
            className="drg-logout-button"
            onClick={handleLogout}
          >
            ↪ <span>{t('signOut')}</span>
          </button>
        </div>
      </aside>

      <main className="drg-main">
        <header className="drg-topbar">
          <div className="drg-topbar-title">
            <div className="drg-mobile-brand">{workspace.logoUrl ? <img src={workspace.logoUrl} alt={workspace.companyName} /> : "DR"}</div>

            <div>
              <div className="drg-page-kicker">
                {workspace.companyName} {t('workspace')}
              </div>

              <h2>
                {page === 'Shop Profile' || page === 'Staff & Permissions' ? page : t(page.toLowerCase() as TranslationKey)}
              </h2>
            </div>
          </div>

          <div className="drg-topbar-right">
            <span className="drg-branch-pill">
              <span className="drg-live-dot" />
              {workspace.branchName}
            </span>

            <button
              className="drg-theme-shortcut"
              onClick={() => setPage('Settings')}
              title={t('themeAppearance')}
            >
              ◐
            </button>

            <div className="drg-top-user">
              <div className="drg-avatar">
                {userEmail.slice(0, 1).toUpperCase() || 'D'}
              </div>

              <div>
                <strong>{t('administrator')}</strong>
                <small>{workspace.role}</small>
              </div>
            </div>
          </div>
        </header>

        <section className="drg-content">
          {page === 'Dashboard' ? (
            <Dashboard
              workspace={workspace}
              counts={counts}
              setPage={setPage}
              t={t}
            />
          ) : page === 'Products' || page === 'Categories' ? (
            <ProductManager
              companyId={workspace.companyId}
              currency={workspace.currency}
              initialTab={page}
            />
          ) : page === 'Inventory' ? (
            <InventoryManager
              companyId={workspace.companyId}
              branchId={workspace.branchId}
              currency={workspace.currency}
            />
          ) : page === 'Sales' ? (
            <SalesManager
              companyId={workspace.companyId}
              branchId={workspace.branchId}
              currency={workspace.currency}
            />
         ) : page === 'Quotes' ? (
              <WholesaleQuotes
                companyId={workspace.companyId}
                branchId={workspace.branchId}
                currency={workspace.currency}
              />
          ) : page === 'Sales Orders' ? (
                <WholesaleOrders
                  companyId={workspace.companyId}
                  branchId={workspace.branchId}
                  currency={workspace.currency}
                />
          ) : page === 'Customers' ? (
            <CustomersManager
              companyId={workspace.companyId}
              branchId={workspace.branchId}
              currency={workspace.currency}
            />
          ) : page === 'Expenses' ? (
            <ExpensesManager
              companyId={workspace.companyId}
              branchId={workspace.branchId}
              currency={workspace.currency}
            />
          ) : page === 'Reports' ? (
            <ReportsManager
              companyId={workspace.companyId}
              branchId={workspace.branchId}
              currency={workspace.currency}
            />
          ) : page === 'Suppliers' || page === 'Purchases' ? (
            <SuppliersPurchases
              companyId={workspace.companyId}
              branchId={workspace.branchId}
              currency={workspace.currency}
              initialTab={page}
            />
            ) : page === 'Business Management' ? (
              <WholesaleManager
                companyId={workspace.companyId}
                branchId={workspace.branchId}
                currency={workspace.currency}
              />
          ) : page === 'Staff & Permissions' ? (
            <ShopStaffManager companyId={workspace.companyId} />
          ) : page === 'Shop Profile' ? (
            <ShopProfileSettings
              companyId={workspace.companyId}
              onSaved={(updated) => setWorkspace(current => current ? { ...current, companyName: updated.company_name, logoUrl: updated.logo_url || null, currency: updated.currency } : current)}
            />
          ) : page === 'Settings' ? (
            <ThemeSettings
              theme={theme}
              setTheme={setTheme}
              accent={accent}
              setAccent={setAccent}
              font={font}
              setFont={setFont}
            />
          ) : (
            <div className="drg-panel">
              <h2>
                {page === 'Shop Profile' || page === 'Staff & Permissions' ? page : t(page.toLowerCase() as TranslationKey)}
              </h2>

              <p>
                This module will be implemented in the next development phase.
              </p>

              <button
                className="drg-primary-button"
                onClick={() => setPage('Dashboard')}
              >
                ← {t('backDashboard')}
              </button>
            </div>
          )}

          {error && <div className="drg-error">{error}</div>}
        </section>
      </main>
    </div>
  );
}

function Dashboard({
  workspace,
  counts,
  setPage,
  t,
}: {
  workspace: Workspace;
  counts: Counts;
  setPage: (page: string) => void;
  t: (key: TranslationKey) => string;
}) {
  const stats = [
    {
      label: t('totalProducts'),
      value: counts.products,
      icon: '▣',
      color: 'purple',
      note: t('productsCatalogue'),
    },
    {
      label: t('categories'),
      value: counts.categories,
      icon: '▦',
      color: 'blue',
      note: t('organizedGroups'),
    },
    {
      label: t('totalSales'),
      value: counts.sales,
      icon: '↗',
      color: 'pink',
      note: t('recordedSales'),
    },
    {
      label: t('customers'),
      value: counts.customers,
      icon: '♙',
      color: 'teal',
      note: t('registeredCustomers'),
    },
  ];

  const quickActions = [
    {
      label: t('newSale'),
      page: 'Sales',
      icon: '＋',
      color: 'purple',
    },
    {
      label: t('addProduct'),
      page: 'Products',
      icon: '▣',
      color: 'blue',
    },
    {
      label: t('manageStock'),
      page: 'Inventory',
      icon: '▤',
      color: 'orange',
    },
    {
      label: t('addExpense'),
      page: 'Expenses',
      icon: '₹',
      color: 'pink',
    },
  ];

  return (
    <div className="drg-dashboard">
      <div className="drg-welcome-banner">
        <div className="drg-welcome-copy">
          <span className="drg-welcome-tag">
            {t('yourBusinessAtGlance')}
          </span>

          <h1>{t('welcomeBack')}</h1>

          <p>
            {t('workspaceOverview').replace(
              'workspace',
              workspace.companyName
            )}
          </p>

          <button
            className="drg-welcome-button"
            onClick={() => setPage('Reports')}
          >
            {t('exploreReports')} <span>→</span>
          </button>
        </div>

        <div className="drg-welcome-art" aria-hidden="true">
          <div className="drg-art-orbit orbit-one" />
          <div className="drg-art-orbit orbit-two" />
          <div className="drg-art-center">DR</div>
          <span className="drg-art-star star-one">✦</span>
          <span className="drg-art-star star-two">✧</span>
          <span className="drg-art-star star-three">✦</span>
        </div>
      </div>

      <div className="drg-section-heading">
        <div>
          <span className="drg-section-kicker">
            {t('businessOverview')}
          </span>

          <h2>{t('workspaceSnapshot')}</h2>
        </div>

        <span className="drg-live-label">
          <span className="drg-live-dot" />
          {t('liveDatabaseCounts')}
        </span>
      </div>

      <div className="drg-stat-grid">
        {stats.map((stat) => (
          <div
            className={`drg-stat-card ${stat.color}`}
            key={stat.label}
          >
            <div className="drg-stat-top">
              <span>{stat.label}</span>
              <span className="drg-stat-icon">{stat.icon}</span>
            </div>

            <strong className="drg-stat-value">
              {stat.value.toLocaleString()}
            </strong>

            <small>{stat.note}</small>

            <div className="drg-stat-decoration" />
          </div>
        ))}
      </div>

      <div className="drg-dashboard-columns">
        <div className="drg-panel drg-quick-panel">
          <div className="drg-panel-heading">
            <div>
              <span className="drg-section-kicker">
                {t('getThingsDone')}
              </span>

              <h2>{t('quickActions')}</h2>
            </div>

            <span className="drg-heading-symbol">✦</span>
          </div>

          <div className="drg-quick-grid">
            {quickActions.map((action) => (
              <button
                key={action.page}
                className={`drg-quick-action ${action.color}`}
                onClick={() => setPage(action.page)}
              >
                <span className="drg-quick-icon">
                  {action.icon}
                </span>

                <strong>{action.label}</strong>

                <span className="drg-quick-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>

        <div className="drg-panel drg-workspace-panel">
          <div className="drg-panel-heading">
            <div>
              <span className="drg-section-kicker">
                {t('workspaceDetails')}
              </span>

              <h2>{t('businessInformation')}</h2>
            </div>

            <span className="drg-heading-symbol">⌂</span>
          </div>

          <div className="drg-info-list">
            <div>
              <span>{t('company')}</span>
              <strong>{workspace.companyName}</strong>
            </div>

            <div>
              <span>{t('branch')}</span>
              <strong>{workspace.branchName}</strong>
            </div>

            <div>
              <span>{t('yourRole')}</span>
              <strong>{workspace.role}</strong>
            </div>

            <div>
              <span>{t('currency')}</span>
              <strong>{workspace.currency}</strong>
            </div>
          </div>

          <button
            className="drg-text-button"
            onClick={() => setPage('Settings')}
          >
            {t('customizeWorkspace')} <span>→</span>
          </button>
        </div>
      </div>

      <div className="drg-dashboard-footer">
        <span>✦ D.R GLOBAL BUSINESS SUITE</span>
        <span>{t('manageSmarter')}</span>
      </div>
    </div>
  );
}

function ThemeSettings({
  theme,
  setTheme,
  accent,
  setAccent,
  font,
  setFont,
}: {
  theme: ThemeMode;
  setTheme: (value: ThemeMode) => void;
  accent: string;
  setAccent: (value: string) => void;
  font: FontChoice;
  setFont: (value: FontChoice) => void;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="drg-settings-page">
      <div className="drg-settings-intro">
        <span className="drg-section-kicker">
          {t('personalizeExperience')}
        </span>

        <h1>{t('themeAppearance')}</h1>

        <p>{t('appearanceDescription')}</p>
      </div>

      <div className="drg-panel drg-setting-card">
        <div className="drg-panel-heading">
          <div>
            <h2>{t('language')}</h2>

            <p>
              {language === 'en'
                ? 'Choose the language for your POS workspace.'
                : 'आफ्नो POS कार्यस्थलको भाषा छान्नुहोस्।'}
            </p>
          </div>
        </div>

        <label className="drg-label" htmlFor="drg-language-select">
          {t('language')}
        </label>

        <select
          id="drg-language-select"
          className="drg-input"
          value={language}
          onChange={(e) =>
            setLanguage(e.target.value as 'en' | 'ne')
          }
        >
          <option value="en">English</option>
          <option value="ne">नेपाली</option>
        </select>
      </div>

      <div className="drg-panel drg-setting-card">
        <div className="drg-panel-heading">
          <div>
            <h2>{t('displayMode')}</h2>
            <p>{t('displayModeDescription')}</p>
          </div>
        </div>

        <div className="drg-theme-options">
          <button
            className={`drg-theme-option light-option ${
              theme === 'light' ? 'selected' : ''
            }`}
            onClick={() => setTheme('light')}
          >
            <span className="drg-theme-preview light-preview">
              <i />
              <i />
              <i />
            </span>

            <strong>{t('lightTheme')}</strong>
            <small>{t('lightDescription')}</small>
          </button>

          <button
            className={`drg-theme-option dark-option ${
              theme === 'dark' ? 'selected' : ''
            }`}
            onClick={() => setTheme('dark')}
          >
            <span className="drg-theme-preview dark-preview">
              <i />
              <i />
              <i />
            </span>

            <strong>{t('darkTheme')}</strong>
            <small>{t('darkDescription')}</small>
          </button>
        </div>
      </div>

      <div className="drg-panel drg-setting-card">
        <div className="drg-panel-heading">
          <div>
            <h2>{t('accentColor')}</h2>
            <p>{t('accentDescription')}</p>
          </div>
        </div>

        <div className="drg-color-options">
          {accents.map((item) => (
            <button
              key={item.name}
              className={`drg-color-choice ${
                accent === item.value ? 'selected' : ''
              }`}
              onClick={() => setAccent(item.value)}
              title={item.name}
              aria-label={`${item.name} accent color`}
            >
              <span style={{ background: item.value }} />
              <small>{item.name}</small>

              {accent === item.value && <b>✓</b>}
            </button>
          ))}
        </div>
      </div>

      <div className="drg-panel drg-setting-card">
        <div className="drg-panel-heading">
          <div>
            <h2>{t('typography')}</h2>
            <p>{t('typographyDescription')}</p>
          </div>
        </div>

        <label className="drg-label" htmlFor="drg-font-select">
          {t('fontFamily')}
        </label>

        <select
          id="drg-font-select"
          className="drg-input drg-font-select"
          value={font}
          onChange={(e) => setFont(e.target.value as FontChoice)}
        >
          <option value="Inter">
            Inter — {t('modernClean')}
          </option>

          <option value="Roboto">
            Roboto — {t('professional')}
          </option>

          <option value="Poppins">
            Poppins — {t('roundedStylish')}
          </option>

          <option value="Arial">
            Arial — {t('classicSimple')}
          </option>
        </select>

        <div className="drg-font-sample" style={{ fontFamily: font }}>
          <strong>{t('fontSampleTitle')}</strong>
          <p>{t('fontSampleDescription')}</p>
        </div>
      </div>

      <div className="drg-settings-note">
        <strong>✓ {t('preferencesSaved')}</strong>
        <span>{t('preferencesDescription')}</span>
      </div>
    </div>
  );
}
