from rest_framework.routers import DefaultRouter

from .views import FinanceSnapshotViewSet, InvoiceViewSet, PaymentViewSet

router = DefaultRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", PaymentViewSet, basename="payment")
router.register("snapshots", FinanceSnapshotViewSet, basename="snapshot")
urlpatterns = router.urls
