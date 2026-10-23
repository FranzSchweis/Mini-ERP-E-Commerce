import { useEffect, useState } from "react";
import { api } from "../api";
import {
  MOVEMENT_LABEL,
  STATUS_LABEL,
  formatDate,
  signed,
  statusClass,
} from "../format";

export default function InventoryDetail({
  item,
  reloadKey,
  onBack,
  onAdjust,
  onEdit,
  onDelete,
}) {
  const [movements, setMovements] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .movements(item.id)
      .then((rows) => !cancelled && setMovements(rows))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [item.id, reloadKey]);

  return (
    <div className="page inventory-module">
      <button type="button" className="back-button" onClick={onBack}>
        ← Back to inventory
      </button>

      <div className="detail-title">
        <div>
          <p className="eyebrow">{item.category || "Uncategorised"}</p>
          <div className="title-line">
            <h1>{item.product_name}</h1>
            <span className={`status ${statusClass(item.status)}`}>{STATUS_LABEL[item.status]}</span>
          </div>
          <p className="lede">{item.sku ? `SKU ${item.sku}` : `Product #${item.product_id}`}</p>
        </div>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={() => onEdit(item)}>
            Edit
          </button>
          <button type="button" className="secondary-button danger" onClick={() => onDelete(item)}>
            Delete
          </button>
          <button type="button" className="primary-button" onClick={() => onAdjust(item)}>
            <span>+</span> Adjust stock
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="paper-card">
          <p className="section-label">Stock position</p>
          <p className="description">
            {item.description || "No description has been added for this product."}
          </p>
          <div className="spec-grid">
            <div>
              <span>On hand</span>
              <strong>{item.on_hand}</strong>
            </div>
            <div>
              <span>Reserved</span>
              <strong>{item.reserved}</strong>
            </div>
            <div>
              <span>Available</span>
              <strong>{item.available}</strong>
            </div>
            <div>
              <span>Reorder at</span>
              <strong>{item.reorder_level}</strong>
            </div>
          </div>
        </div>

        <aside className="paper-card side-summary">
          <p className="section-label">Record</p>
          <dl>
            <div>
              <dt>Product ID</dt>
              <dd>{item.product_id}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{item.location || "—"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(item.created_at)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(item.updated_at)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <section className="ledger detail-ledger">
        <div className="ledger-title">
          <div>
            <p className="section-label">Stock history</p>
            <h2>Movements</h2>
          </div>
          <span>{movements ? `${movements.length} entries` : ""}</span>
        </div>

        {error && <p className="form-error">{error}</p>}

        {!movements && !error && (
          <div className="empty-state">
            <p>Loading history…</p>
          </div>
        )}

        {movements && movements.length === 0 && (
          <div className="empty-state">
            <span className="empty-mark">∅</span>
            <h3>No movements yet</h3>
            <p>Stock changes will appear here.</p>
          </div>
        )}

        {movements && movements.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="number">On hand</th>
                  <th className="number">Reserved</th>
                  <th className="number">Balance</th>
                  <th>Reason</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.created_at)}</td>
                    <td>
                      <span className={`status ${statusClass(m.movement_type)}`}>
                        {MOVEMENT_LABEL[m.movement_type] || m.movement_type}
                      </span>
                    </td>
                    <td
                      className={`number tabular ${
                        m.change_on_hand > 0 ? "positive" : m.change_on_hand < 0 ? "negative" : ""
                      }`}
                    >
                      {m.change_on_hand ? signed(m.change_on_hand) : "—"}
                    </td>
                    <td className="number tabular">
                      {m.change_reserved ? signed(m.change_reserved) : "—"}
                    </td>
                    <td className="number tabular">
                      {m.on_hand_after} / {m.reserved_after}
                    </td>
                    <td>{m.reason || "—"}</td>
                    <td>{m.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="modal-note" style={{ padding: "0 20px 16px" }}>
          Balance shows on hand / reserved after each movement.
        </p>
      </section>
    </div>
  );
}
