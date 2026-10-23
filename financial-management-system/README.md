# Financial Management System

This folder is the standalone Finance/Billing system owned by the finance team. It is independent from the main five-system ERP repository and can be developed, tested, and run separately.

## Owns

- Customer invoices
- Payment records
- Payment methods and statuses
- Paid amounts and balances due
- Overdue invoice summaries
- Order references supplied by the Sales system
- Optional order descriptions, such as product names or service purposes

It does not own products, orders, inventory, or shipments. The `order_reference` field is an integration reference to the separate Sales system.

## Folder structure

```text
financial-management-system/
├── backend/
│   ├── financial/          Finance Django app
│   ├── config/             Standalone Django configuration
│   ├── seed_demo.py        Finance-only demo data
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    └── src/
        └── modules/financial/
            └── FinancialManagementPage.tsx
```

## Run the backend

Open a terminal in this folder:

```powershell
cd financial-management-system\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8001
```

The standalone finance API runs at `http://127.0.0.1:8001/` locally and can be reached from another device at `http://192.168.1.29:8001/` when the computer firewall allows it.

## Seed test data

In a second backend command window, or after migrations:

```powershell
cd financial-management-system\backend
.venv\Scripts\python.exe seed_demo.py
```

This creates a partially paid invoice:

```text
Invoice: FIN-DEMO-001
Amount: PHP 2,998.00
Payment: FIN-PAY-DEMO-001
Paid: PHP 1,499.00
Balance: PHP 1,499.00
Status: Partially paid
```

The seeder is safe to run repeatedly.

## Run the frontend

Open another terminal:

```powershell
cd financial-management-system\frontend
npm install
npm run dev -- --port 5174
```

Open `http://localhost:5174` locally or `http://192.168.1.29:5174/` from another device on the same network.

The frontend calls:

```text
http://127.0.0.1:8001/api/financial/
```

## API routes

```text
GET    /api/health/
GET    /api/financial/invoices/
POST   /api/financial/invoices/
GET    /api/financial/invoices/summary/
POST   /api/financial/invoices/{id}/record_payment/
GET    /api/financial/payments/
POST   /api/financial/payments/
```

## Test flow

1. Run migrations.
2. Run `seed_demo.py`.
3. Start Django on port `8001`.
4. Start Vite on port `5174`.
5. Open the Financial Management System.
6. Confirm `FIN-DEMO-001` appears as Partially paid.
7. Record a payment of `PHP 1,499.00`.
8. Confirm the invoice becomes Paid and the balance becomes `PHP 0.00`.
9. Create a new invoice and test partial payments, overdue dates, payment methods, and filtering.

On the Invoices page, type into **Order reference** to see known references from existing finance records. Each invoice can also store an **Order description** so users can identify an order by its product, service, or purpose without opening the Sales system.

Before production, add authentication, finance roles, audit logs, idempotency, payment gateway webhooks, and secure secret configuration.
