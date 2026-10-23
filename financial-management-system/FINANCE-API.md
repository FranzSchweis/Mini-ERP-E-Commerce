# Financial Management API

The Financial Management System owns invoices and payments. Other systems may reference it using `order_reference`, `invoice_number`, and `payment_reference`.

## Create an invoice

```http
POST /api/financial/invoices/
Content-Type: application/json
```

```json
{
  "invoice_number": "INV-2026-001",
  "customer_name": "Maria Santos",
  "customer_email": "maria@example.com",
  "order_reference": "ORD-10024",
  "issue_date": "2026-10-23",
  "due_date": "2026-11-22",
  "amount": "1500.00",
  "status": "sent"
}
```

## Record a payment

```http
POST /api/financial/invoices/1/record_payment/
Content-Type: application/json
```

```json
{
  "payment_reference": "PAY-2026-001",
  "amount": "1500.00",
  "payment_date": "2026-10-23",
  "method": "bank_transfer",
  "status": "completed"
}
```

Completed payments update the invoice balance and status. The finance system does not directly modify Sales, Inventory, or Delivery records.
