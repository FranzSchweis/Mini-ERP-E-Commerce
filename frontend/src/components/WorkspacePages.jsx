function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OverviewPage({ summary, items, loading, onNavigate }) {
  const lowStock = items.filter((item) => item.status === "low_stock" || item.status === "out_of_stock").slice(0, 5);
  return (
    <section className="page inventory-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Inventory &amp; stock control</p>
          <h1>Inventory overview</h1>
          <p className="lede">A quick view of warehouse stock health and alerts.</p>
        </div>
      </div>
      <section className="summary-strip">
        <div><span>Products tracked</span><strong>{summary ? summary.total_items : "—"}</strong></div>
        <div><span>Units on hand</span><strong>{summary ? summary.units_on_hand : "—"}</strong></div>
        <div><span>Available units</span><strong>{summary ? summary.units_available : "—"}</strong></div>
        <div><span>Low-stock items</span><strong>{summary ? summary.low_stock : "—"}</strong></div>
      </section>
      <section className="ledger">
        <div className="ledger-tools"><div><p className="eyebrow">Needs attention</p><h2>Stock alerts</h2></div><button type="button" className="secondary-button" onClick={() => onNavigate("low-stock")}>View all alerts</button></div>
        {loading ? <div className="empty-state"><p>Loading overview…</p></div> : lowStock.length === 0 ? <div className="empty-state"><h3>Everything looks healthy</h3><p>No products are currently at or below their reorder level.</p></div> : <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th className="number">Available</th><th className="number">Reorder level</th><th>Status</th></tr></thead><tbody>{lowStock.map((item) => <tr key={item.id} onClick={() => onNavigate("low-stock")}><td><strong>{item.product_name}</strong></td><td>{item.sku}</td><td className="number tabular">{item.available}</td><td className="number tabular">{item.reorder_level}</td><td><span className={`status ${item.status === "out_of_stock" ? "status-out-of-stock" : "status-low-stock"}`}>{item.status === "out_of_stock" ? "Out of stock" : "Low stock"}</span></td></tr>)}</tbody></table></div>}
      </section>
    </section>
  );
}

export function ProductCatalogPage({ items, loading, error, onOpen }) {
  return (
    <section className="page inventory-module">
      <div className="page-heading"><div><p className="eyebrow">Catalog connection</p><h1>Products</h1><p className="lede">Products come from the shared catalog_product table.</p></div></div>
      <section className="ledger">
        {error && <p className="form-error">{error}</p>}
        {loading ? <div className="empty-state"><p>Loading products…</p></div> : items.length === 0 ? <div className="empty-state"><h3>No catalog products found</h3><p>Add products through the Product/Catalog subsystem first.</p></div> : <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Catalog price</th><th>Catalog status</th><th>Inventory link</th></tr></thead><tbody>{items.map((item) => <tr key={item.product_id} tabIndex={0} onClick={() => item.id && onOpen(item.id)}><td><strong>{item.product_name}</strong><small>Product #{item.product_id}</small></td><td>{item.sku}</td><td>{item.category || "—"}</td><td>{formatMoney(item.unit_price)}</td><td>{item.product_status || "—"}</td><td>{item.id ? <span className="status status-in-stock">Connected</span> : <span className="status status-low-stock">No stock level</span>}</td></tr>)}</tbody></table></div>}
      </section>
    </section>
  );
}
