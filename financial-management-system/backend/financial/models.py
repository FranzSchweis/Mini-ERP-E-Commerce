from datetime import datetime, time
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        PARTIALLY_PAID = "partially_paid", "Partially paid"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"
        VOID = "void", "Void"

    invoice_number = models.CharField(max_length=40, unique=True, db_index=True)
    customer_name = models.CharField(max_length=180, db_index=True)
    customer_email = models.EmailField(blank=True)
    order_reference = models.CharField(max_length=60, blank=True, db_index=True)
    order_description = models.CharField(max_length=240, blank=True)
    currency = models.CharField(max_length=3, default="PHP")
    issue_date = models.DateField()
    due_date = models.DateField()
    issued_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-issue_date", "-created_at"]
        db_table = "finance_invoice"

    def __str__(self):
        return f"{self.invoice_number} — {self.customer_name}"

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            prefix = f"INV-{(self.issue_date or timezone.localdate()).year}-"
            latest = Invoice.objects.filter(invoice_number__startswith=prefix).order_by("-invoice_number").first()
            sequence = int(latest.invoice_number.rsplit("-", 1)[-1]) + 1 if latest else 1
            self.invoice_number = f"{prefix}{sequence:04d}"
        if not self.currency:
            self.currency = "PHP"
        if not self.issued_at and self.issue_date:
            self.issued_at = timezone.make_aware(datetime.combine(self.issue_date, time.min))
        if not self.due_at and self.due_date:
            self.due_at = timezone.make_aware(datetime.combine(self.due_date, time.min))
        if not self.subtotal and not self.tax_amount:
            self.subtotal = self.amount
        if not self.total_amount:
            self.total_amount = self.amount
        super().save(*args, **kwargs)

    @property
    def paid_amount(self):
        return sum((payment.amount for payment in self.payments.filter(status=Payment.Status.COMPLETED)), Decimal("0"))

    @property
    def balance_due(self):
        return max(self.amount - self.paid_amount, Decimal("0"))


class Payment(models.Model):
    class Method(models.TextChoices):
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        CARD = "card", "Card"
        CASH = "cash", "Cash"
        EWALLET = "ewallet", "E-wallet"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        PENDING = "pending", "Pending"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    payment_reference = models.CharField(max_length=60, unique=True, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    payment_date = models.DateField()
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.BANK_TRANSFER)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.COMPLETED, db_index=True)
    notes = models.CharField(max_length=240, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-created_at"]
        db_table = "finance_payment"

    def __str__(self):
        return f"{self.payment_reference} — {self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        if not self.payment_reference:
            prefix = f"PAY-{(self.payment_date or timezone.localdate()).year}-"
            latest = Payment.objects.filter(payment_reference__startswith=prefix).order_by("-payment_reference").first()
            sequence = int(latest.payment_reference.rsplit("-", 1)[-1]) + 1 if latest else 1
            self.payment_reference = f"{prefix}{sequence:04d}"
        if not self.paid_at and self.payment_date:
            self.paid_at = timezone.make_aware(datetime.combine(self.payment_date, time.min))
        super().save(*args, **kwargs)


class FinanceSnapshot(models.Model):
    class EventType(models.TextChoices):
        INVOICE_CREATED = "invoice_created", "Invoice created"
        INVOICE_UPDATED = "invoice_updated", "Invoice updated"
        PAYMENT_RECORDED = "payment_recorded", "Payment recorded"

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="snapshots")
    event_type = models.CharField(max_length=24, choices=EventType.choices)
    event_at = models.DateTimeField(auto_now_add=True, db_index=True)
    invoice_number = models.CharField(max_length=40)
    customer_name = models.CharField(max_length=180)
    order_reference = models.CharField(max_length=60, blank=True)
    order_description = models.CharField(max_length=240, blank=True)
    invoice_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_due = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20)
    payment_reference = models.CharField(max_length=60, blank=True)
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    note = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["-event_at"]
        db_table = "finance_snapshot"

    def __str__(self):
        return f"{self.invoice_number} — {self.event_type} — {self.event_at:%Y-%m-%d %H:%M}"
