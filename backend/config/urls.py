from django.contrib import admin
from django.urls import include, path
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "mini-erp-api"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/", include("catalog.urls")),
    path("api/", include("billing.urls")),
]
