from django.core.validators import MinValueValidator
from django.db import models


class Shipment(models.Model):
    class Status(models.TextChoices):
        READY_TO_PACK = "ready_to_pack", "Ready to pack"
        PACKING = "packing", "Packing"
        READY_TO_DISPATCH = "ready_to_dispatch", "Ready to dispatch"
        IN_TRANSIT = "in_transit", "In transit"
        DELIVERED = "delivered", "Delivered"
        DELIVERY_FAILED = "delivery_failed", "Delivery failed"
        CANCELLED = "cancelled", "Cancelled"

    # External reference owned by the Sales/Orders system; intentionally not a local FK.
    order_reference = models.CharField(max_length=64, unique=True, db_index=True)
    recipient_name = models.CharField(max_length=180)
    delivery_address = models.TextField()
    carrier = models.CharField(max_length=120, blank=True)
    tracking_number = models.CharField(max_length=120, blank=True, db_index=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.READY_TO_PACK, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Shipment {self.pk or 'new'} · {self.order_reference}"


class ShipmentItem(models.Model):
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="items")
    product_reference = models.CharField(max_length=64, blank=True)
    product_name = models.CharField(max_length=180)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"


class ShipmentEvent(models.Model):
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=24, choices=Shipment.Status.choices)
    note = models.CharField(max_length=240, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]

    def __str__(self):
        return f"{self.shipment.order_reference}: {self.get_status_display()}"
