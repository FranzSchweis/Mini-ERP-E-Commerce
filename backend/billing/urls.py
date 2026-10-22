from rest_framework.routers import DefaultRouter

from .views import InvoiceViewSet, PaymentViewSet

router = DefaultRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", PaymentViewSet, basename="payment")
urlpatterns = router.urls
