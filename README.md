# Mini ERP — Product Catalogue and Delivery & Shipments

This shared repo began with **System 1: Product & Catalogue Management** and now also includes a separate **System 5: Delivery & Shipments** module. The systems share the app shell and backend project, while keeping their data ownership and feature code separate.

## System 1 responsibility: Product & Catalogue

You own product identity and catalogue descriptions:

- Product ID (database-generated and stable)
- SKU (team-wide product code, e.g. `PRD-001`)
- Name and description
- Category
- Catalogue unit price
- Status: active, draft, or archived

You do **not** own customer orders, stock quantities or stock movements, purchase orders/suppliers, invoices/payments, or shipments/tracking. The database and screen deliberately leave those to the teammates responsible for Systems 2–5. In particular, Sales should copy the agreed catalogue price onto each order line when the order is placed; Inventory should own stock quantities.

## How the pieces talk to each other

The browser (Vite/React) sends requests to your Django API. Django reads/writes MySQL. The other systems should call the same Django API or agree on a shared database/service with the team. They should store your product's `id` or `sku` as a reference, not make their own competing product record.

See [`docs/product-catalogue-api.md`](docs/product-catalogue-api.md) for the short handoff contract to share with the group.

## Run it, step by step

You need Python 3.10+, Node.js 20+, and MySQL 8. If you have Docker Desktop, it can start MySQL for you.

### Step 1 — Get the project on your computer

If you have Git installed, open Terminal (Mac/Linux) or PowerShell (Windows) and run:

```bash
git clone https://github.com/FranzSchweis/Mini-ERP-E-Commerce.git
cd Mini-ERP-E-Commerce
```

If you already downloaded the project, open a terminal in that folder instead.

### Step 2 — Start the database

With Docker Desktop open, run:

```bash
docker compose up -d mysql
```

This starts a local MySQL database with the development settings in `docker-compose.yml`. Don't use those sample passwords for a real/public deployment. If your team already has a shared MySQL database, use its connection details in the next step instead.

### Step 3 — Install and start the Django backend

In the project terminal:

```bash
cd backend
python -m venv .venv
```

Activate the environment:

- **Windows PowerShell:** `.venv\\Scripts\\Activate.ps1`
- **Mac/Linux:** `source .venv/bin/activate`

Then run:

```bash
python -m pip install -r requirements.txt
```

Copy the sample database settings into a private local file:

- **Windows PowerShell:** `Copy-Item .env.example .env`
- **Mac/Linux:** `cp .env.example .env`

For Docker's default settings, the example is already configured. Then create the database tables and start Django:

```bash
python manage.py migrate
python manage.py runserver
```

Leave this terminal window running. You should see a message that Django is serving at `http://127.0.0.1:8000/`. The categories are preloaded, so you can make a product immediately.

### Step 4 — Start the Vite frontend in a second terminal

Open a **second** terminal in the project folder, then run:

```bash
cd frontend
npm install
npm run dev
```

Open the local link Vite prints (usually `http://localhost:5173`). Keep both terminals running while using the app. Add a product in the form; it should appear in the Products table.

### Step 5 — If something goes wrong

- **The page says API not connected:** check the Django terminal is still running; refresh the webpage.
- **Docker/MySQL isn't available:** in `backend/.env`, change `DB_ENGINE=mysql` to `DB_ENGINE=sqlite`, then run `python manage.py migrate` again. SQLite is fine for a quick local demo, but agree with your group before integration.
- **A product won't save:** SKU must be unique. Try a new team SKU such as `PRD-002`; the category must also be selected.
- **Stop the programs:** press `Ctrl+C` in each running terminal.

## Main API routes

- `GET /api/health/` — check whether Django is running.
- `GET /api/categories/` — list categories.
- `GET /api/products/` — list products. Search using `?search=headphones`; filter using `?status=active` or `?category=1`.
- `POST /api/products/` — create a product.
- `GET /api/products/{id}/` — retrieve one product by database ID.

Django REST Framework also provides update and delete routes. Coordinate any deletes with the group; once other systems reference a product, archiving it is safer than deleting it.

## Before group integration

1. Agree on the SKU pattern (for example, `PRD-001`, `PRD-002`) and who creates each product.
2. Share the API contract with the other four members.
3. Ask each member to use your product's ID or SKU in their order, inventory, invoice, or shipment records.
4. Agree on one database/API environment and update the `.env` settings together.
5. Add login/permissions only after the group agrees how authentication will work. This scaffold is for local development and currently does not protect the API.

## System 5 — Delivery & Shipments

The shared app now includes a separate System 5 shipment module under `backend/shipments/` and `frontend/src/modules/delivery/`. It owns shipment details and status history, while order references remain external IDs owned by Sales & Orders. The current classroom MVP allows staff to enter demo order details until the Orders API is agreed and available.

See [`docs/system5-shipment-api.md`](docs/system5-shipment-api.md) for the shipment boundary, status transitions, and API contract. After pulling this branch, run `python manage.py migrate` from `backend/` before opening the Delivery & Shipments page.
