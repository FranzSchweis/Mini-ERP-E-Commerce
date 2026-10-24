from datetime import date
from decimal import Decimal

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func, or_

from models import (
    ADJUSTMENT,
    ALLOCATION,
    RECEIPT,
    RELEASE,
    SHIPMENT,
    Category,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    StockLevel,
    StockMovement,
    Supplier,
    db,
    iso,
    utcnow,
)

bp = Blueprint("inventory", __name__, url_prefix="/api")
VALID_PO_STATUSES = {"draft", "ordered", "partially_received", "received", "cancelled"}


@bp.before_request
def require_login():
    if not session.get("inventory_user"):
        return jsonify({"error": "Login required."}), 401


class ApiError(Exception):
    def __init__(self, message, status=400, details=None):
        self.message, self.status, self.details = message, status, details


@bp.errorhandler(ApiError)
def handle_api_error(error):
    body = {"error": error.message}
    if error.details is not None:
        body["details"] = error.details
    return jsonify(body), error.status


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Request body must be a JSON object")
    return data


def integer(value, field, minimum=None):
    if isinstance(value, bool) or value is None:
        raise ApiError(f"'{field}' must be an integer")
    try:
        result = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"'{field}' must be an integer")
    if minimum is not None and result < minimum:
        raise ApiError(f"'{field}' must be at least {minimum}")
    return result


def text(value, field, max_length, required=False):
    result = str(value).strip() if value is not None else ""
    if required and not result:
        raise ApiError(f"'{field}' is required")
    if len(result) > max_length:
        raise ApiError(f"'{field}' must be {max_length} characters or fewer")
    return result or None


def product_row(product, stock=None, category_name=None):
    stock = stock or StockLevel(quantity_on_hand=0, quantity_reserved=0, reorder_level=0, reorder_quantity=0)
    return {
        "id": stock.id,
        "product_id": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "category": category_name,
        "category_id": product.category_id,
        "description": product.description,
        "unit_price": float(product.unit_price) if product.unit_price is not None else None,
        "product_status": product.status,
        "on_hand": stock.quantity_on_hand,
        "reserved": stock.quantity_reserved,
        "available": stock.available,
        "reorder_level": stock.reorder_level,
        "reorder_quantity": stock.reorder_quantity,
        "status": stock.status,
        "updated_at": iso(stock.updated_at),
    }


def stock_query():
    return (
        db.session.query(Product, StockLevel, Category.name)
        .outerjoin(StockLevel, StockLevel.product_id == Product.id)
        .outerjoin(Category, Category.id == Product.category_id)
    )


def find_stock(stock_id, lock=False):
    query = db.session.query(StockLevel).filter(StockLevel.id == stock_id)
    if lock:
        query = query.with_for_update()
    stock = query.first()
    if stock is None:
        raise ApiError("Stock level not found", 404)
    return stock


def find_product(product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        raise ApiError("Product not found in catalog_product", 404)
    return product


def record_movement(product_id, movement_type, quantity_delta, note=None, reference_type=None, reference_id=None, purchase_order_id=None):
    if quantity_delta == 0:
        raise ApiError("A stock movement cannot have a zero quantity", 400)
    db.session.add(StockMovement(
        product_id=product_id,
        purchase_order_id=purchase_order_id,
        movement_type=movement_type,
        quantity_delta=quantity_delta,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
        occurred_at=utcnow(),
    ))


def ensure_stock(product_id, lock=False):
    stock = db.session.query(StockLevel).filter_by(product_id=product_id)
    if lock:
        stock = stock.with_for_update()
    row = stock.first()
    if row is None:
        raise ApiError("This product has no inventory_stocklevel row yet", 409)
    return row


@bp.get("/inventory")
def list_inventory():
    query = stock_query()
    search = request.args.get("search", "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Product.name.ilike(like), Product.sku.ilike(like), Category.name.ilike(like)))
    available = StockLevel.quantity_on_hand - StockLevel.quantity_reserved
    status = request.args.get("status", "")
    if status == "out_of_stock":
        query = query.filter(StockLevel.id.is_not(None), available <= 0)
    elif status == "low_stock":
        query = query.filter(StockLevel.id.is_not(None), available > 0, available <= StockLevel.reorder_level)
    elif status == "in_stock":
        query = query.filter(StockLevel.id.is_not(None), available > StockLevel.reorder_level)
    sort = request.args.get("sort", "newest")
    if sort == "name":
        query = query.order_by(Product.name)
    elif sort == "lowest_available":
        query = query.order_by(available, Product.name)
    else:
        query = query.order_by(StockLevel.updated_at.desc(), Product.name)
    return jsonify([product_row(product, stock, category) for product, stock, category in query.all()])


@bp.get("/inventory/summary")
def inventory_summary():
    on_hand, reserved = db.session.query(
        func.coalesce(func.sum(StockLevel.quantity_on_hand), 0),
        func.coalesce(func.sum(StockLevel.quantity_reserved), 0),
    ).one()
    available = StockLevel.quantity_on_hand - StockLevel.quantity_reserved
    low = db.session.query(func.count(StockLevel.id)).filter(available > 0, available <= StockLevel.reorder_level).scalar()
    out = db.session.query(func.count(StockLevel.id)).filter(available <= 0).scalar()
    return jsonify({
        "total_items": db.session.query(func.count(StockLevel.id)).scalar(),
        "units_on_hand": int(on_hand), "units_reserved": int(reserved),
        "units_available": int(on_hand) - int(reserved), "low_stock": int(low), "out_of_stock": int(out),
    })


@bp.get("/inventory/products")
def products():
    return list_inventory()


@bp.get("/inventory/low-stock")
def low_stock():
    query = stock_query().filter(StockLevel.id.is_not(None)).filter(
        StockLevel.quantity_on_hand - StockLevel.quantity_reserved <= StockLevel.reorder_level
    )
    return jsonify([product_row(product, stock, category) for product, stock, category in query.all()])


@bp.get("/inventory/<int:stock_id>")
def get_inventory(stock_id):
    stock = find_stock(stock_id)
    product = find_product(stock.product_id)
    category = db.session.get(Category, product.category_id)
    return jsonify(product_row(product, stock, category.name if category else None))


@bp.post("/inventory")
def create_stock_level():
    data = json_body()
    product_id = integer(data.get("product_id"), "product_id", 1)
    product = find_product(product_id)
    if db.session.query(StockLevel).filter_by(product_id=product_id).first():
        raise ApiError("This product already has a stock-level row", 409)
    on_hand = integer(data.get("on_hand", 0), "on_hand", 0)
    reorder_level = integer(data.get("reorder_level", 0), "reorder_level", 0)
    reorder_quantity = integer(data.get("reorder_quantity", 0), "reorder_quantity", 0)
    now = utcnow()
    stock = StockLevel(product_id=product_id, quantity_on_hand=0, quantity_reserved=0, reorder_level=reorder_level, reorder_quantity=reorder_quantity, updated_at=now)
    db.session.add(stock)
    if on_hand:
        db.session.flush()
        stock.quantity_on_hand = on_hand
        record_movement(product_id, RECEIPT, on_hand, "Opening stock")
    db.session.commit()
    category = db.session.get(Category, product.category_id)
    return jsonify(product_row(product, stock, category.name if category else None)), 201


@bp.put("/inventory/<int:stock_id>")
def update_stock_level(stock_id):
    data = json_body()
    stock = find_stock(stock_id, lock=True)
    if "reorder_level" in data:
        stock.reorder_level = integer(data["reorder_level"], "reorder_level", 0)
    if "reorder_quantity" in data:
        stock.reorder_quantity = integer(data["reorder_quantity"], "reorder_quantity", 0)
    stock.updated_at = utcnow()
    db.session.commit()
    return get_inventory(stock_id)


@bp.delete("/inventory/<int:stock_id>")
def delete_stock_level(stock_id):
    stock = find_stock(stock_id, lock=True)
    if stock.quantity_reserved:
        raise ApiError("Cannot remove a stock level while stock is reserved", 409)
    if StockMovement.query.filter_by(product_id=stock.product_id).first():
        raise ApiError("Cannot remove a stock level with movement history", 409)
    db.session.delete(stock)
    db.session.commit()
    return "", 204


@bp.post("/inventory/<int:stock_id>/adjust")
def adjust_stock(stock_id):
    data = json_body()
    stock = find_stock(stock_id, lock=True)
    if "set_quantity" in data:
        new_quantity = integer(data["set_quantity"], "set_quantity", 0)
        change = new_quantity - stock.quantity_on_hand
    elif "change" in data:
        change = integer(data["change"], "change")
    else:
        raise ApiError("Provide either 'change' or 'set_quantity'")
    if change == 0:
        raise ApiError("That would not change the quantity")
    if stock.quantity_on_hand + change < stock.quantity_reserved:
        raise ApiError("On hand cannot go below reserved stock", 409, {"on_hand": stock.quantity_on_hand, "reserved": stock.quantity_reserved})
    stock.quantity_on_hand += change
    stock.updated_at = utcnow()
    record_movement(stock.product_id, RECEIPT if change > 0 else ADJUSTMENT, change, text(data.get("reason"), "reason", 255))
    db.session.commit()
    return get_inventory(stock_id)


@bp.get("/movements")
def list_movements():
    limit = min(max(request.args.get("limit", 100, type=int), 1), 500)
    rows = StockMovement.query.order_by(StockMovement.occurred_at.desc(), StockMovement.id.desc()).limit(limit).all()
    return jsonify([{
        "id": row.id, "product_id": row.product_id, "product_name": row.product.name if row.product else None,
        "sku": row.product.sku if row.product else None, "movement_type": row.movement_type,
        "quantity_delta": row.quantity_delta, "change_on_hand": row.quantity_delta,
        "reference_type": row.reference_type, "reference_id": row.reference_id,
        "purchase_order_id": row.purchase_order_id, "reason": row.note, "created_at": iso(row.occurred_at),
    } for row in rows])


@bp.get("/inventory/<int:stock_id>/movements")
def item_movements(stock_id):
    stock = find_stock(stock_id)
    rows = StockMovement.query.filter_by(product_id=stock.product_id).order_by(StockMovement.occurred_at.desc()).limit(200).all()
    return jsonify([{"id": r.id, "movement_type": r.movement_type, "quantity_delta": r.quantity_delta, "change_on_hand": r.quantity_delta, "reason": r.note, "reference_id": r.reference_id, "created_at": iso(r.occurred_at)} for r in rows])


@bp.get("/inventory/availability")
def availability():
    product_id = integer(request.args.get("product_id"), "product_id", 1)
    requested = integer(request.args.get("quantity", 1), "quantity", 1)
    stock = ensure_stock(product_id)
    return jsonify({"product_id": product_id, "requested": requested, "on_hand": stock.quantity_on_hand, "reserved": stock.quantity_reserved, "available": stock.available, "sufficient": stock.available >= requested})


def bulk_reservation(kind):
    data = json_body()
    reference = text(data.get("reference"), "reference", 40, required=True)
    entries = data.get("items")
    if not isinstance(entries, list) or not entries:
        raise ApiError("'items' must be a non-empty list")
    totals = {}
    for index, item in enumerate(entries):
        if not isinstance(item, dict):
            raise ApiError(f"items[{index}] must be an object")
        pid = integer(item.get("product_id"), f"items[{index}].product_id", 1)
        totals[pid] = totals.get(pid, 0) + integer(item.get("quantity"), f"items[{index}].quantity", 1)
    stocks = {s.product_id: s for s in StockLevel.query.filter(StockLevel.product_id.in_(totals)).with_for_update().all()}
    if len(stocks) != len(totals):
        raise ApiError("Some products have no stock-level row", 404)
    for pid, qty in totals.items():
        stock = stocks[pid]
        if kind == "reserve" and stock.available < qty:
            raise ApiError("Insufficient available stock", 409, {"product_id": pid, "available": stock.available, "requested": qty})
        if kind != "reserve" and stock.quantity_reserved < qty:
            raise ApiError("Not enough reserved stock", 409, {"product_id": pid, "reserved": stock.quantity_reserved, "requested": qty})
    for pid, qty in totals.items():
        stock = stocks[pid]
        if kind == "reserve":
            stock.quantity_reserved += qty
            movement_type, delta, note = ALLOCATION, qty, "Reserved for order"
        elif kind == "release":
            stock.quantity_reserved -= qty
            movement_type, delta, note = RELEASE, -qty, "Reservation released"
        else:
            stock.quantity_reserved -= qty
            stock.quantity_on_hand -= qty
            movement_type, delta, note = SHIPMENT, -qty, "Order fulfilled"
        stock.updated_at = utcnow()
        record_movement(pid, movement_type, delta, note, "sales_order", reference)
    db.session.commit()
    return jsonify({"success": True, "reference": reference})


@bp.post("/inventory/reserve")
def reserve():
    return bulk_reservation("reserve")


@bp.post("/inventory/release")
def release():
    return bulk_reservation("release")


@bp.post("/inventory/fulfill")
def fulfill():
    return bulk_reservation("fulfill")


@bp.get("/inventory/suppliers")
def list_suppliers():
    return jsonify([supplier_dict(s) for s in Supplier.query.order_by(Supplier.name).all()])


def supplier_dict(s):
    return {"id": s.id, "supplier_code": s.supplier_code, "name": s.name, "email": s.email, "phone": s.phone, "address": s.address, "is_active": s.is_active, "created_at": iso(s.created_at)}


@bp.post("/inventory/suppliers")
def create_supplier():
    data = json_body()
    supplier = Supplier(supplier_code=text(data.get("supplier_code"), "supplier_code", 30, True), name=text(data.get("name"), "name", 180, True), email=text(data.get("email"), "email", 254), phone=text(data.get("phone"), "phone", 40), address=text(data.get("address"), "address", 10000), is_active=bool(data.get("is_active", True)), created_at=utcnow())
    db.session.add(supplier)
    db.session.commit()
    return jsonify(supplier_dict(supplier)), 201


@bp.get("/inventory/suppliers/<int:supplier_id>")
def get_supplier(supplier_id):
    supplier = db.session.get(Supplier, supplier_id)
    if not supplier:
        raise ApiError("Supplier not found", 404)
    return jsonify(supplier_dict(supplier))


@bp.put("/inventory/suppliers/<int:supplier_id>")
def update_supplier(supplier_id):
    supplier = db.session.get(Supplier, supplier_id)
    if not supplier:
        raise ApiError("Supplier not found", 404)
    data = json_body()
    for field, max_len in (("supplier_code", 30), ("name", 180), ("email", 254), ("phone", 40), ("address", 10000)):
        if field in data:
            value = text(data[field], field, max_len, field in {"supplier_code", "name"})
            setattr(supplier, field, value)
    if "is_active" in data:
        supplier.is_active = bool(data["is_active"])
    db.session.commit()
    return jsonify(supplier_dict(supplier))


def po_dict(po, include_items=False):
    result = {"id": po.id, "purchase_order_number": po.purchase_order_number, "supplier_id": po.supplier_id, "supplier": supplier_dict(po.supplier) if po.supplier else None, "status": po.status, "ordered_at": iso(po.ordered_at), "expected_at": po.expected_at.isoformat() if po.expected_at else None, "currency": po.currency, "notes": po.notes, "created_at": iso(po.created_at)}
    if include_items:
        result["items"] = [{"id": i.id, "product_id": i.product_id, "product_sku_snapshot": i.product_sku_snapshot, "product_name_snapshot": i.product_name_snapshot, "quantity_ordered": i.quantity_ordered, "quantity_received": i.quantity_received, "unit_cost": str(i.unit_cost)} for i in po.items]
    return result


@bp.get("/inventory/purchase-orders")
def list_purchase_orders():
    return jsonify([po_dict(po) for po in PurchaseOrder.query.order_by(PurchaseOrder.created_at.desc()).all()])


@bp.post("/inventory/purchase-orders")
def create_purchase_order():
    data = json_body()
    supplier = db.session.get(Supplier, integer(data.get("supplier_id"), "supplier_id", 1))
    if not supplier or not supplier.is_active:
        raise ApiError("Active supplier not found", 404)
    items = data.get("items")
    if not isinstance(items, list) or not items:
        raise ApiError("'items' must be a non-empty list")
    po = PurchaseOrder(purchase_order_number=text(data.get("purchase_order_number"), "purchase_order_number", 40, True), supplier_id=supplier.id, status="draft", currency=text(data.get("currency", "PHP"), "currency", 3, True).upper(), notes=text(data.get("notes"), "notes", 10000), created_at=utcnow())
    db.session.add(po)
    for index, item in enumerate(items):
        product = find_product(integer(item.get("product_id"), f"items[{index}].product_id", 1))
        qty = integer(item.get("quantity_ordered"), f"items[{index}].quantity_ordered", 1)
        unit_cost = Decimal(str(item.get("unit_cost", "0")))
        if unit_cost < 0:
            raise ApiError("unit_cost cannot be negative")
        po.items.append(PurchaseOrderItem(product_id=product.id, product_sku_snapshot=product.sku, product_name_snapshot=product.name, quantity_ordered=qty, quantity_received=0, unit_cost=unit_cost))
    db.session.commit()
    return jsonify(po_dict(po, True)), 201


@bp.get("/inventory/purchase-orders/<int:po_id>")
def get_purchase_order(po_id):
    po = db.session.get(PurchaseOrder, po_id)
    if not po:
        raise ApiError("Purchase order not found", 404)
    return jsonify(po_dict(po, True))


@bp.post("/inventory/purchase-orders/<int:po_id>/order")
def order_purchase_order(po_id):
    po = db.session.query(PurchaseOrder).filter_by(id=po_id).with_for_update().first()
    if not po:
        raise ApiError("Purchase order not found", 404)
    if po.status != "draft":
        raise ApiError("Only draft purchase orders can be ordered", 409)
    po.status, po.ordered_at = "ordered", utcnow()
    db.session.commit()
    return jsonify(po_dict(po, True))


@bp.post("/inventory/purchase-orders/<int:po_id>/receive")
def receive_purchase_order(po_id):
    data = json_body()
    po = db.session.query(PurchaseOrder).filter_by(id=po_id).with_for_update().first()
    if not po:
        raise ApiError("Purchase order not found", 404)
    if po.status not in {"ordered", "partially_received"}:
        raise ApiError("Only ordered or partially received purchase orders can be received", 409)
    receipt_key = text(data.get("idempotency_key"), "idempotency_key", 40, True)
    if StockMovement.query.filter_by(reference_type="purchase_receipt", reference_id=receipt_key).first():
        return jsonify(po_dict(po, True))
    received_items = data.get("items")
    if not isinstance(received_items, list) or not received_items:
        raise ApiError("'items' must be a non-empty list")
    by_id = {item.id: item for item in po.items}
    for entry in received_items:
        item = by_id.get(integer(entry.get("purchase_order_item_id"), "purchase_order_item_id", 1))
        qty = integer(entry.get("quantity"), "quantity", 1)
        if not item or item.quantity_received + qty > item.quantity_ordered:
            raise ApiError("Received quantity cannot exceed ordered quantity", 409)
        stock = ensure_stock(item.product_id, lock=True)
        stock.quantity_on_hand += qty
        stock.updated_at = utcnow()
        item.quantity_received += qty
        record_movement(item.product_id, RECEIPT, qty, f"Received {po.purchase_order_number}", "purchase_receipt", receipt_key, po.id)
    po.status = "received" if all(item.quantity_received == item.quantity_ordered for item in po.items) else "partially_received"
    db.session.commit()
    return jsonify(po_dict(po, True))


@bp.post("/inventory/purchase-orders/<int:po_id>/cancel")
def cancel_purchase_order(po_id):
    po = db.session.query(PurchaseOrder).filter_by(id=po_id).with_for_update().first()
    if not po:
        raise ApiError("Purchase order not found", 404)
    if po.status not in {"draft", "ordered"}:
        raise ApiError("Only draft or ordered purchase orders can be cancelled", 409)
    po.status = "cancelled"
    db.session.commit()
    return jsonify(po_dict(po, True))
