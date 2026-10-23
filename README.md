# Del & Ship

Del & Ship is a mobile-friendly fulfillment workspace for managing shipment preparation, carrier details, delivery status, and shipment history. The current scope is shipping operations only; product-catalogue screens and API code have been removed. Shipment lines remain as item-description snapshots because packers need to know what is inside a shipment.

## Features

- Shipment overview, all shipments, in-transit shipments, delivery exceptions, and delivered shipments.
- Create one shipment per order with multiple item lines.
- Edit carrier and tracking details without changing shipment status.
- Permanently delete a delivered shipment after an in-app confirmation; other shipment statuses cannot be deleted.
- Record status changes with history; delivery-failure updates require a reason.
- Look up Sales orders to prefill shipment details, and expose authenticated APIs for inbound shipment handoff and status polling.
- Username/password login backed by Django sessions and an HttpOnly cookie, with automatic sign-out after five minutes of inactivity.
- Responsive mobile navigation and persisted light/dark appearance.

## Technology

- Frontend: React, TypeScript, Vite.
- Backend: Django REST Framework.
- Database: MySQL 8 for the shared/demo database. The Django settings also support SQLite for a quick isolated local run.

## Run locally on Windows

### 1. Start MySQL

Start the **MySQL80** service from Windows Services (`Win + R` → `services.msc`). The MySQL server should have a schema/database named `mini_erp` and an account with permissions on it. Configure the database login in `backend/.env`; do not commit or share that file.

### 2. Configure and start Django

Open PowerShell:

```powershell
cd G:\SIA\Mini-ERP-E-Commerce\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

In `.env`, set `MYSQL_PASSWORD` to the password for the `mini_erp` MySQL account (and ensure the database account exists). Keep this password private. For server-to-server integrations, also set a private `ERP_INTEGRATION_API_KEY` as described in the API handoff. Then run:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8238
```

If you already have a Django login, skip `createsuperuser`. Leave this terminal open while using the app. Django serves the API at `http://127.0.0.1:8238/api/`.

### 3. Start the frontend

Open a second PowerShell window:

```powershell
cd G:\SIA\Mini-ERP-E-Commerce\frontend
npm ci
npm run dev
```

Open `http://localhost:5170`, then sign in with your Django username and password. Keep both terminals open. Press `Ctrl+C` in each terminal to stop its server.

### SQLite alternative

For an isolated local demo without MySQL, set `DB_ENGINE=sqlite` in `backend/.env`, then run `manage.py migrate` and create a Django user as above. SQLite stores its file under `backend/db.sqlite3`; it is separate from the MySQL `mini_erp` schema.

## API overview

Protected API routes require a Django session cookie. `GET /api/health/` and `GET /api/auth/csrf/` are public; login is also public but CSRF-protected. The session cookie is HttpOnly and uses a five-minute rolling timeout; active sessions are refreshed while the user is active. Mutating requests use Django CSRF protection. The Vite development server proxies `/api/` to Django so the browser sees a same-origin session cookie.

- `GET /api/health/` — public backend health check.
- `GET /api/auth/csrf/` — initialize the CSRF cookie/token for secure sign-in and write requests.
- `POST /api/auth/login/`, `GET /api/auth/me/`, `POST /api/auth/logout/` — create, inspect, and destroy the authenticated session.
- `GET /api/shipments/` — paginated shipment register; supports status and search filters.
- `POST /api/shipments/` — create a shipment with one or more item snapshots.
- `GET /api/shipments/{id}/` — shipment details, item lines, and status history.
- `POST /api/shipments/{id}/status/` — validated status transition and optional event note.
- `PATCH /api/shipments/{id}/logistics/` — update only carrier and tracking number.
- `DELETE /api/shipments/{id}/` — delete only delivered shipments, including their item lines and status history.
- `GET /api/integrations/sales-orders/{order_number}/` — read a Sales order from the configured shared database for fulfillment review.
- `POST /api/integrations/shipments/` — idempotently receive a shipment snapshot from an upstream system.
- `GET /api/integrations/shipments/{order_reference}/` — allow an upstream system to poll shipment status and history.

The API contract and ownership boundaries are documented in [`docs/del-and-ship-api.md`](docs/del-and-ship-api.md).

## ERP integration readiness

The integration app adds no database tables or migrations. It reads Sales orders and product/customer snapshots from the agreed shared tables and writes only Del & Ship-owned shipment records. The supplied SQL file is a complete-schema script for an empty database; do **not** run it against the current database. The current database does not yet contain the Sales order tables, so Sales lookup will return HTTP 503 until the Sales module tables are available. Manual shipment creation and authenticated inbound API requests remain usable.

External services authenticate with `X-ERP-Integration-Key`; configure that key in the private `backend/.env` before enabling callers. Use HTTPS and keep the key out of source control. The browser UI uses the existing session/CSRF authentication instead.

## Notes for this redesign

- Create at least one Django user with `manage.py createsuperuser` before logging in.
- Login automatically expires after five minutes without activity; activity keeps the Django session alive and returns you to the login screen after idle sign-out.
- The authentication is intended for a classroom/local demonstration. Configure HTTPS, stronger password policy, secure deployment settings, and secret management before any public deployment.
- Removing the catalogue application removes its code and routes; it does **not** automatically drop existing MySQL tables or erase database data. Shipment records and shipment item snapshots are preserved.
