# System 1 handoff: Product & Catalogue API

Share this note with the teammates responsible for Systems 2–5 before they build their integrations.

## System boundary

System 1 is the source of truth for the product's identity and catalogue information. It does not calculate or own stock, orders, purchasing, invoices, payments, or shipments.

## Product data

| Field | Meaning | Owner |
|---|---|---|
| `id` | Database-generated product identifier; use as an internal foreign-key/reference | System 1 |
| `sku` | Unique human-readable product code, e.g. `PRD-001` | System 1 |
| `name` | Product name | System 1 |
| `description` | Optional catalogue description | System 1 |
| `category` | Category ID | System 1 |
| `category_name` | Read-only category label returned by the API | System 1 |
| `unit_price` | Current catalogue selling price as a decimal string (e.g. `"19.90"`) | System 1 |
| `status` | `active`, `draft`, or `archived` | System 1 |

`created_at` and `updated_at` are returned by the API. Never use a product name as an identifier because names can change or repeat. Prefer the stable integer `id` for database relationships and retain `sku` for human-readable screens and references.

## Routes

Base URL during local development: `http://127.0.0.1:8000/api`

- `GET /products/` — paginated product list.
- `GET /products/{id}/` — one product.
- `GET /products/?search=headphones` — search SKU, name, description, or category.
- `GET /products/?status=active` — filter by lifecycle status.
- `GET /categories/` — list categories.

A successful product JSON object looks like:

```json
{
  "id": 1,
  "sku": "PRD-001",
  "name": "Wireless headphones",
  "description": "Over-ear Bluetooth headphones",
  "category": 1,
  "category_name": "Electronics",
  "unit_price": "19.90",
  "status": "active",
  "created_at": "2026-01-15T09:00:00Z",
  "updated_at": "2026-01-15T09:00:00Z"
}
```

## Integration agreements to make as a group

- **System 2 Sales & Orders:** reference `product_id` (the API's `id`) and copy `unit_price` into an order-line price snapshot when an order is created. This preserves the original sale price if the catalogue price changes later.
- **System 3 Inventory & Purchasing:** reference the same `product_id`/SKU, but own all current quantity, stock movement, reorder, and purchase-order fields. Don't add stock columns to this product API.
- **System 4 Billing & Payments:** use the order/invoice from System 2 as the billing source. Don't store invoices or payment status in System 1.
- **System 5 Delivery & Shipments:** reference the order from System 2 (and optionally product IDs in package lines). Don't store tracking data in System 1.

The current API returns paginated collections (a JSON object containing `count`, `next`, `previous`, and `results`). If a teammate proposes another API shape or ID type, agree and document that before changing code; update every module together rather than making a private incompatible variation.
