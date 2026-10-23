from django.db import connection


def fetch_sales_order(order_number):
    """Read one normalized order from the shared Sales tables; never writes upstream data."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT so.id, so.order_number, so.status, so.order_date,
                   customer.id AS customer_id, customer.customer_code,
                   customer.customer_name, customer.address
            FROM sales_salesorder AS so
            INNER JOIN sales_customer AS customer ON customer.id = so.customer_id
            WHERE so.order_number = %s
            """,
            [order_number],
        )
        row = cursor.fetchone()
        if row is None:
            return None
        columns = [column[0] for column in cursor.description]
        order = dict(zip(columns, row))

        cursor.execute(
            """
            SELECT line.id AS source_line_id, product.id AS source_product_id,
                   product.sku, product.name, line.quantity
            FROM sales_salesorderitem AS line
            INNER JOIN catalog_product AS product ON product.id = line.product_id
            WHERE line.sales_order_id = %s
            ORDER BY line.id
            """,
            [order["id"]],
        )
        item_columns = [column[0] for column in cursor.description]
        item_rows = [dict(zip(item_columns, item)) for item in cursor.fetchall()]

    ordered_at = order["order_date"]
    return {
        "source_system": "sales",
        "source_order_id": order["id"],
        "source_customer_id": order["customer_id"],
        "source_customer_code": order["customer_code"],
        "order_reference": order["order_number"],
        "source_status": order["status"],
        "ordered_at": ordered_at.isoformat() if hasattr(ordered_at, "isoformat") else ordered_at,
        "recipient_name": order["customer_name"],
        "delivery_address": order["address"],
        "items": [
            {
                "source_line_id": item["source_line_id"],
                "source_product_id": item["source_product_id"],
                "product_reference": item["sku"],
                "product_name": item["name"],
                "quantity": item["quantity"],
            }
            for item in item_rows
        ],
    }
