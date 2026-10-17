from decimal import Decimal

from rest_framework import serializers

from apps.customer.serializers import CustomerSerializer
from apps.store.serializers import StoreSerializer
from db.models import (
    Customer,
    FulfillmentType,
    Order,
    OrderItem,
    OrderPaymentStatus,
    PaymentMethod,
    Product,
    Store,
)
from utils.serializers import BaseModelSerializer


class OrderItemSerializer(BaseModelSerializer):
    product_name = serializers.CharField(source='product_id.name', read_only=True)
    product_sku = serializers.CharField(source='product_id.sku', read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'order_id',
            'product_id',
            'product_name',
            'product_sku',
            'product_name_snapshot',
            'sku_snapshot',
            'barcode_snapshot',
            'quantity',
            'unit_price',
            'discount',
            'tax_slab',
            'tax_amount',
            'line_total',
        ]


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(is_deleted=False))
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0.00'))


class OrderSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    customer = CustomerSerializer(source='customer_id', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    invoice_number = serializers.CharField(source='invoice_id.invoice_number', read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'store_id',
            'customer_id',
            'invoice_id',
            'order_number',
            'status',
            'fulfillment_type',
            'payment_status',
            'subtotal',
            'total_discount',
            'total_tax',
            'grand_total',
            'customer_name_snapshot',
            'customer_phone_snapshot',
            'customer_email_snapshot',
            'delivery_address_line1',
            'delivery_address_line2',
            'delivery_city',
            'delivery_state',
            'delivery_pincode',
            'delivery_notes',
            'confirmed_at',
            'packed_at',
            'ready_at',
            'completed_at',
            'cancelled_at',
            'cancellation_reason',
            'notes',
            'store',
            'customer',
            'items',
            'invoice_number',
            'items_count',
        ]

    def get_items_count(self, obj):
        return obj.items.filter(is_deleted=False).count()


class OrderCreateSerializer(serializers.Serializer):
    store_id = serializers.PrimaryKeyRelatedField(queryset=Store.objects.filter(is_deleted=False))
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.filter(is_deleted=False),
        required=False,
        allow_null=True
    )
    fulfillment_type = serializers.ChoiceField(
        choices=FulfillmentType.choices,
        default=FulfillmentType.STORE_PICKUP
    )
    payment_status = serializers.ChoiceField(
        choices=OrderPaymentStatus.choices,
        default=OrderPaymentStatus.UNPAID
    )
    customer_name = serializers.CharField(required=False, allow_blank=True, default='')
    customer_phone = serializers.CharField(required=False, allow_blank=True, default='')
    customer_email = serializers.EmailField(required=False, allow_blank=True, default='')
    delivery_address_line1 = serializers.CharField(required=False, allow_blank=True, default='')
    delivery_address_line2 = serializers.CharField(required=False, allow_blank=True, default='')
    delivery_city = serializers.CharField(required=False, allow_blank=True, default='')
    delivery_state = serializers.CharField(required=False, allow_blank=True, default='')
    delivery_pincode = serializers.CharField(required=False, allow_blank=True, default='')
    delivery_notes = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = OrderItemCreateSerializer(many=True, allow_empty=False)


class OrderCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class OrderConvertToInvoiceSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(
        choices=PaymentMethod.choices,
        required=False,
        default=None,
        allow_null=True
    )
    payment_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True
    )
    register_session_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')
