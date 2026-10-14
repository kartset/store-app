from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BarcodeLookupView,
    BrandViewSet,
    CategoryViewSet,
    OrganizationCategoryViewSet,
    ProductViewSet,
    StoreCategoryViewSet,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'organization-categories', OrganizationCategoryViewSet, basename='organization-category')
router.register(r'store-categories', StoreCategoryViewSet, basename='store-category')
router.register(r'brands', BrandViewSet, basename='brand')
router.register(r'', ProductViewSet, basename='product')

urlpatterns = [
    path('barcode/<str:code_or_sku>/', BarcodeLookupView.as_view(), name='barcode-lookup'),
    path('', include(router.urls)),
]
