# System 5 handoff: Delivery & Shipments

## Responsibility boundary

System 5 owns shipment records, shipment item snapshots, carrier/tracking information, shipment statuses, and the status-event history. It does not own sales orders, customer accounts, stock balances/reservations, or payment state.

`order_reference` is an external identifier owned by System 2 (Sales & Orders). This checkout does not yet contain an Orders API, so the current demo accepts an order reference and delivery details entered by staff. It deliberately does not create a competing local Order record. Each order reference can have one shipment in this MVP. Shipment item product references and descriptions are snapshots for fulfillment display, not the catalogue source of truth.

Before connecting to real upstream data, agree with System 2 on the order ID type, order-line identifiers, recipient/address fields, and the signal that means an order is eligible for fulfillment. Agree with Inventory and Billing on whether stock reservation and successful payment are prerequisites. Replace manual order entry with that agreed API or shared service contract rather than querying another system's private tables.

## Status flow

- `ready_to_pack` → `packing` or `cancelled`
- `packing` → `ready_to_dispatch` or `cancelled`
- `ready_to_dispatch` → `in_transit` or `cancelled`
- `in_transit` → `delivered` or `delivery_failed`
- `delivery_failed` → `in_transit` (redelivery) or `cancelled`
- `delivered` and `cancelled` are terminal

Each status change creates a `ShipmentEvent`. A note is optional for ordinary transitions, but required when marking a delivery failed. Status changes and note length are validated on the backend; the UI's available buttons are only a convenience and are not the authority.

## API

Base URL in local development: `http://127.0.0.1:8000/api/shipments/`

- `GET /api/shipments/` — paginated list; optional `?status=in_transit` and `?search=ORD-1001`.
- `POST /api/shipments/` — create one shipment with at least one item. Initial status is `ready_to_pack`.
- `GET /api/shipments/{id}/` — read shipment, items, and event history.
- `POST /api/shipments/{id}/status/` — update status using `{"status":"packing","note":"Optional note"}`. A `delivery_failed` update must include a reason in `note`.
- `PATCH /api/shipments/{id}/logistics/` — update only the `carrier` and/or `tracking_number`; generic shipment PATCH remains disabled.

Example create body:

```json
{
  "order_reference": "ORD-1001",
  "recipient_name": "Sample Recipient",
  "delivery_address": "Campus address snapshot",
  "carrier": "Campus Courier",
  "tracking_number": "TRK-1001",
  "items": [
    {"product_reference":"PRD-001","product_name":"Wireless headphones","quantity":1}
  ]
}
```

## Data entities

- `Shipment`: unique external order reference, recipient, delivery-address snapshot, carrier, tracking number, status, timestamps.
- `ShipmentItem`: shipment FK, optional product reference, description snapshot, positive quantity.
- `ShipmentEvent`: shipment FK, new status, optional note, event timestamp.

## Scope notes

This is a classroom MVP, not a production carrier integration. It supports one shipment per order and multiple item lines per shipment, has no authentication/authorization yet, and does not call a live courier. The current shared API permissions are open for local development. Secure the API and coordinate ownership/authentication before any public deployment.
