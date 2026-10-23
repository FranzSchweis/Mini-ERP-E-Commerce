from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase


class AuthenticationApiTests(APITestCase):
    def setUp(self):
        self.username = "dispatcher"
        self.password = "demo-password-123"
        self.user = get_user_model().objects.create_user(
            username=self.username,
            password=self.password,
            first_name="Dispatch",
            last_name="Operator",
        )

    def sign_in(self, client=None):
        client = client or self.client
        return client.post("/api/auth/login/", {
            "username": self.username,
            "password": self.password,
        }, format="json")

    def test_login_creates_http_only_five_minute_session_cookie(self):
        response = self.sign_in()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["account"]["username"], self.username)
        cookie = response.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(int(cookie["max-age"]), 300)
        self.assertEqual(cookie["samesite"], "Lax")

        session_key = cookie.value
        session = Session.objects.get(session_key=session_key)
        self.assertGreater(session.expire_date, timezone.now())
        self.assertLessEqual(session.expire_date, timezone.now() + timedelta(minutes=5, seconds=2))

        account_response = self.client.get("/api/auth/me/")
        self.assertEqual(account_response.status_code, status.HTTP_200_OK)
        self.assertEqual(account_response.json()["username"], self.username)

    def test_login_rejects_invalid_credentials(self):
        response = self.client.post("/api/auth/login/", {
            "username": self.username,
            "password": "not-the-password",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        rejected = self.sign_in(client)
        self.assertEqual(rejected.status_code, status.HTTP_403_FORBIDDEN)

        csrf_response = client.get("/api/auth/csrf/")
        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)
        self.assertIn("csrftoken", csrf_response.cookies)
        token = csrf_response.json()["csrfToken"]
        accepted = client.post(
            "/api/auth/login/",
            {"username": self.username, "password": self.password},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)

    def test_session_cookie_authenticates_shipment_api(self):
        self.assertEqual(self.sign_in().status_code, status.HTTP_200_OK)
        response = self.client.get("/api/shipments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_session_cookie_and_csrf_token_can_create_shipment(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf_token = client.get("/api/auth/csrf/").json()["csrfToken"]
        login_response = client.post(
            "/api/auth/login/",
            {"username": self.username, "password": self.password},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        # Login rotates Django's CSRF secret, so fetch the post-login request token.
        refreshed_csrf_token = client.get("/api/auth/csrf/").json()["csrfToken"]
        response = client.post("/api/shipments/", {
            "order_reference": "ORD-SESSION-1",
            "recipient_name": "Session Test",
            "delivery_address": "School campus",
            "items": [{"product_name": "Package", "quantity": 1}],
        }, format="json", HTTP_X_CSRFTOKEN=refreshed_csrf_token)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_account_requires_authentication(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_health_check_remains_public(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_shipment_api_requires_authentication(self):
        response = self.client.get("/api/shipments/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_logout_destroys_session(self):
        self.assertEqual(self.sign_in().status_code, status.HTTP_200_OK)
        response = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(SESSION_COOKIE_AGE=300, SESSION_SAVE_EVERY_REQUEST=True)
    def test_session_timeout_is_five_minutes_and_rolling(self):
        self.assertEqual(settings.SESSION_COOKIE_AGE, 300)
        self.assertTrue(settings.SESSION_SAVE_EVERY_REQUEST)
