from rest_framework.routers import DefaultRouter

from .views import ShipmentViewSet

router = DefaultRouter()
router.register("", ShipmentViewSet, basename="shipment")
urlpatterns = router.urls
