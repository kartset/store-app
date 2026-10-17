from django.urls import path

from apps.analytics.views import (
    AnalyticsOverviewView,
    CategoryBreakdownAnalyticsView,
    HourlyFootfallAnalyticsView,
    InventoryHealthAnalyticsView,
    PaymentMethodsAnalyticsView,
    SalesTrendAnalyticsView,
    TopProductsAnalyticsView,
)

urlpatterns = [
    path('overview/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('sales-trend/', SalesTrendAnalyticsView.as_view(), name='analytics-sales-trend'),
    path('top-products/', TopProductsAnalyticsView.as_view(), name='analytics-top-products'),
    path('category-breakdown/', CategoryBreakdownAnalyticsView.as_view(), name='analytics-category-breakdown'),
    path('hourly-footfall/', HourlyFootfallAnalyticsView.as_view(), name='analytics-hourly-footfall'),
    path('payment-methods/', PaymentMethodsAnalyticsView.as_view(), name='analytics-payment-methods'),
    path('inventory-health/', InventoryHealthAnalyticsView.as_view(), name='analytics-inventory-health'),
]
