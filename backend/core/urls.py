"""
URL configuration for store_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.user.urls")),
    path("api/organizations/", include("apps.organisation.urls")),
    path("api/stores/", include("apps.store.urls")),
    path("api/products/", include("apps.products.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/catalogue/", include("apps.catalogue.urls")),
    path("api/vendors/", include("apps.vendor.urls")),
    path("api/customers/", include("apps.customer.urls")),
    path("api/invoices/", include("apps.invoice.urls")),
    path("api/credit-notes/", include("apps.invoice.credit_note_urls")),
    path("api/registers/", include("apps.register.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/orders/", include("apps.orders.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/data-exchange/", include("apps.data_exchange.urls")),
]


