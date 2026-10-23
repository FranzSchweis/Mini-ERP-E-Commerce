from django.contrib import admin

from .models import Shipment, ShipmentEvent, ShipmentItem


class ShipmentItemInline(admin.TabularInline):
    model = ShipmentItem
    extra = 0


class ShipmentEventInline(admin.TabularInline):
    model = ShipmentEvent
    extra = 0
    readonly_fields = ["status", "note", "occurred_at"]
    can_delete = False


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ["id", "order_reference", "recipient_name", "carrier", "status", "updated_at"]
    list_filter = ["status", "carrier"]
    search_fields = ["order_reference", "recipient_name", "tracking_number"]
    inlines = [ShipmentItemInline, ShipmentEventInline]
