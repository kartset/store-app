from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import VendorProductViewSet, VendorViewSet

router = DefaultRouter()
router.register(r'products', VendorProductViewSet, basename='vendor-product')
router.register(r'', VendorViewSet, basename='vendor')

urlpatterns = [
    path('', include(router.urls)),
]
