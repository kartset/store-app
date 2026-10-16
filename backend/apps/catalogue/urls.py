from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CatalogueItemViewSet

router = DefaultRouter()
router.register(r'items', CatalogueItemViewSet, basename='catalogue-item')

urlpatterns = [
    path('', include(router.urls)),
]
