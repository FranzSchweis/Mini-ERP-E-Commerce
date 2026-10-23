import { useEffect, useState } from "react";
import { api } from "../api";

const MODES = [
  { id: "add", label: "Receive stock" },
  { id: "remove", label: "Remove stock" },
  { id: "set", label: "Set exact count" },
];

/**
 * item: the product to adjust. If null, the user picks one from `items`.
 */
export default function AdjustModal({ item, items, onClose, onSaved }) {
  const [selectedId, setSelectedId] = useState(item?.id ?? items[0]?.id ?? "");
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = item || items.find((i) => i.id === Number(selectedId));
  const n = Number(amount);
  const valid = amount !== "" && Number.isInteger(n) && n >= (mode === "set" ? 0 : 1);

  let result = null;
  if (current && valid) {
    result = mode === "add" ? current.on_hand + n : mode === "remove" ? current.on_hand - n : n;
  }
  const belowReserved = current && result !== null && result < current.reserved;
  const unchanged = current && result !== null && result === current.on_hand;
  const canSubmit = Boolean(current) && valid && !belowReserved && !unchanged && !saving;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");

    const body = { reason };
    if (mode === "set") body.set_quantity = n;
    else body.change = mode === "add" ? n : -n;

    try {
      await api.adjust(current.id, body);
      onSaved(`Stock updated for ${current.product_name}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="modal" role="dialog" aria-modal="true" aria-label="Adjust stock" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>Adjust stock</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="form-grid">
          <div className="wide">
            <label>
              Product
              {item ? (
                <input value={item.product_name} disabled />
              ) : (
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.product_name} {i.sku ? `(${i.sku})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          {current && (
            <div className="wide">
              <p className="quiet">
                On hand <strong>{current.on_hand}</strong> · Reserved{" "}
                <strong>{current.reserved}</strong> · Available <strong>{current.available}</strong>
              </p>
            </div>
          )}

          <div className="wide">
            <label>
              Adjustment type
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>
              {mode === "set" ? "New on-hand count" : "Quantity"}
              <input
                type="number"
                min={mode === "set" ? 0 : 1}
                step="1"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label>
              Reason (optional)
              <input
                value={reason}
                maxLength={255}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. supplier delivery, recount"
              />
            </label>
          </div>
        </div>

        {result !== null && (
          <p className={belowReserved ? "form-error" : "modal-note"}>
            {belowReserved
              ? `On hand can't go below the ${current.reserved} units already reserved.`
              : unchanged
                ? "This matches the current on-hand count."
                : `New on-hand count will be ${result} (available ${result - current.reserved}).`}
          </p>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={!canSubmit}>
            {saving ? "Saving…" : "Apply adjustment"}
          </button>
        </div>
      </form>
    </div>
  );
}
