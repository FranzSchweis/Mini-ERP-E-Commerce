import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import Shell from "./components/Shell";
import InventoryList from "./components/InventoryList";
import InventoryDetail from "./components/InventoryDetail";
import AdjustModal from "./components/AdjustModal";
import ProductModal from "./components/ProductModal";
import { OverviewPage, ProductCatalogPage } from "./components/WorkspacePages";

export default function App() {
  const [items, setItems] = useState([]);
  const [activePage, setActivePage] = useState("overview");
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [detail, setDetail] = useState(null); // the open product (full record), or null for the list
  const [modal, setModal] = useState(null); // {type: "adjust"|"product", item?}
  const [toast, setToast] = useState("");
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const [list, sum] = await Promise.all([api.list({ search, status, sort }), api.summary()]);
      setItems(list);
      setSummary(sum);
      if (activePage === "movements") setMovements(await api.allMovements());
      // keep the open detail page in sync with fresh data
      setDetail((current) => (current ? list.find((i) => i.id === current.id) || current : current));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, status, sort, activePage]);

  // Reload when filters change (debounced so typing doesn't spam the API).
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const refresh = () => {
    setReloadKey((k) => k + 1);
    return load();
  };

  async function openDetail(id) {
    try {
      setDetail(await api.get(id));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
    }
  }

  async function afterSave(message, saved) {
    setModal(null);
    setToast(message);
    if (detail) {
      // refetch the open record so numbers are exact, even if it is filtered out of the list
      try {
        setDetail(await api.get((saved && saved.id) || detail.id));
      } catch {
        setDetail(null);
      }
    }
    refresh();
  }

  async function handleDelete(item) {
    const ok = window.confirm(
      `Delete the inventory record for "${item.product_name}"? Its stock history will be deleted too.`
    );
    if (!ok) return;
    try {
      await api.remove(item.id);
      setDetail(null);
      setToast("Product deleted");
      refresh();
    } catch (err) {
      setToast(err.message);
    }
  }

  const goHome = () => { setDetail(null); setActivePage("overview"); setStatus(""); };
  const navigate = (page) => {
    setDetail(null);
    setActivePage(page);
    if (page === "low-stock") setStatus("low_stock");
    else setStatus("");
    if (page === "movements") api.allMovements().then(setMovements).catch((err) => setError(err.message));
  };
  const focusSearch = () => {
    setDetail(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  return (
    <Shell
      crumb={detail ? detail.product_name : "Inventory & stock"}
      onHome={goHome}
      onRefresh={refresh}
      onFocusSearch={focusSearch}
      activePage={activePage}
      onNavigate={navigate}
    >
      {activePage === "overview" && !detail ? (
        <OverviewPage summary={summary} items={items} loading={loading} onNavigate={navigate} />
      ) : activePage === "products" && !detail ? (
        <ProductCatalogPage items={items} loading={loading} error={error} onOpen={openDetail} />
      ) : activePage === "movements" && !detail ? (
        <section className="page inventory-module">
          <div className="page-heading"><div><p className="eyebrow">Inventory audit trail</p><h1>Stock movements</h1><p className="lede">Review recent stock receipts, adjustments, and reservations.</p></div></div>
          <section className="ledger"><div className="table-scroll"><table><thead><tr><th>Date</th><th>Product</th><th>Movement</th><th>On-hand change</th><th>Reserved change</th><th>Reason</th></tr></thead><tbody>{movements.map((m) => <tr key={m.id}><td>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</td><td><strong>{m.product_name}</strong><small>{m.sku || `Inventory #${m.inventory_id}`}</small></td><td>{m.movement_type}</td><td>{m.change_on_hand > 0 ? `+${m.change_on_hand}` : m.change_on_hand}</td><td>{m.change_reserved > 0 ? `+${m.change_reserved}` : m.change_reserved}</td><td>{m.reason || "—"}</td></tr>)}</tbody></table>{movements.length === 0 && <div className="empty-state"><h3>No stock movements yet</h3><p>Stock changes will appear here when recorded.</p></div>}</div></section>
        </section>
      ) : detail ? (
        <InventoryDetail
          item={detail}
          reloadKey={reloadKey}
          onBack={goHome}
          onAdjust={(item) => setModal({ type: "adjust", item })}
          onEdit={(item) => setModal({ type: "product", item })}
          onDelete={handleDelete}
        />
      ) : (
        <InventoryList
          items={items}
          summary={summary}
          pageTitle={activePage === "low-stock" ? "Low stock alerts" : "Stock levels"}
          pageEyebrow={activePage === "low-stock" ? "Reorder attention" : "Warehouse quantities"}
          pageLede={activePage === "low-stock" ? "Products at or below their reorder level." : "Monitor on-hand, reserved, and available stock."}
          search={search}
          onSearch={setSearch}
          status={status}
          onStatus={setStatus}
          sort={sort}
          onSort={setSort}
          searchRef={searchRef}
          onOpen={openDetail}
          onAdjust={() => setModal({ type: "adjust", item: null })}
          onAdd={() => setModal({ type: "product", item: null })}
          error={error}
          loading={loading}
        />
      )}

      {modal?.type === "adjust" && (
        <AdjustModal
          item={modal.item}
          items={items}
          onClose={() => setModal(null)}
          onSaved={afterSave}
        />
      )}
      {modal?.type === "product" && (
        <ProductModal item={modal.item} onClose={() => setModal(null)} onSaved={afterSave} />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>✓</span> {toast}
        </div>
      )}
    </Shell>
  );
}
