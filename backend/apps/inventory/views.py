import logging
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import F, Q, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from db.models import (
    Inventory,
    Product,
    StockMovement,
    StockMovementType,
    Store,
    Vendor,
    VendorProduct,
)

from .serializers import (
    InventorySerializer,
    InventorySummarySerializer,
    ReceiveGoodsRequestSerializer,
    StockAdjustmentRequestSerializer,
    StockMovementSerializer,
)

logger = logging.getLogger(__name__)


class InventoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Store Inventory management.
    Supports filtering by store, low-stock threshold alerts, live search,
    direct stock adjustments, and bulk Goods Receipt Note (GRN) inwarding.
    """
    queryset = (
        Inventory.objects.filter(is_deleted=False)
        .select_related('store_id', 'product_id', 'vendor_id', 'product_id__category_id', 'product_id__brand_id')
        .order_by('product_id__name')
    )
    serializer_class = InventorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store_id')
        product_id = self.request.query_params.get('product_id')
        is_low_stock = self.request.query_params.get('is_low_stock')
        is_out_of_stock = self.request.query_params.get('is_out_of_stock')
        search = self.request.query_params.get('search')

        if store_id:
            qs = qs.filter(store_id_id=store_id)
        if product_id:
            qs = qs.filter(product_id_id=product_id)

        if is_low_stock is not None and is_low_stock.lower() in ('true', '1'):
            qs = qs.filter(stock_quantity__lte=F('low_stock_threshold'), stock_quantity__gt=0)

        if is_out_of_stock is not None and is_out_of_stock.lower() in ('true', '1'):
            qs = qs.filter(stock_quantity__lte=0)

        if search:
            qs = qs.filter(
                Q(product_id__name__icontains=search)
                | Q(product_id__sku__icontains=search)
                | Q(product_id__barcode__icontains=search)
                | Q(product_id__internal_barcode__icontains=search)
                | Q(batch_number__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='adjust_stock')
    def adjust_stock(self, request, pk=None):
        """
        Atomically adjust stock for this inventory record.
        Creates an immutable StockMovement audit entry.
        """
        inventory = self.get_object()
        serializer = StockAdjustmentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        quantity_delta = data['quantity_delta']
        movement_type = data['movement_type']
        reason = data.get('reason', '')
        reference_id = data.get('reference_id', '')
        notes = data.get('notes', '')
        allow_negative = data.get('allow_negative', False)

        try:
            movement = inventory.adjust_stock(
                quantity_delta=quantity_delta,
                movement_type=movement_type,
                reason=reason,
                user=request.user,
                reference_id=reference_id,
                notes=notes,
                allow_negative=allow_negative,
            )
        except DjangoValidationError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'message': 'Stock adjusted successfully',
                'inventory': InventorySerializer(inventory).data,
                'movement': StockMovementSerializer(movement).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='receive_goods')
    def receive_goods(self, request):
        """
        Inward a bulk Goods Receipt Note (GRN) from a vendor into store inventory.
        Automatically provisions inventory records if not already created.
        Associates vendor records, verifies tenant isolation, and automatically
        resolves negotiated supplier cost pricing from VendorProduct catalog.
        """
        serializer = ReceiveGoodsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        store_id = data['store_id']
        vendor_id = data.get('vendor_id')
        reference_id = data.get('reference_id', '')
        notes = data.get('notes', '')
        items = data['items']

        try:
            store = Store.objects.get(id=store_id, is_deleted=False)
        except Store.DoesNotExist:
            return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        vendor = None
        if vendor_id:
            try:
                vendor = Vendor.objects.get(id=vendor_id, is_deleted=False)
            except Vendor.DoesNotExist:
                return Response({'error': f"Vendor '{vendor_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

            if vendor.organization_id_id != store.organization_id_id:
                return Response(
                    {'error': 'Vendor does not belong to the same organization as the store.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        processed_movements = []
        with transaction.atomic():
            for item in items:
                product_id = item['product_id']
                quantity = item['quantity']
                store_price = item.get('store_price')
                batch_number = item.get('batch_number')

                try:
                    product = Product.objects.get(id=product_id, is_deleted=False)
                except Product.DoesNotExist:
                    return Response({'error': f"Product '{product_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

                if product.organization_id_id != store.organization_id_id:
                    return Response(
                        {'error': f"Product '{product.name}' does not belong to the same organization as the store."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Auto-resolve store price from negotiated VendorProduct pricing or base cost price
                if store_price is None and vendor:
                    vp = VendorProduct.objects.filter(
                        vendor_id=vendor,
                        product_id=product,
                        is_active=True,
                        is_deleted=False,
                    ).first()
                    if vp and vp.negotiated_cost_price is not None:
                        store_price = vp.negotiated_cost_price
                    elif product.cost_price is not None:
                        store_price = product.cost_price
                elif store_price is None and product.cost_price is not None:
                    store_price = product.cost_price

                inv, _ = Inventory.objects.get_or_create(
                    store_id=store,
                    product_id=product,
                    defaults={'created_by': request.user, 'stock_quantity': 0},
                )

                if inv.is_deleted:
                    inv.restore()

                if store_price is not None:
                    inv.store_price = store_price
                if batch_number:
                    inv.batch_number = batch_number
                if vendor:
                    inv.vendor_id = vendor
                inv.save()

                reason = f"GRN Received from {vendor.name}" if vendor else 'GRN Purchase Receipt'
                if reference_id:
                    reason += f": {reference_id}"

                movement = inv.adjust_stock(
                    quantity_delta=quantity,
                    movement_type=StockMovementType.PURCHASE_RECEIPT,
                    reason=reason,
                    user=request.user,
                    reference_id=reference_id,
                    notes=notes,
                    vendor=vendor,
                )
                processed_movements.append(movement)

        return Response(
            {
                'message': f'Successfully inwarded {len(processed_movements)} items into {store.name}',
                'items_count': len(processed_movements),
                'reference_id': reference_id,
                'vendor_id': vendor.id if vendor else None,
                'movements': StockMovementSerializer(processed_movements, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Aggregate KPIs for the specified store:
        total_products, total_units_in_stock, low_stock_count, out_of_stock_count, total_inventory_value.
        """
        store_id = request.query_params.get('store_id')
        if not store_id:
            return Response({'error': 'store_id query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Inventory.objects.filter(store_id_id=store_id, is_deleted=False).select_related('product_id')

        total_products = qs.count()
        total_units = qs.aggregate(total=Sum('stock_quantity'))['total'] or 0
        low_stock_count = qs.filter(stock_quantity__lte=F('low_stock_threshold'), stock_quantity__gt=0).count()
        out_of_stock_count = qs.filter(stock_quantity__lte=0).count()

        # Compute total inventory valuation using cost price (or effective price fallback)
        total_value = Decimal('0.00')
        for item in qs:
            unit_val = item.store_price or item.product_id.cost_price or item.product_id.base_mrp or Decimal('0.00')
            if item.stock_quantity > 0:
                total_value += item.stock_quantity * unit_val

        data = {
            'total_products': total_products,
            'total_units_in_stock': total_units,
            'low_stock_count': low_stock_count,
            'out_of_stock_count': out_of_stock_count,
            'total_inventory_value': total_value,
        }

        serializer = InventorySummarySerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log for tracking all inventory goods movements and adjustments.
    Supports filtering by store, product, vendor, movement type, reference ID, and search.
    """
    queryset = (
        StockMovement.objects.filter(is_deleted=False)
        .select_related('inventory_id', 'store_id', 'product_id', 'vendor_id', 'created_by')
        .order_by('-created_at')
    )
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store_id')
        product_id = self.request.query_params.get('product_id')
        vendor_id = self.request.query_params.get('vendor_id')
        movement_type = self.request.query_params.get('movement_type')
        reference_id = self.request.query_params.get('reference_id')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        search = self.request.query_params.get('search')

        if store_id:
            qs = qs.filter(store_id_id=store_id)
        if product_id:
            qs = qs.filter(product_id_id=product_id)
        if vendor_id:
            qs = qs.filter(vendor_id_id=vendor_id)
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        if reference_id:
            qs = qs.filter(reference_id__icontains=reference_id)
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        if search:
            qs = qs.filter(
                Q(reason__icontains=search)
                | Q(reference_id__icontains=search)
                | Q(notes__icontains=search)
                | Q(product_id__name__icontains=search)
                | Q(product_id__sku__icontains=search)
                | Q(vendor_id__name__icontains=search)
                | Q(vendor_id__vendor_code__icontains=search)
            )

        return qs
