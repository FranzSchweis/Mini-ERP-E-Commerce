from django.urls import path

from .views import IntegrationShipmentDetailView, IntegrationShipmentListCreateView, SalesOrderLookupView


urlpatterns = [
    path("sales-orders/<str:order_number>/", SalesOrderLookupView.as_view(), name="integration-sales-order"),
    path("shipments/", IntegrationShipmentListCreateView.as_view(), name="integration-shipment-ingest"),
    path("shipments/<str:order_reference>/", IntegrationShipmentDetailView.as_view(), name="integration-shipment-detail"),
]
