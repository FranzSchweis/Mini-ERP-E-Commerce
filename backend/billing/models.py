from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


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
    issue_date = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-issue_date", "-created_at"]

    def __str__(self):
        return f"{self.invoice_number} — {self.customer_name}"

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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-created_at"]

    def __str__(self):
        return f"{self.payment_reference} — {self.invoice.invoice_number}"
