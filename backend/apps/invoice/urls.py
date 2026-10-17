from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.invoice.views import InvoiceViewSet

router = DefaultRouter()
router.register(r'', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('', include(router.urls)),
]
