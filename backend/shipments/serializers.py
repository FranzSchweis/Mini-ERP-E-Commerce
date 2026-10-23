from django.db import transaction
from rest_framework import serializers

from .models import Shipment, ShipmentEvent, ShipmentItem


class ShipmentItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipmentItem
        fields = ["id", "product_reference", "product_name", "quantity"]
        read_only_fields = ["id"]


class ShipmentEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ShipmentEvent
        fields = ["id", "status", "status_label", "note", "occurred_at"]
        read_only_fields = fields


class ShipmentSerializer(serializers.ModelSerializer):
    items = ShipmentItemSerializer(many=True)
    events = ShipmentEventSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Shipment
        fields = [
            "id", "order_reference", "recipient_name", "delivery_address",
            "carrier", "tracking_number", "status", "status_label",
            "items", "events", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "status_label", "events", "created_at", "updated_at"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one shipment item.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        shipment = Shipment.objects.create(**validated_data)
        ShipmentItem.objects.bulk_create([
            ShipmentItem(shipment=shipment, **item_data) for item_data in items_data
        ])
        ShipmentEvent.objects.create(
            shipment=shipment,
            status=shipment.status,
            note="Shipment created",
        )
        return shipment
