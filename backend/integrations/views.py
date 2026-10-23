import logging

from django.db import DatabaseError, IntegrityError, transaction
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from shipments.models import Shipment
from shipments.serializers import ShipmentSerializer

from .authentication import IntegrationKeyAuthentication
from .order_source import fetch_sales_order


logger = logging.getLogger(__name__)


class IntegrationSourceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The Sales order tables are not available in the configured database."
    default_code = "sales_source_unavailable"


class IntegrationAPIView(APIView):
    authentication_classes = [IntegrationKeyAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]


class SalesOrderLookupView(IntegrationAPIView):
    def get(self, request, order_number):
        try:
            order = fetch_sales_order(order_number)
        except DatabaseError:
            logger.warning("Shared Sales order source is unavailable; confirm its tables exist in the configured database.")
            raise IntegrationSourceUnavailable()
        if order is None:
            raise NotFound("Sales order was not found.")
        return Response(order)


class IntegrationShipmentListCreateView(IntegrationAPIView):
    def post(self, request):
        order_reference = request.data.get("order_reference")
        if isinstance(order_reference, str) and order_reference:
            existing = Shipment.objects.filter(order_reference=order_reference).first()
            if existing:
                return Response(ShipmentSerializer(existing).data, status=status.HTTP_200_OK)

        serializer = ShipmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order_reference = serializer.validated_data["order_reference"]

        try:
            with transaction.atomic():
                existing = Shipment.objects.select_for_update().filter(order_reference=order_reference).first()
                if existing:
                    return Response(ShipmentSerializer(existing).data, status=status.HTTP_200_OK)
                shipment = serializer.save()
        except IntegrityError:
            # A concurrent retry may win the unique order_reference insert.
            existing = Shipment.objects.filter(order_reference=order_reference).first()
            if existing is None:
                raise
            return Response(ShipmentSerializer(existing).data, status=status.HTTP_200_OK)

        return Response(ShipmentSerializer(shipment).data, status=status.HTTP_201_CREATED)


class IntegrationShipmentDetailView(IntegrationAPIView):
    def get(self, request, order_reference):
        try:
            shipment = Shipment.objects.prefetch_related("items", "events").get(
                order_reference=order_reference
            )
        except Shipment.DoesNotExist:
            raise NotFound("Shipment was not found.")
        return Response(ShipmentSerializer(shipment).data)
