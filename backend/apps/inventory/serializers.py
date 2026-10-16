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
class StockAdjustmentRequestSerializer(serializers.Serializer):
    """Payload validator for manual or operational stock adjustments."""
    quantity_delta = serializers.IntegerField(
        required=True,
        help_text="Positive integer to add stock, negative to deduct stock."
    )
    movement_type = serializers.CharField(
        max_length=30,
        required=True,
        help_text="StockMovementType choice (e.g. POS_SALE, DAMAGE_WASTE, AUDIT_ADJUSTMENT)."
    )
    reason = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default=''
    )
    reference_id = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=''
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default=''
    )
    allow_negative = serializers.BooleanField(
        required=False,
        default=False
    )

    def validate_quantity_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity delta cannot be zero.")
        return value


class ReceiveGoodsItemSerializer(serializers.Serializer):
    """Single item entry for GRN receipt."""
    product_id = serializers.UUIDField(required=True)
    quantity = serializers.IntegerField(min_value=1, required=True)
    store_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True
    )
    batch_number = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True
    )


class ReceiveGoodsRequestSerializer(serializers.Serializer):
    """Payload validator for receiving bulk Goods Receipt Note (GRN) from vendors."""
    store_id = serializers.UUIDField(required=True)
    vendor_id = serializers.UUIDField(required=False, allow_null=True)
    reference_id = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=''
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default=''
    )
    items = ReceiveGoodsItemSerializer(many=True, allow_empty=False)


class InventorySummarySerializer(serializers.Serializer):
    """Aggregated store inventory KPIs for dashboards and header statistics."""
    total_products = serializers.IntegerField()
    total_units_in_stock = serializers.IntegerField()
    low_stock_count = serializers.IntegerField()
    out_of_stock_count = serializers.IntegerField()
    total_inventory_value = serializers.DecimalField(max_digits=14, decimal_places=2)
