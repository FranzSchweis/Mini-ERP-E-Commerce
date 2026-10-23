from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Invoice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("invoice_number", models.CharField(db_index=True, max_length=40, unique=True)),
                ("customer_name", models.CharField(db_index=True, max_length=180)),
                ("customer_email", models.EmailField(blank=True, max_length=254)),
                ("order_reference", models.CharField(blank=True, db_index=True, max_length=60)),
                ("issue_date", models.DateField()),
                ("due_date", models.DateField()),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0"))])),
                ("status", models.CharField(choices=[("draft", "Draft"), ("sent", "Sent"), ("partially_paid", "Partially paid"), ("paid", "Paid"), ("overdue", "Overdue"), ("void", "Void")], db_index=True, default="draft", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-issue_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("payment_reference", models.CharField(db_index=True, max_length=60, unique=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))])),
                ("payment_date", models.DateField()),
                ("method", models.CharField(choices=[("bank_transfer", "Bank transfer"), ("card", "Card"), ("cash", "Cash"), ("ewallet", "E-wallet"), ("other", "Other")], default="bank_transfer", max_length=20)),
                ("status", models.CharField(choices=[("completed", "Completed"), ("pending", "Pending"), ("failed", "Failed"), ("refunded", "Refunded")], db_index=True, default="completed", max_length=12)),
                ("notes", models.CharField(blank=True, max_length=240)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("invoice", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="financial.invoice")),
            ],
            options={"ordering": ["-payment_date", "-created_at"]},
        ),
    ]
