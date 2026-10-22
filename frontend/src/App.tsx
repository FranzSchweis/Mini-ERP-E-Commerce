import { useState } from 'react';
import CatalogPage from './modules/catalog/CatalogPage';

type ModuleKey = 'catalog' | 'sales' | 'inventory' | 'billing' | 'delivery';
type ModuleInfo = { key: ModuleKey; name: string; system: string; short: string };

const modules: ModuleInfo[] = [
  { key: 'catalog', name: 'Product & Catalogue', system: 'System 1', short: 'Catalogue owner' },
  { key: 'sales', name: 'Sales & Orders', system: 'System 2', short: 'Module placeholder' },
  { key: 'inventory', name: 'Inventory & Purchasing', system: 'System 3', short: 'Module placeholder' },
  { key: 'billing', name: 'Billing & Payments', system: 'System 4', short: 'Module placeholder' },
  { key: 'delivery', name: 'Delivery & Shipments', system: 'System 5', short: 'Module placeholder' },
];

export default function App() {
  const [selected, setSelected] = useState<ModuleKey>('catalog');
  const current = modules.find((module) => module.key === selected)!;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">67</span><span>Ayano<span className="brand-muted">TATA</span></span></div>
      <div className="workspace-label">ERP SYSTEMS</div>
      <nav aria-label="ERP modules">{modules.map((module) => <button key={module.key} className={`nav-item nav-button ${selected === module.key ? 'selected' : ''}`} onClick={() => setSelected(module.key)}>{module.name}</button>)}</nav>
      <div className="sidebar-note">Each system has its own page folder. Teammates can build their page separately and keep this shared theme.</div>
      <div className="sidebar-foot"><div className="avatar">{current.system.slice(-1)}</div><div><strong>{current.system}</strong><small>{current.name}</small></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Mini ERP <span>/</span> {current.system} <span>/</span> {current.name}</div><div className="top-actions"><span className="connection"><i/> Local API</span></div></header>
      {selected === 'catalog' ? <CatalogPage /> : <section className="content"><div className="module-placeholder"><div className="eyebrow">{current.system.toUpperCase()}</div><h1>{current.name}</h1><p>This is a shared placeholder for your teammate’s module.</p><p className="placeholder-help">Build the module in its own frontend folder and connect it here. The shared shell, navigation, and visual theme are already in place.</p><code>src/modules/{selected}/</code></div></section>}
    </main>
  </div>;
}
