import logging
import uuid
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.products.serializers import ProductSerializer
from db.models import (
    CatalogueItem,
    Inventory,
    OrganizationStaff,
    Product,
    StockMovementType,
)

from .serializers import (
    BulkAdoptSerializer,
    CatalogueItemAdoptSerializer,
    CatalogueItemSerializer,
)

logger = logging.getLogger(__name__)


class CatalogueItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for the Global Product Register (Tier 1 Catalogue).
    Provides centralized product master discovery, barcode lookup,
    and 1-click adoption/forking into Organization Product Masters.
    """
    queryset = CatalogueItem.objects.filter(is_deleted=False)
    serializer_class = CatalogueItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()

        # Search filter (name, sku, barcode, brand_name, category_name, hsn_code)
        search_query = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search_query:
            term = search_query.strip()
            qs = qs.filter(
                Q(name__icontains=term) |
                Q(sku__icontains=term) |
                Q(barcode__icontains=term) |
                Q(brand_name__icontains=term) |
                Q(category_name__icontains=term) |
                Q(hsn_code__icontains=term)
            )

        # Barcode filter
        barcode = self.request.query_params.get('barcode')
        if barcode:
            qs = qs.filter(barcode=barcode.strip())

        # Tax slab filter
        tax_slab = self.request.query_params.get('tax_slab')
        if tax_slab:
            qs = qs.filter(tax_slab=tax_slab)

        # Unit of measure filter
        uom = self.request.query_params.get('uom')
        if uom:
            qs = qs.filter(uom=uom)

        # Active status filter
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            active_bool = is_active.lower() in ['true', '1']
            qs = qs.filter(is_active=active_bool)

        return qs.order_by('name')

    def check_org_admin_permission(self, user, organization):
        """Validates that user has admin/merchandiser rights in the organization."""
        if getattr(user, 'is_superuser', False):
            return True
        return OrganizationStaff.objects.filter(
            user_id=user,
            organization_id=organization,
            role__in=['ORG_ADMIN', 'CATALOG_MANAGER'],
            is_active=True,
            is_deleted=False
        ).exists()

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request):
        """
        Fast lookup endpoint for barcode scanners and POS terminals.
        Query params:
          ?barcode=<universal_barcode>
          or ?sku=<canonical_sku>
        """
        barcode = request.query_params.get('barcode')
        sku = request.query_params.get('sku')

        if not barcode and not sku:
            return Response(
                {"detail": "Please provide a 'barcode' or 'sku' query parameter."},
                status=status.HTTP_400_BAD_REQUEST
            )

        query = Q()
        if barcode:
            query |= Q(barcode=barcode.strip())
        if sku:
            query |= Q(sku=sku.strip())

        item = CatalogueItem.objects.filter(is_deleted=False).filter(query).first()
        if not item:
            return Response(
                {"detail": "No catalogue item found matching the provided code."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='adopt')
    def adopt(self, request, pk=None):
        """
        Forks a Global Catalogue Item into an Organization's Product Master (Tier 1 -> Tier 2).
        Pre-populates name, universal barcode, HSN code, tax slab, and UOM, while allowing
        the organization to set cost price, selling price, categories, and custom SKU.
        """
        catalogue_item = self.get_object()
        serializer = CatalogueItemAdoptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        org = data['organization_id']

        # Permission check
        if not self.check_org_admin_permission(request.user, org):
            return Response(
                {"detail": "You do not have permission to adopt products into this organization."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if already adopted
        existing_product = Product.objects.filter(
            organization_id=org,
            catalogue_item_id=catalogue_item,
            is_deleted=False
        ).first()

        if existing_product:
            return Response(
                {
                    "detail": f"Item '{catalogue_item.name}' has already been adopted into this organization.",
                    "product_id": str(existing_product.id),
                    "product": ProductSerializer(existing_product).data
                },
                status=status.HTTP_409_CONFLICT
            )

        # Determine SKU
        sku = data.get('sku') or catalogue_item.sku
        # Ensure SKU uniqueness within org
        if Product.objects.filter(organization_id=org, sku=sku, is_deleted=False).exists():
            sku = f"{sku}-{str(uuid.uuid4())[:4].upper()}"

        # Determine Barcode uniqueness within org
        barcode = catalogue_item.barcode
        if barcode and Product.objects.filter(organization_id=org, barcode=barcode, is_deleted=False).exists():
            # If the barcode is already registered under this org on another product, clear it to prevent conflict
            barcode = None

        cost_price = data.get('cost_price', Decimal('0.00'))
        base_mrp = data.get('base_mrp')
        if base_mrp is None:
            base_mrp = catalogue_item.suggested_mrp if catalogue_item.suggested_mrp is not None else Decimal('0.00')

        tax_slab = data.get('tax_slab') or catalogue_item.tax_slab
        uom = data.get('uom') or catalogue_item.uom

        with transaction.atomic():
            product = Product.objects.create(
                organization_id=org,
                catalogue_item_id=catalogue_item,
                name=catalogue_item.name,
                sku=sku,
                barcode=barcode,
                internal_barcode=data.get('internal_barcode') or None,
                hsn_code=catalogue_item.hsn_code,
                tax_slab=tax_slab,
                cost_price=cost_price,
                base_mrp=base_mrp,
                uom=uom,
                category_id=data.get('category_id'),
                subcategory_id=data.get('subcategory_id'),
                brand_id=data.get('brand_id'),
                description=catalogue_item.description,
                low_stock_threshold=data.get('low_stock_threshold', 10),
                is_perishable=data.get('is_perishable', False),
                has_expiry=data.get('has_expiry', False),
                is_returnable=data.get('is_returnable', True),
                created_by=request.user if request.user.is_authenticated else None,
            )

            # Optional immediate placement in Store Inventory (Tier 3)
            store = data.get('store_id')
            if store:
                initial_stock = data.get('initial_stock', 0)
                store_price = data.get('store_price')
                inventory = Inventory.objects.create(
                    store_id=store,
                    product_id=product,
                    stock_quantity=0,
                    store_price=store_price,
                    low_stock_threshold=product.low_stock_threshold,
                    created_by=request.user if request.user.is_authenticated else None,
                )
                if initial_stock > 0:
                    inventory.adjust_stock(
                        quantity_delta=initial_stock,
                        movement_type=StockMovementType.INITIAL_STOCK,
                        reason="Opening stock balance created at global catalogue adoption",
                        user=request.user if request.user.is_authenticated else None,
                    )

        return Response(
            {
                "message": f"Successfully adopted '{catalogue_item.name}' into organization.",
                "product": ProductSerializer(product).data
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['post'], url_path='bulk_adopt')
    def bulk_adopt(self, request):
        """
        Adopts multiple Global Catalogue Items into an organization in a single batch.
        """
        serializer = BulkAdoptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        org = data['organization_id']
        item_ids = data['catalogue_item_ids']
        category = data.get('category_id')
        store = data.get('store_id')

        # Permission check
        if not self.check_org_admin_permission(request.user, org):
            return Response(
                {"detail": "You do not have permission to adopt products into this organization."},
                status=status.HTTP_403_FORBIDDEN
            )

        items = CatalogueItem.objects.filter(id__in=item_ids, is_deleted=False)
        adopted_products = []
        skipped_names = []

        with transaction.atomic():
            for item in items:
                # Check if already adopted
                if Product.objects.filter(organization_id=org, catalogue_item_id=item, is_deleted=False).exists():
                    skipped_names.append(f"{item.name} (already adopted)")
                    continue

                sku = item.sku
                if Product.objects.filter(organization_id=org, sku=sku, is_deleted=False).exists():
                    sku = f"{sku}-{str(uuid.uuid4())[:4].upper()}"

                barcode = item.barcode
                if barcode and Product.objects.filter(organization_id=org, barcode=barcode, is_deleted=False).exists():
                    barcode = None

                base_mrp = item.suggested_mrp if item.suggested_mrp is not None else Decimal('0.00')

                product = Product.objects.create(
                    organization_id=org,
                    catalogue_item_id=item,
                    name=item.name,
                    sku=sku,
                    barcode=barcode,
                    hsn_code=item.hsn_code,
                    tax_slab=item.tax_slab,
                    cost_price=Decimal('0.00'),
                    base_mrp=base_mrp,
                    uom=item.uom,
                    category_id=category,
                    description=item.description,
                    low_stock_threshold=10,
                    created_by=request.user if request.user.is_authenticated else None,
                )

                if store:
                    Inventory.objects.create(
                        store_id=store,
                        product_id=product,
                        stock_quantity=0,
                        low_stock_threshold=product.low_stock_threshold,
                        created_by=request.user if request.user.is_authenticated else None,
                    )

                adopted_products.append(product)

        return Response(
            {
                "message": f"Bulk adoption complete. {len(adopted_products)} items adopted, {len(skipped_names)} skipped.",
                "adopted_count": len(adopted_products),
                "skipped_count": len(skipped_names),
                "skipped": skipped_names,
                "products": ProductSerializer(adopted_products, many=True).data
            },
            status=status.HTTP_201_CREATED if adopted_products else status.HTTP_200_OK
        )
