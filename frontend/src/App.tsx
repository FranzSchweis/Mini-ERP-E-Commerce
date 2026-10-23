import CatalogPage from './modules/catalog/CatalogPage';

export default function App() {
  return (
    <div className="app-shell standalone-app">
      <main className="main">
        <header className="topbar">
          <div className="brand" aria-label="AyanoERP">
            <span className="brand-mark">A</span>
            <span>Ayano<span className="brand-muted">ERP</span></span>
          </div>
          <div className="top-actions">
            <span className="connection"><i /> Local API</span>
          </div>
        </header>
        <CatalogPage />
      </main>
    </div>
  );
}
