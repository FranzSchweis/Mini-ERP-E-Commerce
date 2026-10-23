import { useEffect, useState } from 'react';
import { Account, apiFetch, logout } from './lib/api';
import LoginPage from './modules/auth/LoginPage';
import DeliveryPage, { DeliveryView } from './modules/delivery/DeliveryPage';

type Theme = 'light' | 'dark';
const SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SESSION_REFRESH_INTERVAL_MS = 60 * 1000;

const navigation: { key: DeliveryView; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '◫' },
  { key: 'shipments', label: 'All shipments', icon: '▤' },
  { key: 'transit', label: 'In transit', icon: '↗' },
  { key: 'exceptions', label: 'Exceptions', icon: '!' },
  { key: 'delivered', label: 'Delivered', icon: '✓' },
];

const pageTitles: Record<DeliveryView, string> = {
  overview: 'Overview', shipments: 'All shipments', transit: 'In transit',
  exceptions: 'Delivery exceptions', delivered: 'Delivered shipments',
};

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<DeliveryView>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('del-and-ship-theme') === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('del-and-ship-theme', theme);
  }, [theme]);

  useEffect(() => {
    try { sessionStorage.removeItem('del-and-ship-token'); } catch { /* Storage may be disabled. */ }
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const response = await apiFetch('auth/me/');
        if (response.ok && active) setAccount(await response.json());
      } catch {
        if (active) setAccount(null);
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!account) return;
    let active = true;
    let ending = false;
    let lastActivity = Date.now();
    let idleTimer = 0;

    async function endSession() {
      if (!active || ending) return;
      ending = true;
      try { await logout(); } catch { /* The local session still ends if the backend is unavailable. */ }
      if (active) {
        setAccount(null);
        setMobileOpen(false);
        setView('overview');
      }
    }

    function recordActivity() {
      lastActivity = Date.now();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => { void endSession(); }, SESSION_IDLE_TIMEOUT_MS);
    }

    async function refreshActiveSession() {
      if (Date.now() - lastActivity >= SESSION_IDLE_TIMEOUT_MS) return;
      try {
        const response = await apiFetch('auth/me/');
        if (!response.ok) await endSession();
      } catch { /* A temporary network problem should not erase the local session. */ }
    }

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const;
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    recordActivity();
    const refreshTimer = window.setInterval(() => { void refreshActiveSession(); }, SESSION_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearTimeout(idleTimer);
      window.clearInterval(refreshTimer);
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
    };
  }, [account]);

  async function signOut() {
    try { await logout(); } catch { /* Clear the local view even if the server is unavailable. */ } finally {
      setAccount(null);
      setMobileOpen(false);
      setView('overview');
    }
  }

  function toggleTheme() {
    setTheme((current) => current === 'light' ? 'dark' : 'light');
  }

  if (!authChecked) return <div className="boot-screen"><div className="brand-lockup"><span className="brand-mark">DS</span><span>Del <i>&amp;</i> Ship</span></div><div className="boot-loader"/><span>Preparing your workspace…</span></div>;
  if (!account) return <LoginPage onAuthenticated={setAccount} theme={theme} onToggleTheme={toggleTheme} />;

  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><span className="brand-mark">DS</span><span>Del <i>&amp;</i> Ship</span></div>
      <div className="sidebar-caption">FULFILLMENT OPERATIONS</div>
      <nav className="primary-nav" aria-label="Delivery and shipment pages">
        <span className="nav-section-label">WORKSPACE</span>
        {navigation.map((item) => <button key={item.key} className={`nav-link ${view === item.key ? 'active' : ''}`} type="button" onClick={() => { setView(item.key); setMobileOpen(false); }}>
          <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
        </button>)}
      </nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-bottom">
        <div className="account-caption">SIGNED IN AS</div>
        <div className="account-row"><div className="account-avatar">{(account.full_name || account.username).slice(0, 1).toUpperCase()}</div><div className="account-details"><strong>{account.full_name || account.username}</strong><small>{account.is_staff ? 'Administrator' : 'Operations account'}</small></div></div>
        <button className="logout-button" type="button" onClick={() => void signOut()}><span>↪</span>Log out</button>
        <div className="sidebar-version">DEL &amp; SHIP <span>LOCAL WORKSPACE</span></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-leading"><button className="mobile-menu-button" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button><div className="topbar-title"><span>DEL &amp; SHIP</span><strong>{pageTitles[view]}</strong></div></div>
        <div className="topbar-actions"><span className="api-status"><i/>Operations workspace</span><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><span className="theme-symbol">{theme === 'light' ? '◐' : '☼'}</span><span className="theme-label">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></button><div className="topbar-avatar" title={account.username}>{(account.full_name || account.username).slice(0, 1).toUpperCase()}</div></div>
      </header>
      <DeliveryPage view={view} onNavigate={setView}/>
    </main>
  </div>;
}
