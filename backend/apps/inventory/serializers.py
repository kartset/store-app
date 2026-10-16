from rest_framework import serializers

from apps.products.serializers import ProductSerializer
from apps.store.serializers import StoreSerializer
from apps.vendor.serializers import VendorSerializer
from db.models import Inventory, StockMovement
from utils.serializers import BaseModelSerializer


class StockMovementSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    product = ProductSerializer(source='product_id', read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'inventory_id',
            'store_id',
            'product_id',
            'movement_type',
            'quantity_delta',
            'quantity_before',
            'quantity_after',
            'reason',
            'reference_id',
            'notes',
            'store',
            'product',
        )
        read_only_fields = (
            'id',
            'created_at',
            'updated_at',
            'quantity_before',
            'quantity_after',
        )


class InventorySerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    product = ProductSerializer(source='product_id', read_only=True)
    vendor = VendorSerializer(source='vendor_id', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Inventory
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'store_id',
            'product_id',
            'vendor_id',
            'stock_quantity',
            'store_price',
            'low_stock_threshold',
            'reorder_quantity',
            'batch_number',
            'last_restocked_at',
            'is_low_stock',
            'effective_price',
            'store',
            'product',
            'vendor',
        )


