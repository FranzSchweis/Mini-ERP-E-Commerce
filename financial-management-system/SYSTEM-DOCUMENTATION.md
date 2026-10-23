# Finance Management System

## 1. Purpose and System Scope

### 1.1 Purpose

The Finance Management System is the finance module of the ERP. It manages the financial obligations created by customer orders and records the money received from customers.

In simple terms:

```text
Invoice = amount the customer is required to pay
Payment = amount the business has received
```

The system calculates the remaining balance, identifies invoices that need collection, and keeps a historical record of invoice and payment activity.

### 1.2 Finance system responsibilities

The Finance Management System is responsible for:

- Creating and managing customer invoices
- Generating invoice numbers automatically
- Storing customer and order references for billing
- Recording invoice descriptions, amounts, taxes, and currency
- Setting issue dates and payment due dates
- Managing invoice statuses
- Recording customer payments
- Generating payment references automatically
- Supporting multiple payment methods
- Calculating paid amounts and remaining balances
- Identifying outstanding and overdue invoices
- Supporting collection follow-up
- Showing payment and invoice summaries
- Maintaining finance snapshots and audit history
- Providing finance information to other ERP systems through API endpoints

### 1.3 User-facing functions

The system contains the following pages:

#### Overview

Shows the current finance position:

- Total invoiced
- Total collected
- Outstanding balance
- Overdue invoice count
- Collection performance chart
- Invoice status distribution chart
- Recent invoices

#### Invoices

Allows finance users to:

- Create invoices
- Use automatic invoice numbering
- Search order references and descriptions
- Review invoice totals and balances
- Change invoice status
- View invoice activity summaries
- View payment history for an invoice
- Filter invoices by status

#### Payments

Allows finance users to:

- Select an invoice
- View the customer and current balance
- Record a payment
- Use automatic payment-reference generation
- Select the payment method
- Set the payment status
- Add payment notes
- Review payment activity
- View payment summaries connected to invoices

#### Collections

Shows issued invoices that require collection:

- Sent invoices with a balance
- Partially paid invoices
- Overdue invoices

Draft, Paid, and Void invoices are excluded from active Collections.

#### Reports and balances

Shows:

- Invoice status distribution
- Finance totals
- Invoice and payment snapshots
- Historical status changes
- Payment events
- Paid and remaining balances over time

### 1.4 System ownership boundary

Finance owns:

```text
Invoices
Payments
Balances
Collections
Finance statuses
Finance snapshots
```

Finance does not own:

```text
Product catalogue
Sales orders
Inventory stock
Delivery shipments
```

Those records remain owned by their respective ERP systems. Finance uses references such as `order_reference` to connect financial records to those systems.

---

## 2. Business Rules

### 2.1 Invoice-number rules

- Invoice numbers must be unique.
- If the user leaves the invoice number blank, the system generates one automatically.
- The generated format is:

```text
INV-{year}-{sequence}
```

Example:

```text
INV-2026-0001
```

- A manually supplied invoice number must not duplicate an existing invoice number.

### 2.2 Payment-reference rules

- Payment references must be unique.
- The payment reference is optional when recording a payment.
- If it is blank, the system generates one automatically.
- The generated format is:

```text
PAY-{year}-{sequence}
```

Example:

```text
PAY-2026-0001
```

- Manual external references may be used for bank, card, e-wallet, or gateway transactions.

### 2.3 Invoice amount rules

- Invoice amounts cannot be negative.
- Currency defaults to PHP.
- The invoice total is calculated from the invoice financial values.
- Subtotal, tax amount, and total amount are stored separately for future tax and accounting use.
- The total amount is used when calculating the customer balance.

### 2.4 Payment amount rules

- A payment must be greater than zero.
- A completed payment must not be greater than the invoice balance due.
- Failed or pending payments do not reduce the completed paid amount.
- Refunded payments must not be treated as completed collections.
- A payment must be connected to an invoice.

### 2.5 Balance calculation

The system calculates the balance as:

```text
Paid amount = sum of completed payments
Balance due = invoice total - paid amount
```

The balance cannot be lower than zero:

```text
Balance due = max(invoice total - paid amount, 0)
```

Example:

```text
Invoice total: PHP 1,000.00
Completed payments: PHP 400.00
Balance due: PHP 600.00
```

### 2.6 Invoice status handling

The valid invoice statuses are:

```text
Draft
Sent
Partially paid
Paid
Overdue
Void
```

Normal workflow:

```text
Draft → Sent → Partially paid → Paid
                   │
                   └──────────→ Overdue
```

Status meanings:

- **Draft**: Invoice is still being prepared and is not yet an active collection item.
- **Sent**: Invoice has been issued to the customer and is awaiting payment.
- **Partially paid**: One or more completed payments exist, but a balance remains.
- **Paid**: The invoice balance is zero.
- **Overdue**: The due date has passed and the invoice is not fully paid.
- **Void**: Invoice is cancelled and should not be collected.

### 2.7 Collection rules

An invoice is eligible for active Collections when:

```text
status is Sent, Partially paid, or Overdue
AND balance_due is greater than zero
```

An invoice must not appear in active Collections when it is:

```text
Draft
Paid
Void
```

A Draft invoice can be changed to Sent from its invoice activity summary. Once it is Sent and still has a balance, it becomes eligible for Collections.

### 2.8 Date rules

- Issue date is required for an invoice.
- Due date is required for an invoice.
- Due date cannot be earlier than issue date.
- New invoices default to a due date 30 days after the issue date.
- Payment date is required when recording a payment.
- Overdue calculations compare the due date with the current date.

### 2.9 Snapshot and audit rules

The system records an immutable finance snapshot when:

- An invoice is created
- An invoice is updated
- A payment is recorded

Each snapshot records the financial state at that moment, including:

- Invoice number
- Customer
- Order reference
- Invoice amount
- Paid amount
- Balance due
- Invoice status
- Payment reference, when applicable
- Payment amount, when applicable
- Event date and time

Snapshots are read-only through the API and are used for reports and audit review.

### 2.10 Customer and order-reference rules

- Customer name is required for an invoice.
- Customer email is optional but recommended.
- Order reference is recommended for invoices created from Sales.
- Order descriptions should explain the product, service, or purpose of the invoice.
- Finance should not silently change a Sales order, product, stock record, or delivery record.

---

## 3. Integration Requirements

### 3.1 Integration principle

The Finance Management System is a separate system. It does not directly share database foreign keys with the other ERP systems.

The systems communicate using stable business references:

```text
Sales order number → Finance order_reference
Sales order number → Delivery order_reference
Finance invoice number → Payment invoice reference
```

In other words, anong data ang matatanggap at ibibigay ng Finance System sa ibang systems is defined through API payloads and business references, not by directly editing another system's database.

### 3.2 Data received from Sales

When Sales confirms an order, Finance should receive:

```json
{
  "order_reference": "ORD-10024",
  "customer_name": "Maria Santos",
  "customer_email": "maria@example.com",
  "order_description": "2 x Wireless Headphones",
  "currency": "PHP",
  "subtotal": "2700.00",
  "tax_amount": "298.00",
  "total_amount": "2998.00",
  "issue_date": "2026-10-23",
  "due_date": "2026-11-22"
}
```

Sales may omit `invoice_number` so Finance can generate it.

Finance should validate:

- Order reference exists or is explicitly marked as a manual invoice
- Customer name is present
- Amounts are valid
- Due date is not before issue date
- The order has not already been invoiced

### 3.3 Data sent back to Sales

Finance should provide:

```json
{
  "invoice_number": "INV-2026-0001",
  "order_reference": "ORD-10024",
  "status": "sent",
  "status_label": "Sent",
  "currency": "PHP",
  "subtotal": "2700.00",
  "tax_amount": "298.00",
  "total_amount": "2998.00",
  "paid_amount": "0.00",
  "balance_due": "2998.00",
  "due_at": "2026-11-22T00:00:00Z"
}
```

Sales can use this information to show the financial state of an order without owning the Finance records.

### 3.4 Data received from payment sources

Finance may receive payment information from:

- Manual finance users
- Bank systems
- Card processors
- E-wallet providers
- Payment gateways
- External accounting systems

The minimum payment payload is:

```json
{
  "invoice": 1,
  "payment_reference": "BANK-TRX-77881",
  "amount": "1499.00",
  "payment_date": "2026-10-23",
  "method": "bank_transfer",
  "status": "completed",
  "notes": "Customer bank transfer"
}
```

Finance may generate the payment reference when the external source does not provide one.

### 3.5 Data sent to Collections or Customer Service

Finance should provide:

```json
{
  "invoice_number": "INV-2026-0001",
  "customer_name": "Maria Santos",
  "order_reference": "ORD-10024",
  "status": "overdue",
  "due_date": "2026-10-10",
  "days_overdue": 13,
  "total_amount": "2998.00",
  "paid_amount": "1000.00",
  "balance_due": "1998.00"
}
```

This allows another system or customer-service team to follow up without changing the Finance data directly.

### 3.6 Data shared with Delivery

Finance does not need to manage delivery status. Delivery may receive or look up:

```text
order_reference
customer_name
payment status, when delivery policy requires it
invoice status, when release depends on payment
```

For example, a business may configure Delivery to release an order only when Finance reports:

```text
status = paid
```

That policy should be agreed by the ERP team before being enforced.

### 3.7 Integration API endpoints

Base URL:

```text
/api/financial/
```

Invoice endpoints:

```http
GET    /invoices/
POST   /invoices/
GET    /invoices/{id}/
PATCH  /invoices/{id}/
GET    /invoices/summary/
POST   /invoices/{id}/record_payment/
```

Payment endpoints:

```http
GET    /payments/
POST   /payments/
GET    /payments/{id}/
PATCH  /payments/{id}/
```

Audit endpoint:

```http
GET    /snapshots/
GET    /snapshots/{id}/
```

### 3.8 Integration requirements recommended for production

The following should be added before connecting real systems:

- Authentication for service-to-service requests
- Permission checks by system and user role
- Idempotency keys to prevent duplicate invoices and payments
- Duplicate order-reference validation
- Webhook delivery and retry handling
- Error response standards shared by all five systems
- Integration event logs
- Reference-data validation against Sales
- Reconciliation reports between Sales orders and Finance invoices
- Alerts for failed invoice or payment synchronization
- Audit information identifying the user or system that created each record

### 3.9 Current integration status

The current local ERP data confirms that `ORD-DEMO-001` is shared by:

```text
Sales
Main Billing
Delivery
Standalone Finance
```

The Finance test reference `ORD-AUTO-001` exists only in the standalone Finance database and should not be used for production transactions.

The main ERP database and standalone Finance database are currently separate. They are connected by business references, but automatic synchronization between them still needs to be implemented through authenticated API calls or an integration service.

---

## 4. Recommended next improvements

The next recommended Finance improvements are:

1. Add user authentication and role permissions.
2. Add an authenticated Sales-to-Finance invoice integration.
3. Add duplicate order and duplicate invoice prevention.
4. Generate downloadable PDF invoices and payment receipts.
5. Add accounts-receivable aging buckets: current, 1–30, 31–60, 61–90, and 90+ days.
6. Add payment reconciliation with bank and gateway references.
7. Add refunds and credit notes.
8. Add tax rules and accounting journal integration.
9. Add CSV/Excel export for invoices, payments, collections, and reports.
10. Add monitoring, retries, and integration logs.

> Note: The full ERP database design, ERD, entities, attributes, primary keys, foreign keys, and cardinalities are intentionally not included in this document because they belong to the complete five-system ERP documentation, not only the Finance Management System.
