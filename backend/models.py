from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()

RECEIPT = "receipt"
ADJUSTMENT = "adjustment"
ALLOCATION = "allocation"
RELEASE = "release"
SHIPMENT = "shipment"


def utcnow():
    return datetime.now(timezone.utc)


def iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


class Product(db.Model):
    __tablename__ = "catalog_product"

    id = db.Column(db.BigInteger, primary_key=True)
    sku = db.Column(db.String(40), nullable=False, unique=True)
    name = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category_id = db.Column(db.BigInteger, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(12), nullable=False)
    created_at = db.Column(db.DateTime(6), nullable=False)
    updated_at = db.Column(db.DateTime(6), nullable=False)


class Category(db.Model):
    __tablename__ = "catalog_category"

    id = db.Column(db.BigInteger, primary_key=True)
    name = db.Column(db.String(100), nullable=False)


class StockLevel(db.Model):
    __tablename__ = "inventory_stocklevel"

    id = db.Column(db.BigInteger, primary_key=True)
    product_id = db.Column(db.BigInteger, db.ForeignKey("catalog_product.id"), nullable=False, unique=True)
    quantity_on_hand = db.Column(db.Integer, nullable=False, default=0)
    quantity_reserved = db.Column(db.Integer, nullable=False, default=0)
    reorder_level = db.Column(db.Integer, nullable=False, default=0)
    reorder_quantity = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime(6), nullable=False)

    product = db.relationship("Product", lazy="joined")

    @property
    def available(self):
        return self.quantity_on_hand - self.quantity_reserved

    @property
    def status(self):
        if self.available <= 0:
            return "out_of_stock"
        if self.available <= self.reorder_level:
            return "low_stock"
        return "in_stock"


class StockMovement(db.Model):
    __tablename__ = "inventory_stockmovement"

    id = db.Column(db.BigInteger, primary_key=True)
    product_id = db.Column(db.BigInteger, db.ForeignKey("catalog_product.id"), nullable=False)
    purchase_order_id = db.Column(db.BigInteger, db.ForeignKey("inventory_purchaseorder.id"), nullable=True)
    movement_type = db.Column(db.String(20), nullable=False)
    quantity_delta = db.Column(db.Integer, nullable=False)
    reference_type = db.Column(db.String(30), nullable=True)
    reference_id = db.Column(db.String(40), nullable=True)
    note = db.Column(db.Text, nullable=True)
    performed_by_id = db.Column(db.Integer, db.ForeignKey("auth_user.id"), nullable=True)
    occurred_at = db.Column(db.DateTime(6), nullable=False)

    product = db.relationship("Product", lazy="joined")


class Supplier(db.Model):
    __tablename__ = "inventory_supplier"

    id = db.Column(db.BigInteger, primary_key=True)
    supplier_code = db.Column(db.String(30), nullable=False, unique=True)
    name = db.Column(db.String(180), nullable=False)
    email = db.Column(db.String(254))
    phone = db.Column(db.String(40))
    address = db.Column(db.Text)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(6), nullable=False)


class PurchaseOrder(db.Model):
    __tablename__ = "inventory_purchaseorder"

    id = db.Column(db.BigInteger, primary_key=True)
    purchase_order_number = db.Column(db.String(40), nullable=False, unique=True)
    supplier_id = db.Column(db.BigInteger, db.ForeignKey("inventory_supplier.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="draft")
    ordered_at = db.Column(db.DateTime(6))
    expected_at = db.Column(db.Date)
    currency = db.Column(db.String(3), nullable=False, default="PHP")
    notes = db.Column(db.Text)
    created_by_id = db.Column(db.Integer, db.ForeignKey("auth_user.id"))
    created_at = db.Column(db.DateTime(6), nullable=False)

    supplier = db.relationship("Supplier", lazy="joined")
    items = db.relationship("PurchaseOrderItem", back_populates="purchase_order", lazy="select")


class PurchaseOrderItem(db.Model):
    __tablename__ = "inventory_purchaseorderitem"

    id = db.Column(db.BigInteger, primary_key=True)
    purchase_order_id = db.Column(db.BigInteger, db.ForeignKey("inventory_purchaseorder.id"), nullable=False)
    product_id = db.Column(db.BigInteger, db.ForeignKey("catalog_product.id"), nullable=False)
    product_sku_snapshot = db.Column(db.String(40))
    product_name_snapshot = db.Column(db.String(180))
    quantity_ordered = db.Column(db.Integer, nullable=False)
    quantity_received = db.Column(db.Integer, nullable=False, default=0)
    unit_cost = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    purchase_order = db.relationship("PurchaseOrder", back_populates="items")
    product = db.relationship("Product", lazy="joined")
