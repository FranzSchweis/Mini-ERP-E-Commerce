from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import Invoice, Payment


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    method_label = serializers.CharField(source="get_method_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id", "invoice", "invoice_number", "payment_reference", "amount",
            "payment_date", "method", "method_label", "status", "status_label",
            "notes", "created_at",
        ]
        read_only_fields = ["id", "created_at", "invoice_number", "method_label", "status_label"]

    def validate(self, attrs):
        invoice = attrs.get("invoice", getattr(self.instance, "invoice", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", Decimal("0")))
        if invoice and amount > invoice.balance_due + (self.instance.amount if self.instance else Decimal("0")):
            raise serializers.ValidationError({"amount": "Payment cannot be greater than the invoice balance."})
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    payment_count = serializers.IntegerField(source="payments.count", read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "customer_name", "customer_email", "order_reference",
            "issue_date", "due_date", "amount", "status", "status_label", "notes",
            "paid_amount", "balance_due", "payment_count", "payments", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "paid_amount", "balance_due", "payment_count", "payments", "created_at", "updated_at"]

    def validate(self, attrs):
        issue_date = attrs.get("issue_date", getattr(self.instance, "issue_date", None))
        due_date = attrs.get("due_date", getattr(self.instance, "due_date", None))
        if issue_date and due_date and due_date < issue_date:
            raise serializers.ValidationError({"due_date": "Due date cannot be before issue date."})
        return attrs
