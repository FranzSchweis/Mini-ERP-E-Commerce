from rest_framework.test import APITestCase
from rest_framework import status

from .models import Shipment, ShipmentEvent


class ShipmentApiTests(APITestCase):
    def create_shipment(self):
        return self.client.post("/api/shipments/", {
            "order_reference": "ORD-TEST-1",
            "recipient_name": "Demo Recipient",
            "delivery_address": "School campus",
            "carrier": "Campus Courier",
            "items": [{"product_reference": "PRD-001", "product_name": "Notebook", "quantity": 2}],
        }, format="json")

    def test_create_shipment_records_initial_event(self):
        response = self.create_shipment()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        shipment = Shipment.objects.get(order_reference="ORD-TEST-1")
        self.assertEqual(shipment.status, Shipment.Status.READY_TO_PACK)
        self.assertEqual(shipment.items.count(), 1)
        self.assertEqual(shipment.events.count(), 1)

    def test_create_shipment_accepts_multiple_items(self):
        response = self.client.post("/api/shipments/", {
            "order_reference": "ORD-TEST-2",
            "recipient_name": "Demo Recipient",
            "delivery_address": "School campus",
            "items": [
                {"product_reference": "PRD-001", "product_name": "Notebook", "quantity": 2},
                {"product_reference": "PRD-002", "product_name": "Pen", "quantity": 3},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["items"]), 2)

    def test_status_transition_records_event(self):
        created = self.create_shipment()
        shipment_id = created.data["id"]
        response = self.client.post(f"/api/shipments/{shipment_id}/status/", {"status": "packing", "note": "Items checked"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Shipment.Status.PACKING)
        self.assertEqual(ShipmentEvent.objects.filter(shipment_id=shipment_id).count(), 2)
        self.assertEqual(ShipmentEvent.objects.filter(shipment_id=shipment_id).latest("occurred_at").note, "Items checked")

    def test_delivery_failure_requires_and_saves_a_note(self):
        created = self.create_shipment()
        shipment_id = created.data["id"]
        for next_status in ["packing", "ready_to_dispatch", "in_transit"]:
            response = self.client.post(f"/api/shipments/{shipment_id}/status/", {"status": next_status}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        failed_without_note = self.client.post(f"/api/shipments/{shipment_id}/status/", {"status": "delivery_failed"}, format="json")
        self.assertEqual(failed_without_note.status_code, status.HTTP_400_BAD_REQUEST)
        failed_with_note = self.client.post(f"/api/shipments/{shipment_id}/status/", {
            "status": "delivery_failed", "note": "Recipient was unavailable"
        }, format="json")
        self.assertEqual(failed_with_note.status_code, status.HTTP_200_OK)
        self.assertEqual(ShipmentEvent.objects.filter(shipment_id=shipment_id).latest("occurred_at").note, "Recipient was unavailable")

    def test_invalid_status_transition_is_rejected(self):
        created = self.create_shipment()
        shipment_id = created.data["id"]
        response = self.client.post(f"/api/shipments/{shipment_id}/status/", {"status": "delivered"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Shipment.objects.get(pk=shipment_id).status, Shipment.Status.READY_TO_PACK)

    def test_status_update_for_missing_shipment_returns_404(self):
        response = self.client.post("/api/shipments/999/status/", {"status": "packing"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_logistics_endpoint_updates_carrier_and_tracking_number(self):
        created = self.create_shipment()
        shipment_id = created.data["id"]
        response = self.client.patch(f"/api/shipments/{shipment_id}/logistics/", {
            "carrier": "Updated Courier", "tracking_number": "TRACK-2026"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["carrier"], "Updated Courier")
        self.assertEqual(response.data["tracking_number"], "TRACK-2026")
        self.assertEqual(response.data["status"], Shipment.Status.READY_TO_PACK)

    def test_logistics_endpoint_does_not_allow_editing_status(self):
        created = self.create_shipment()
        shipment_id = created.data["id"]
        response = self.client.patch(f"/api/shipments/{shipment_id}/logistics/", {
            "status": "delivered"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Shipment.objects.get(pk=shipment_id).status, Shipment.Status.READY_TO_PACK)

    def test_generic_shipment_patch_is_not_allowed(self):
        created = self.create_shipment()
        shipment_id = created.data["id"]
        response = self.client.patch(f"/api/shipments/{shipment_id}/", {"carrier": "Courier"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
