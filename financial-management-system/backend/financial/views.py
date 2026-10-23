from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import FinanceSnapshot, Invoice, Payment
from .serializers import FinanceSnapshotSerializer, InvoiceSerializer, PaymentSerializer


def create_snapshot(invoice, event_type, payment=None, note=""):
    invoice.refresh_from_db()
    return FinanceSnapshot.objects.create(
        invoice=invoice,
        event_type=event_type,
        invoice_number=invoice.invoice_number,
        customer_name=invoice.customer_name,
        order_reference=invoice.order_reference,
        order_description=invoice.order_description,
        invoice_amount=invoice.amount,
        paid_amount=invoice.paid_amount,
        balance_due=invoice.balance_due,
        status=invoice.status,
        payment_reference=payment.payment_reference if payment else "",
        payment_amount=payment.amount if payment else None,
        note=note,
    )


def sync_invoice_status(invoice):
    invoice.refresh_from_db()
    if invoice.balance_due <= 0:
        invoice.status = Invoice.Status.PAID
    elif invoice.paid_amount > 0 and invoice.status != Invoice.Status.VOID:
        invoice.status = Invoice.Status.PARTIALLY_PAID
    invoice.save(update_fields=["status", "updated_at"])
    return invoice


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.prefetch_related("payments").all()
    serializer_class = InvoiceSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["invoice_number", "customer_name", "customer_email", "order_reference", "order_description"]
    ordering_fields = ["issue_date", "due_date", "amount", "customer_name", "created_at"]
    ordering = ["-issue_date", "-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def perform_create(self, serializer):
        invoice = serializer.save()
        create_snapshot(invoice, FinanceSnapshot.EventType.INVOICE_CREATED, note="Invoice created")

    def perform_update(self, serializer):
        invoice = serializer.save()
        create_snapshot(invoice, FinanceSnapshot.EventType.INVOICE_UPDATED, note="Invoice updated")

    @action(detail=False, methods=["get"])
    def summary(self, request):
        invoices = self.get_queryset()
        completed = Payment.Status.COMPLETED
        total_invoiced = invoices.exclude(status=Invoice.Status.VOID).aggregate(value=Sum("amount"))["value"] or Decimal("0")
        total_collected = Payment.objects.filter(invoice__in=invoices, status=completed).aggregate(value=Sum("amount"))["value"] or Decimal("0")
        overdue = invoices.filter(due_date__lt=timezone.localdate()).exclude(status__in=[Invoice.Status.PAID, Invoice.Status.VOID]).count()
        return Response({"total_invoiced": total_invoiced, "total_collected": total_collected, "outstanding": max(total_invoiced - total_collected, Decimal("0")), "overdue_count": overdue, "invoice_count": invoices.count()})

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        invoice = self.get_object()
        serializer = PaymentSerializer(data={**request.data, "invoice": invoice.pk})
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        if payment.status == Payment.Status.COMPLETED:
            sync_invoice_status(invoice)
        create_snapshot(invoice, FinanceSnapshot.EventType.PAYMENT_RECORDED, payment=payment, note="Payment recorded")
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice").all()
    serializer_class = PaymentSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["payment_reference", "invoice__invoice_number", "invoice__customer_name"]
    ordering_fields = ["payment_date", "amount", "created_at"]
    ordering = ["-payment_date", "-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        invoice_id = self.request.query_params.get("invoice")
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        return queryset

    def perform_create(self, serializer):
        payment = serializer.save()
        if payment.status == Payment.Status.COMPLETED:
            sync_invoice_status(payment.invoice)
        create_snapshot(payment.invoice, FinanceSnapshot.EventType.PAYMENT_RECORDED, payment=payment, note="Payment recorded")


class FinanceSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FinanceSnapshot.objects.select_related("invoice").all()
    serializer_class = FinanceSnapshotSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["invoice_number", "customer_name", "order_reference", "order_description", "payment_reference"]
    ordering_fields = ["event_at", "invoice_number", "status"]
    ordering = ["-event_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        invoice_id = self.request.query_params.get("invoice")
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        return queryset
