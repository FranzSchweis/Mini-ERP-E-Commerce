import { useState } from "react";

// This application is the Inventory Management module of the team's Mini ERP.
// Other modules (Catalog, Sales, Billing, and Delivery) belong to separate apps.
const NAV_ITEMS = [
  { id: "overview", icon: "▦", label: "Inventory overview" },
  { id: "products", icon: "□", label: "Products" },
  { id: "levels", icon: "▤", label: "Stock levels" },
  { id: "movements", icon: "↕", label: "Stock movements" },
  { id: "low-stock", icon: "!", label: "Low stock" },
];

function NavList({ activePage, onNavigate }) {
  return (
    <div className="inventory-nav-list">
      {NAV_ITEMS.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`nav-item ${activePage === item.id ? "active" : ""}`}
          onClick={() => onNavigate(item.id)}
          aria-current={activePage === item.id ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span className="nav-text">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Shell({ crumb, onHome, onFocusSearch, activePage, onNavigate, onLogout, username, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (page) => {
    setMenuOpen(false);
    if (page === "overview") onHome();
    onNavigate(page);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => navigate("overview")}>
          <div className="brand-mark" aria-hidden="true">M</div>
          <div>
            <strong>Mini ERP</strong>
            <small>Inventory management</small>
          </div>
        </button>
        <nav aria-label="Inventory navigation">
          <p className="nav-label">Inventory workspace</p>
          <NavList activePage={activePage} onNavigate={navigate} />
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
          <div className="breadcrumbs">
            <span>Mini ERP</span>
            <b>/</b>
            <strong>{crumb}</strong>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={onFocusSearch}>
              <span>⌕</span> Search inventory
            </button>
          </div>
          <div className="operator">
            <span>{username?.slice(0, 2).toUpperCase()}</span>
            <div><strong>{username}</strong><small>Inventory</small></div>
            <button type="button" className="signout-button" onClick={onLogout}>Sign out</button>
          </div>
        </header>

        {menuOpen && (
          <div className="mobile-nav" style={{ padding: "8px 18px", background: "#fff" }}>
            <NavList activePage={activePage} onNavigate={navigate} />
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
