from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.invoice.views import CreditNoteViewSet

router = DefaultRouter()
router.register(r'', CreditNoteViewSet, basename='credit-note')

urlpatterns = [
    path('', include(router.urls)),
]
