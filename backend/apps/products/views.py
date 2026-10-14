import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from db.models import (
    Brand,
    Category,
    Organization,
    OrganizationCategory,
    Product,
    Store,
    StoreCategory,
)

from .serializers import (
    BrandSerializer,
    CategorySerializer,
    CategoryTreeSerializer,
    OrganizationCategorySerializer,
    ProductSerializer,
    StoreCategorySerializer,
)

logger = logging.getLogger(__name__)


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and managing the Global Platform Category Taxonomy.
    """
    queryset = Category.objects.filter(is_deleted=False).order_by('display_order', 'name')
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        parent_param = self.request.query_params.get('parent')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')

        if parent_param is not None:
            if parent_param.lower() in ('null', 'none', ''):
                qs = qs.filter(parent_id__isnull=True)
            else:
                qs = qs.filter(parent_id_id=parent_param)

        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))

        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(slug__icontains=search))

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request):
        """
        Returns full hierarchical category tree starting from root categories.
        """
        roots = Category.objects.filter(parent_id__isnull=True, is_deleted=False)
        is_active = request.query_params.get('is_active')
        if is_active is not None:
            roots = roots.filter(is_active=is_active.lower() in ('true', '1'))
        roots = roots.order_by('display_order', 'name')
        serializer = CategoryTreeSerializer(roots, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrganizationCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Organization category adoption.
    """
    queryset = OrganizationCategory.objects.filter(is_deleted=False).select_related('category_id', 'organization_id')
    serializer_class = OrganizationCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            qs = qs.filter(organization_id_id=org_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='bulk-adopt')
    def bulk_adopt(self, request):
        """
        Bulk adopts a list of categories for an organization.
        Payload: {"organization_id": "uuid", "category_ids": ["uuid1", "uuid2"]}
        """
        org_id = request.data.get('organization_id')
        category_ids = request.data.get('category_ids', [])

        if not org_id:
            return Response({'error': 'organization_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(category_ids, list):
            return Response({'error': 'category_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org = Organization.objects.get(id=org_id, is_deleted=False)
        except (Organization.DoesNotExist, DjangoValidationError, ValueError):
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            adopted = []
            for cat_id in category_ids:
                try:
                    category = Category.objects.get(id=cat_id, is_deleted=False)
                    oc, _ = OrganizationCategory.objects.get_or_create(
                        organization_id=org,
                        category_id=category,
                        defaults={'created_by': request.user, 'is_active': True}
                    )
                    if oc.is_deleted:
                        oc.restore()
                    adopted.append(oc)
                except (Category.DoesNotExist, DjangoValidationError, ValueError) as exc:
                    logger.warning("Skipping invalid category '%s' during adoption: %s", cat_id, exc)
                    continue

        serializer = self.get_serializer(adopted, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StoreCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Store <> Category Mappings.
    """
    queryset = StoreCategory.objects.filter(is_deleted=False).select_related('category_id', 'store_id')
    serializer_class = StoreCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id_id=store_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='bulk-map')
    def bulk_map(self, request):
        """
        Bulk maps a list of categories to a store.
        Payload: {"store_id": "uuid", "category_ids": ["uuid1", "uuid2"]}
        """
        store_id = request.data.get('store_id')
        category_ids = request.data.get('category_ids', [])

        if not store_id:
            return Response({'error': 'store_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(category_ids, list):
            return Response({'error': 'category_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            store = Store.objects.get(id=store_id, is_deleted=False)
        except (Store.DoesNotExist, DjangoValidationError, ValueError):
            return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            mapped = []
            for cat_id in category_ids:
                try:
                    category = Category.objects.get(id=cat_id, is_deleted=False)
                    sc, _ = StoreCategory.objects.get_or_create(
                        store_id=store,
                        category_id=category,
                        defaults={'created_by': request.user, 'is_active': True}
                    )
                    if sc.is_deleted:
                        sc.restore()
                    mapped.append(sc)
                except (Category.DoesNotExist, DjangoValidationError, ValueError) as exc:
                    logger.warning("Skipping invalid category '%s' during store mapping: %s", cat_id, exc)
                    continue

        serializer = self.get_serializer(mapped, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BrandViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Organization Brands.
    """
    queryset = Brand.objects.filter(is_deleted=False).order_by('name')
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        search = self.request.query_params.get('search')

        if org_id:
            qs = qs.filter(organization_id_id=org_id)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Master Catalog Products.
    Supports filtering by organization, category, brand, active status, and live search.
    """
    queryset = Product.objects.filter(is_deleted=False).select_related('category_id', 'brand_id', 'organization_id').order_by('name')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        category_id = self.request.query_params.get('category_id')
        brand_id = self.request.query_params.get('brand_id')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')

        if org_id:
            qs = qs.filter(organization_id_id=org_id)
        if category_id:
            qs = qs.filter(category_id_id=category_id)
        if brand_id:
            qs = qs.filter(brand_id_id=brand_id)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(sku__icontains=search) |
                Q(barcode__icontains=search) |
                Q(internal_barcode__icontains=search) |
                Q(hsn_code__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)


class BarcodeLookupView(APIView):
    """
    High-speed resolution endpoint for POS barcode scanners.
    Resolves a scanned code against:
    1. Global manufacturer barcode (EAN-13, UPC)
    2. In-store generated internal barcode sticker
    3. Item SKU
    Endpoint: GET /api/products/barcode/<code_or_sku>/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, code_or_sku):
        org_id = request.query_params.get('organization_id')
        code = code_or_sku.strip()

        qs = Product.objects.filter(is_deleted=False).select_related('category_id', 'brand_id', 'organization_id')
        if org_id:
            qs = qs.filter(organization_id_id=org_id)

        product = qs.filter(
            Q(barcode__iexact=code) | Q(internal_barcode__iexact=code) | Q(sku__iexact=code)
        ).first()

        if not product:
            return Response(
                {'detail': f"Product not found for barcode or SKU: '{code}'"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ProductSerializer(product)
        return Response(serializer.data, status=status.HTTP_200_OK)
