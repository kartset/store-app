from django.urls import path

from .views import (
    CustomerBulkImportView,
    ProductBulkImportView,
    SampleTemplateDownloadView,
    UniversalExportView,
)

urlpatterns = [
    path('products/import/', ProductBulkImportView.as_view(), name='product-bulk-import'),
    path('customers/import/', CustomerBulkImportView.as_view(), name='customer-bulk-import'),
    path('templates/<str:template_type>/', SampleTemplateDownloadView.as_view(), name='sample-template-download'),
    path('export/<str:entity>/', UniversalExportView.as_view(), name='universal-data-export'),
]
