import { statusClass, STATUS_LABEL } from "../format";

export default function InventoryList({
  items,
  summary,
  search,
  onSearch,
  status,
  onStatus,
  sort,
  onSort,
  searchRef,
  onOpen,
  onAdjust,
  onAdd,
  error,
  loading,
  pageTitle = "Stock levels",
  pageEyebrow = "Warehouse quantities",
  pageLede = "Monitor on-hand, reserved, and available stock.",
}) {
  return (
    <div className="page inventory-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{pageEyebrow}</p>
          <h1>{pageTitle}</h1>
          <p className="lede">{pageLede}</p>
        </div>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={onAdd}>
            <span>+</span> New product
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onAdjust}
            disabled={items.length === 0}
          >
            <span>+</span> Adjust stock
          </button>
        </div>
      </div>

      <section className="summary-strip">
        <div>
          <span>Units on hand</span>
          <strong>{summary ? summary.units_on_hand : "—"}</strong>
        </div>
        <div>
          <span>Units reserved</span>
          <strong>{summary ? summary.units_reserved : "—"}</strong>
        </div>
        <div>
          <span>Available units</span>
          <strong>{summary ? summary.units_available : "—"}</strong>
        </div>
      </section>

      <section className="ledger">
        <div className="ledger-tools">
          <label className="search">
            <span>⌕</span>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search product, SKU or category..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </label>
          <div className="tool-group">
            <select value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Filter">
              <option value="">All records</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
            <select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="lowest_available">Lowest available</option>
            </select>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <div className="empty-state">
            <p>Loading inventory…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark">∅</span>
            <h3>No inventory records</h3>
            <p>Nothing matches your search or filter.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product / SKU</th>
                  <th>Category</th>
                  <th className="number">On hand</th>
                  <th className="number">Reserved</th>
                  <th className="number">Available</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id ?? item.product_id ?? item.sku ?? `inventory-row-${index}`}
                    tabIndex={item.id ? 0 : -1}
                    onClick={() => item.id && onOpen(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && item.id) onOpen(item.id);
                    }}
                  >
                    <td>
                      <strong>{item.product_name}</strong>
                      <small>{item.sku || `Product #${item.product_id}`}</small>
                    </td>
                    <td>{item.category || "—"}</td>
                    <td className="number tabular">{item.on_hand}</td>
                    <td className="number tabular">{item.reserved}</td>
                    <td className="number tabular accent-number">{item.available}</td>
                    <td>
                      <span className={`status ${statusClass(item.status)}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="row-arrow">→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
