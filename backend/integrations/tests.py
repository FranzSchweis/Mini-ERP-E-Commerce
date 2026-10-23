from unittest.mock import patch

from django.db import OperationalError
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from shipments.models import Shipment


@override_settings(ERP_INTEGRATION_API_KEY="integration-test-key")
class IntegrationApiTests(APITestCase):
    def setUp(self):
        self.client.credentials(HTTP_X_ERP_INTEGRATION_KEY="integration-test-key")

    def test_sales_order_lookup_returns_normalized_data(self):
        source_order = {
            "source_system": "sales",
            "source_order_id": 22,
            "source_customer_id": 9,
            "source_customer_code": "CUS-009",
            "order_reference": "SO-10022",
            "source_status": "confirmed",
            "ordered_at": "2026-10-24T09:30:00+08:00",
            "recipient_name": "Sample Customer",
            "delivery_address": "Campus address",
            "items": [{
                "source_line_id": 101,
                "source_product_id": 12,
                "product_reference": "SKU-012",
                "product_name": "Sample product",
                "quantity": 2,
            }],
        }
        with patch("integrations.views.fetch_sales_order", return_value=source_order):
            response = self.client.get("/api/integrations/sales-orders/SO-10022/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["order_reference"], "SO-10022")
        self.assertEqual(response.data["items"][0]["product_reference"], "SKU-012")

    def test_sales_lookup_reports_missing_source_tables_as_unavailable(self):
        with patch("integrations.views.fetch_sales_order", side_effect=OperationalError("source not ready")):
            response = self.client.get("/api/integrations/sales-orders/SO-10022/")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_sales_lookup_returns_not_found_for_unknown_order(self):
        with patch("integrations.views.fetch_sales_order", return_value=None):
            response = self.client.get("/api/integrations/sales-orders/SO-MISSING/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_integration_key_is_rejected(self):
        self.client.credentials(HTTP_X_ERP_INTEGRATION_KEY="wrong-key")
        response = self.client.get("/api/integrations/sales-orders/SO-10022/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_external_shipment_ingestion_is_idempotent(self):
        payload = {
            "order_reference": "SO-INGEST-1",
            "recipient_name": "Sample Customer",
            "delivery_address": "Campus address",
            "items": [{"product_reference": "SKU-012", "product_name": "Sample product", "quantity": 2}],
        }
        first = self.client.post("/api/integrations/shipments/", payload, format="json")
        second = self.client.post("/api/integrations/shipments/", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Shipment.objects.filter(order_reference="SO-INGEST-1").count(), 1)
        self.assertEqual(second.data["id"], first.data["id"])

    def test_external_system_can_read_shipment_status(self):
        self.client.post("/api/integrations/shipments/", {
            "order_reference": "SO-STATUS-1",
            "recipient_name": "Sample Customer",
            "delivery_address": "Campus address",
            "items": [{"product_reference": "SKU-012", "product_name": "Sample product", "quantity": 1}],
        }, format="json")
        response = self.client.get("/api/integrations/shipments/SO-STATUS-1/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Shipment.Status.READY_TO_PACK)
        self.assertEqual(len(response.data["events"]), 1)

    def test_integration_routes_require_session_or_configured_key(self):
        self.client.credentials()
        response = self.client.get("/api/integrations/sales-orders/SO-10022/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
