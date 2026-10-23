import { useState } from 'react';
import FinancialManagementPage from './modules/financial/FinancialManagementPage';

type View = 'overview' | 'invoices' | 'payments' | 'collections' | 'reports';
const features: { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'collections', label: 'Collections' },
  { key: 'reports', label: 'Reports & balances' },
];

export default function App() {
  const [view, setView] = useState<View>('overview');
  const current = features.find((feature) => feature.key === view)!;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><svg className="brand-mark" viewBox="0 0 32 32" role="img" aria-label="Philippine peso"><path d="M9 6v20M9 7h8a6 6 0 0 1 0 12H9M6 16h15M6 21h11" /></svg><span>Ayano<span className="brand-muted">FINANCE</span></span></div>
      <div className="workspace-label">FINANCIAL MANAGEMENT</div>
      <nav className="feature-nav" aria-label="Financial management pages">
        <div className="nav-group-label">PAGES</div>
        {features.map((feature) => <button key={feature.key} type="button" className={`nav-item nav-button ${view === feature.key ? 'selected' : ''}`} aria-current={view === feature.key ? 'page' : undefined} onClick={() => setView(feature.key)}>{feature.label}</button>)}
      </nav>
      <div className="sidebar-foot"><div className="avatar">F</div><div><strong>Finance System</strong><small>{current.label}</small></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Financial Management <span>/</span> {current.label}</div><div className="top-actions"><span className="connection"><i/> Local API</span></div></header>
      <FinancialManagementPage view={view} onNavigate={setView} />
    </main>
  </div>;
}
