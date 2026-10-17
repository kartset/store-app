from rest_framework.routers import DefaultRouter
from .views import CashRegisterSessionViewSet

router = DefaultRouter()
router.register(r'', CashRegisterSessionViewSet, basename='register')

urlpatterns = router.urls
