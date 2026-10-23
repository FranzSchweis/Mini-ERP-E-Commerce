from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Shipment, ShipmentEvent
from .serializers import ShipmentSerializer


ALLOWED_TRANSITIONS = {
    Shipment.Status.READY_TO_PACK: {Shipment.Status.PACKING, Shipment.Status.CANCELLED},
    Shipment.Status.PACKING: {Shipment.Status.READY_TO_DISPATCH, Shipment.Status.CANCELLED},
    Shipment.Status.READY_TO_DISPATCH: {Shipment.Status.IN_TRANSIT, Shipment.Status.CANCELLED},
    Shipment.Status.IN_TRANSIT: {Shipment.Status.DELIVERED, Shipment.Status.DELIVERY_FAILED},
    Shipment.Status.DELIVERY_FAILED: {Shipment.Status.IN_TRANSIT, Shipment.Status.CANCELLED},
    Shipment.Status.DELIVERED: set(),
    Shipment.Status.CANCELLED: set(),
}


class ShipmentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ShipmentViewSet(viewsets.ModelViewSet):
    serializer_class = ShipmentSerializer
    queryset = Shipment.objects.all()
    pagination_class = ShipmentPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Shipment.objects.prefetch_related("items", "events")
        status_filter = self.request.query_params.get("status")
        search = self.request.query_params.get("search", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(order_reference__icontains=search)
                | Q(recipient_name__icontains=search)
                | Q(tracking_number__icontains=search)
                | Q(carrier__icontains=search)
            )
        return queryset

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed("PATCH")

    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, pk=None):
        requested_status = request.data.get("status")
        valid_statuses = {value for value, _label in Shipment.Status.choices}
        if requested_status not in valid_statuses:
            raise ValidationError({"status": "Choose a valid shipment status."})
        note = request.data.get("note", "")
        if note is None:
            note = ""
        if not isinstance(note, str):
            raise ValidationError({"note": "Enter a text note."})
        note = note.strip()
        if len(note) > 240:
            raise ValidationError({"note": "Notes must be 240 characters or fewer."})
        if requested_status == Shipment.Status.DELIVERY_FAILED and not note:
            raise ValidationError({"note": "Add a reason for the failed delivery."})

        with transaction.atomic():
            shipment = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            self.check_object_permissions(request, shipment)
            allowed = ALLOWED_TRANSITIONS[shipment.status]
            if requested_status not in allowed:
                raise ValidationError({
                    "status": f"Cannot move from {shipment.get_status_display()} to "
                    f"{dict(Shipment.Status.choices).get(requested_status, requested_status)}."
                })
            shipment.status = requested_status
            shipment.save(update_fields=["status", "updated_at"])
            ShipmentEvent.objects.create(
                shipment=shipment,
                status=requested_status,
                note=note,
            )
        shipment = self.get_queryset().get(pk=shipment.pk)
        return Response(self.get_serializer(shipment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="logistics")
    def update_logistics(self, request, pk=None):
        allowed_fields = {"carrier": 120, "tracking_number": 120}
        unexpected = set(request.data.keys()) - set(allowed_fields)
        if unexpected:
            raise ValidationError({field: "This field cannot be edited here." for field in sorted(unexpected)})
        if not request.data:
            raise ValidationError({"detail": "Provide a carrier and/or tracking number to update."})

        updates = {}
        for field, max_length in allowed_fields.items():
            if field not in request.data:
                continue
            value = request.data[field]
            if not isinstance(value, str):
                raise ValidationError({field: "Enter a text value."})
            value = value.strip()
            if len(value) > max_length:
                raise ValidationError({field: f"Use at most {max_length} characters."})
            updates[field] = value

        with transaction.atomic():
            shipment = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            self.check_object_permissions(request, shipment)
            for field, value in updates.items():
                setattr(shipment, field, value)
            shipment.save(update_fields=[*updates.keys(), "updated_at"])

        shipment = self.get_queryset().get(pk=shipment.pk)
        return Response(self.get_serializer(shipment).data, status=status.HTTP_200_OK)
