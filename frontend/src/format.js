export const STATUS_LABEL = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

export const MOVEMENT_LABEL = {
  receipt: "Receipt",
  adjustment: "Adjustment",
  allocation: "Allocation",
  release: "Release",
  shipment: "Shipment",
};

// "low_stock" -> "status-low-stock" (class names used by the design's CSS)
export const statusClass = (value) => `status-${String(value).replace(/_/g, "-")}`;

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}
