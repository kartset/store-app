from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import InventoryViewSet, StockMovementViewSet

router = DefaultRouter()
router.register(r'movements', StockMovementViewSet, basename='stock-movement')
router.register(r'', InventoryViewSet, basename='inventory')

urlpatterns = [
    path('', include(router.urls)),
]
