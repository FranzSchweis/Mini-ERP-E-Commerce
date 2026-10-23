# Finance Schema and Integration Audit

## Reference schema alignment

The standalone finance database now uses the reference table names:

```text
finance_invoice
finance_payment
finance_snapshot
```

`finance_invoice` now includes the reference financial fields:

```text
id
invoice_number
order_reference
status
issued_at
due_at
currency
subtotal
tax_amount
total_amount
notes
created_at
updated_at
```

It also retains ERP usability fields such as customer name/email, order description, issue-date and due-date compatibility fields, and the legacy `amount` alias used by the existing API clients.

`finance_payment` includes:

```text
id
invoice_id
payment_reference
method
status
amount
paid_at
notes
created_at
```

The standalone `financial_financesnapshot` table was renamed to `finance_snapshot`. It stores the immutable audit timeline for invoice and payment events.

## Current flow with the main ERP database

The main ERP database and the standalone Finance database are separate databases. They currently communicate through stable business references rather than cross-database foreign keys.

```text
Main Sales database
sales_order.order_number
        │
        │ order_reference
        ▼
Standalone Finance database
finance_invoice.order_reference
        │
        │ invoice_id
        ▼
finance_payment.invoice_id
```

Delivery also uses the Sales order number:

```text
sales_order.order_number
        └── delivery_shipment.order_reference
```

Catalogue and Inventory are referenced through the Sales order lines and Inventory product/SKU references. Finance does not directly own or mutate those records.

## Audit results from the current local databases

The following reference is connected correctly:

```text
ORD-DEMO-001
```

It exists in the main `sales_order` table and is referenced by the main billing invoice, main delivery shipment, and standalone Finance invoice.

The following standalone Finance test reference is not currently present in main Sales:

```text
ORD-AUTO-001
```

It was created locally to test automatic invoice numbering. It should be replaced with a real Sales order reference or rejected by a future integration validation endpoint.

The standalone Finance database also has its own invoice/payment records, separate from the main ERP's `billing_invoice` and `billing_payment` records. They are not automatically synchronized yet.

## Recommended production integration

The Sales system should call Finance after an order is confirmed:

```http
POST /api/financial/invoices/
```

with:

```json
{
  "invoice_number": "",
  "customer_name": "Maria Santos",
  "customer_email": "maria@example.com",
  "order_reference": "ORD-10024",
  "order_description": "2 × Wireless Headphones",
  "currency": "PHP",
  "subtotal": "2700.00",
  "tax_amount": "298.00",
  "total_amount": "2998.00",
  "issue_date": "2026-10-23",
  "due_date": "2026-11-22",
  "status": "sent"
}
```

Finance generates the invoice number, stores the order reference, and publishes invoice/payment status for other systems to consume. Sales and Delivery should use `order_reference`; Finance should use `invoice_number` and `payment_reference` for its own records.
