from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.invoice.views import CreditNoteViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r'credit-notes', CreditNoteViewSet, basename='credit-note')
router.register(r'', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('', include(router.urls)),
]
