# Mini ERP Inventory Management

This project is the Flask + React Inventory Management subsystem. The backend now uses the existing shared MySQL `mini_erp` schema. It does not create, rename, or duplicate database tables.

## Important database rule

Run the complete `MINI_ERP_DATABASE.sql` only for a new empty database. For an existing database, use the migration in `backend/migrations/001_purchase_order_status_check.sql` after checking for invalid purchase-order statuses.

The backend uses these existing tables:

- `catalog_product` and `catalog_category` for product data
- `inventory_stocklevel` for quantities
- `inventory_stockmovement` for the audit trail
- `inventory_supplier` for suppliers
- `inventory_purchaseorder` and `inventory_purchaseorderitem` for purchase orders
- `auth_user` only as a shared foreign-key reference

## Windows setup in VS Code

Open the `inventory-service` folder in VS Code. Open two PowerShell terminals.

### Terminal 1: Flask backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
python app.py
```

Edit `.env` and replace the example credentials in `DATABASE_URL`:

```text
DATABASE_URL=mysql+pymysql://mini_erp_user:your_password@127.0.0.1:3306/mini_erp?charset=utf8mb4
```

If PowerShell blocks activation, run this in the same terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

The API runs at `http://127.0.0.1:5000`.

### Terminal 2: React frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to Flask through `frontend/vite.config.js`.

## API endpoints

### Stock and products

```text
GET    /api/inventory?search=&status=&sort=
GET    /api/inventory/products
GET    /api/inventory/summary
GET    /api/inventory/low-stock
GET    /api/inventory/<stock-level-id>
POST   /api/inventory
PUT    /api/inventory/<stock-level-id>
DELETE /api/inventory/<stock-level-id>
POST   /api/inventory/<stock-level-id>/adjust
GET    /api/movements
GET    /api/inventory/<stock-level-id>/movements
GET    /api/inventory/availability?product_id=1&quantity=3
```

`POST /api/inventory` creates a stock-level row for an existing `catalog_product`. It does not create a product. Example:

```json
{
  "product_id": 12,
  "on_hand": 20,
  "reorder_level": 5,
  "reorder_quantity": 10
}
```

Every stock increase or decrease creates an `inventory_stockmovement` record. Stock is updated inside a transaction and row locks are used for adjustment, reservation, and receiving operations.

### Supplier endpoints

```text
GET  /api/inventory/suppliers
POST /api/inventory/suppliers
GET  /api/inventory/suppliers/<id>
PUT  /api/inventory/suppliers/<id>
```

### Purchase-order endpoints

```text
GET  /api/inventory/purchase-orders
POST /api/inventory/purchase-orders
GET  /api/inventory/purchase-orders/<id>
POST /api/inventory/purchase-orders/<id>/order
POST /api/inventory/purchase-orders/<id>/receive
POST /api/inventory/purchase-orders/<id>/cancel
```

Receiving requires an `idempotency_key`. Repeating a request with the same key does not create duplicate receipt movements.

## Authentication

Authentication is intentionally not guessed in this Flask stage. The team must decide whether Django will issue JWT tokens, share sessions, or use an internal service token. Once the team confirms the integration method, add a Flask authentication middleware and send the authenticated Django user ID as `performed_by_id` or `created_by_id`.

Never commit `.env`, passwords, or secret keys.
