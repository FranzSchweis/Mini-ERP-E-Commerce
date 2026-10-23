# Financial Management System

The `financial-management-system/` folder is the standalone Finance system for the five-system ERP. It is owned by the Finance team and can be developed, tested, and run independently from Catalogue, Sales, Inventory, and Delivery.

## Scope and ownership

The Finance system owns:

- Customer invoices

- Invoice numbering

- Invoice statuses

- Currency, subtotal, tax, and total amounts

- Payment records

- Payment references

- Payment methods and statuses

- Paid amounts and balances due

- Collections and overdue monitoring

- Financial analytics

- Invoice and payment summaries

- Immutable finance snapshots and audit history

It does not own:

- Products or categories

- Sales orders or order lines

- Inventory stock

- Suppliers or purchasing

- Shipments or delivery tracking

The `order_reference` value connects Finance to the Sales system. It is a business reference, not a direct foreign key into another system's database.

## Current pages

The frontend has separate pages for:

- **Overview** — live totals, collection chart, invoice status chart, and recent invoices

- **Invoices** — create, search, filter, review, and update invoices

- **Payments** — record payments, automatic payment references, payment summaries, and payment history

- **Collections** — issued invoices requiring collection; Draft, Paid, and Void invoices are excluded

- **Reports & balances** — status distribution and immutable finance snapshot timeline

Click an invoice number or payment reference to open its activity summary.

## Invoice workflow

```
Draft → Sent → Partially paid → Paid
                   │
                   └──────────→ Overdue

Draft or Sent → Void
```

Draft invoices are still being prepared and do not appear in active Collections. To issue an invoice, open it from the Invoices page, change its status to `Sent`, and save the status.

Invoice numbers are generated automatically when omitted:

```
INV-2026-0001
```

## Payment workflow

Payments are recorded against an invoice. A payment must be greater than zero and cannot exceed the remaining invoice balance.

Payment references are generated automatically when omitted:

```
PAY-2026-0001
```

Completed payments update the invoice automatically:

```
Balance is zero       → Paid
Payment plus balance  → Partially paid
Due date passed       → Overdue
```

## Folder structure

```
financial-management-system/
├── backend/
│   ├── financial/          Finance Django app
│   ├── config/             Standalone Django configuration
│   ├── migrations/         Finance database migrations
│   ├── seed_demo.py        Repeatable Finance demo data
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── modules/financial/
│   │   │   └── FinancialManagementPage.tsx
│   │   └── App.tsx
│   └── package.json
├── FINANCE-INTEGRATION-AUDIT.md
└── SYSTEM-DOCUMENTATION.md
```

## Backend setup

From the repository root:

```
cd financial-management-system\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
```

Start the standalone Finance API:

```
python manage.py runserver 0.0.0.0:8001
```

The backend is available at:

```
Local: http://127.0.0.1:8001/
LAN:   http://<your-computer-ip>:8001/
```

The API health check is:

```
http://127.0.0.1:8001/api/health/
```

## Demo data

Run this after migrations:

```
cd financial-management-system\backend
.venv\Scripts\python.exe seed_demo.py
```

The seeder is safe to run repeatedly. It creates or updates a Finance demo invoice:

```
Invoice: FIN-DEMO-001
Order: ORD-DEMO-001
Amount: PHP 2,998.00
Payment: FIN-PAY-DEMO-001
Paid: PHP 1,499.00
Balance: PHP 1,499.00
Status: Partially paid
```

## Frontend setup

Open another terminal:

```
cd financial-management-system\frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5174
```

Open the application locally:

```
http://localhost:5174/
```

For another device on the same network, use:

```
http://<your-computer-ip>:5174/
```

The frontend automatically calls the Finance API on the same hostname using port `8001`, unless `VITE_API_BASE_URL` is configured.

Example frontend environment file:

```
VITE_API_BASE_URL=http://127.0.0.1:8001/api
```

## API routes

All Finance routes are namespaced under `/api/financial/`.

### System

```
GET /api/health/
```

### Invoices

```
GET    /api/financial/invoices/
POST   /api/financial/invoices/
GET    /api/financial/invoices/{id}/
PATCH  /api/financial/invoices/{id}/
DELETE /api/financial/invoices/{id}/
GET    /api/financial/invoices/summary/
POST   /api/financial/invoices/{id}/record_payment/
```

Search or filter invoices:

```
GET /api/financial/invoices/?search=ORD-DEMO-001
GET /api/financial/invoices/?status=overdue
```

### Payments

```
GET    /api/financial/payments/
POST   /api/financial/payments/
GET    /api/financial/payments/{id}/
PATCH  /api/financial/payments/{id}/
DELETE /api/financial/payments/{id}/
```

Filter payments by invoice:

```
GET /api/financial/payments/?invoice=1
```

### Finance snapshots

```
GET /api/financial/snapshots/
GET /api/financial/snapshots/{id}/
```

Filter snapshots by invoice:

```
GET /api/financial/snapshots/?invoice=1
```

Snapshots are read-only through the API. They record invoice creation, invoice updates, and payment events.

## Recommended test flow

1. Run migrations.

1. Run `seed_demo.py`.

1. Start Django on port `8001`.

1. Start Vite on port `5174`.

1. Open the Finance System.

1. Open **Invoices** and click an invoice number.

1. Create a Draft invoice.

1. Open its activity summary and change it to `Sent`.

1. Confirm it appears in Collections while it has a balance.

1. Open **Payments** and record a partial payment without entering a payment reference.

1. Confirm a `PAY-YYYY-NNNN` reference is generated.

1. Confirm the invoice becomes Partially paid.

1. Record the remaining balance.

1. Confirm the invoice becomes Paid and leaves Collections.

1. Open **Reports & balances** and confirm the snapshot timeline contains the invoice and payment events.

## Integration with the other ERP systems

The recommended flow is:

```
Sales confirms an order
        ↓
Sales sends order and customer billing data to Finance
        ↓
Finance creates an invoice
        ↓
Finance returns invoice number, status, and balance
        ↓
Customer payment is recorded
        ↓
Finance returns updated payment status and balance
```

Finance receives:

```
order_reference
customer_name
customer_email
order_description
currency
subtotal
tax_amount
total_amount
issue_date
due_date
```

Finance provides:

```
invoice_number
order_reference
status
currency
subtotal
tax_amount
total_amount
paid_amount
balance_due
due_at
payment_reference
payment status
```

The full integration review is in:

```
FINANCE-INTEGRATION-AUDIT.md
```

The Finance-specific purpose, business rules, and integration requirements are in:

```
SYSTEM-DOCUMENTATION.md
```

## Git workflow

The Finance work belongs on the `financial-management` branch.

Check the current branch:

```
git branch --show-current
```

Stage only this standalone system:

```
git add -- financial-management-system
```

Do not use `git add .` if the repository contains unrelated Catalogue, Sales, Inventory, Delivery, or main ERP changes.

Review staged files:

```
git status
git diff --cached --stat
```

Commit and push the Finance branch:

```
git commit -m "Update standalone financial management system"
git push -u origin financial-management
```

To contribute the branch to the team repository, create a Pull Request from your fork's `financial-management` branch into the team's target branch.

## Validation commands

Backend:

```
cd financial-management-system\backend
.venv\Scripts\python.exe manage.py check
.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Frontend:

```
cd financial-management-system\frontend
npm run build
```

Before production, add authentication, Finance roles, service-to-service authorization, idempotency keys, payment gateway webhooks, database backups, PDF invoices, reconciliation, and secure secret configuration.
