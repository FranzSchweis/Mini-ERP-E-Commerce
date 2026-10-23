import os
from datetime import date, timedelta
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.db import transaction
from financial.models import Invoice, Payment


@transaction.atomic
def seed():
    invoice, _ = Invoice.objects.get_or_create(
        invoice_number="FIN-DEMO-001",
        defaults={
            "customer_name": "Maria Santos (Finance Demo)",
            "customer_email": "maria.finance.demo@example.com",
            "order_reference": "ORD-DEMO-001",
            "order_description": "2 × Demo Wireless Headphones",
            "issue_date": date.today() - timedelta(days=2),
            "due_date": date.today() + timedelta(days=28),
            "amount": Decimal("2998.00"),
            "status": Invoice.Status.PARTIALLY_PAID,
            "notes": "Standalone Financial Management demo invoice.",
        },
    )
    Payment.objects.get_or_create(
        payment_reference="FIN-PAY-DEMO-001",
        defaults={
            "invoice": invoice,
            "amount": Decimal("1499.00"),
            "payment_date": date.today() - timedelta(days=1),
            "method": Payment.Method.BANK_TRANSFER,
            "status": Payment.Status.COMPLETED,
            "notes": "First instalment for finance system testing.",
        },
    )
    invoice.status = Invoice.Status.PARTIALLY_PAID
    invoice.order_description = invoice.order_description or "2 × Demo Wireless Headphones"
    invoice.save(update_fields=["status", "order_description", "updated_at"])
    print(f"Financial demo ready: {invoice.invoice_number}, balance due PHP {invoice.balance_due}")


if __name__ == "__main__":
    seed()
