import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app import create_app


class ApiSmokeTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["service"], "inventory")

    def test_shared_routes_are_registered(self):
        routes = {rule.rule for rule in self.app.url_map.iter_rules()}
        self.assertIn("/api/inventory/purchase-orders/<int:po_id>/receive", routes)
        self.assertIn("/api/inventory/low-stock", routes)


if __name__ == "__main__":
    unittest.main()
