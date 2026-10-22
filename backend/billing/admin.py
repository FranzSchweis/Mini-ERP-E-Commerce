from django.contrib import admin

from .models import Invoice, Payment


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "customer_name", "amount", "status", "due_date")
    list_filter = ("status", "issue_date", "due_date")
    search_fields = ("invoice_number", "customer_name", "order_reference")
    inlines = [PaymentInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("payment_reference", "invoice", "amount", "method", "status", "payment_date")
    list_filter = ("method", "status", "payment_date")
    search_fields = ("payment_reference", "invoice__invoice_number")
