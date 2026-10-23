import { useEffect, useState } from "react";
import { api } from "../api";

/** Add a new product record (item = null) or edit the details of an existing one. */
export default function ProductModal({ item, onClose, onSaved }) {
  const editing = Boolean(item);
  const [values, setValues] = useState({
    product_id: item?.product_id ?? "",
    product_name: item?.product_name ?? "",
    sku: item?.sku ?? "",
    category: item?.category ?? "",
    location: item?.location ?? "",
    description: item?.description ?? "",
    on_hand: 0,
    reorder_level: item?.reorder_level ?? 10,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      product_id: Number(values.product_id),
      product_name: values.product_name,
      sku: values.sku,
      category: values.category,
      location: values.location,
      description: values.description,
      reorder_level: Number(values.reorder_level),
    };
    if (!editing) payload.on_hand = Number(values.on_hand);

    try {
      const saved = editing ? await api.update(item.id, payload) : await api.create(payload);
      onSaved(editing ? "Product updated" : "Product added", saved);
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
      <form className="modal" role="dialog" aria-modal="true" aria-label="Product" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>{editing ? "Edit product" : "New product"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="form-grid">
          <label>
            Product ID (from catalog)
            <input
              type="number"
              min="1"
              required
              value={values.product_id}
              onChange={set("product_id")}
            />
          </label>
          <label>
            SKU
            <input value={values.sku} maxLength={50} onChange={set("sku")} />
          </label>

          <label className="wide">
            Product name
            <input
              required
              value={values.product_name}
              maxLength={150}
              onChange={set("product_name")}
            />
          </label>

          <label>
            Category
            <input value={values.category} maxLength={80} onChange={set("category")} />
          </label>
          <label>
            Location
            <input value={values.location} maxLength={100} onChange={set("location")} />
          </label>

          {!editing && (
            <label>
              Opening on-hand stock
              <input
                type="number"
                min="0"
                required
                value={values.on_hand}
                onChange={set("on_hand")}
              />
            </label>
          )}
          <label>
            Reorder level
            <input
              type="number"
              min="0"
              required
              value={values.reorder_level}
              onChange={set("reorder_level")}
            />
          </label>

          <label className="wide">
            Description
            <textarea
              rows={3}
              value={values.description}
              maxLength={2000}
              onChange={set("description")}
            />
          </label>
        </div>

        {editing && (
          <p className="modal-note">
            To change stock quantities, use <strong>Adjust stock</strong> so the change is logged.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}
