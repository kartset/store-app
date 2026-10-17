from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ExportGSTNJSONView,
    GSTFilingPeriodViewSet,
    GSTR1SummaryView,
    GSTR3BSummaryView,
    HSNSummaryView,
)

router = DefaultRouter()
router.register(r'filing-periods', GSTFilingPeriodViewSet, basename='gst-filing-period')

urlpatterns = [
    path('gstr1-summary/', GSTR1SummaryView.as_view(), name='gstr1-summary'),
    path('gstr3b-summary/', GSTR3BSummaryView.as_view(), name='gstr3b-summary'),
    path('hsn-summary/', HSNSummaryView.as_view(), name='hsn-summary'),
    path('export-gstn-json/', ExportGSTNJSONView.as_view(), name='export-gstn-json'),
    path('', include(router.urls)),
]
