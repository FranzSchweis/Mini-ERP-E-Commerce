import hmac

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class IntegrationPrincipal:
    """A lightweight authenticated identity for a trusted integration client."""

    is_authenticated = True
    is_anonymous = False
    is_active = True
    is_staff = False
    username = "erp-integration"


class IntegrationKeyAuthentication(BaseAuthentication):
    header_name = "X-ERP-Integration-Key"

    def authenticate(self, request):
        configured_key = getattr(settings, "ERP_INTEGRATION_API_KEY", "")
        supplied_key = request.headers.get(self.header_name, "")
        if not configured_key or not supplied_key:
            return None
        if not hmac.compare_digest(supplied_key, configured_key):
            raise AuthenticationFailed("Invalid ERP integration key.")
        return IntegrationPrincipal(), "integration-key"

    def authenticate_header(self, request):
        return self.header_name
