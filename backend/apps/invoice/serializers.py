from decimal import Decimal

from rest_framework import serializers

from apps.customer.serializers import CustomerSerializer
from apps.store.serializers import StoreSerializer
from db.models import (
    Invoice,
    InvoiceItem,
    InvoiceType,
    Payment,
    PaymentMethod,
)
from utils.serializers import BaseModelSerializer


class InvoiceItemSerializer(BaseModelSerializer):
    product_name = serializers.CharField(source='product_id.name', read_only=True)
    product_sku = serializers.CharField(source='product_id.sku', read_only=True)

    class Meta:
        model = InvoiceItem
        fields = [
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'invoice_id',
            'product_id',
            'product_name',
            'product_sku',
            'product_name_snapshot',
            'sku_snapshot',
            'barcode_snapshot',
            'hsn_code',
            'quantity',
            'unit_price',
            'discount',
            'tax_slab',
            'taxable_amount',
            'gst_amount',
            'cgst_amount',
            'sgst_amount',
            'igst_amount',
            'line_total',
        ]


class PaymentSerializer(BaseModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'invoice_id',
            'method',
            'external_transaction_id',
            'amount',
            'amount_tendered',
            'change_returned',
            'status',
        ]


class InvoiceSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    customer = CustomerSerializer(source='customer_id', read_only=True)
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
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
            'invoice_number',
            'type',
            'status',
            'subtotal',
            'total_discount',
            'cgst_amount',
            'sgst_amount',
            'igst_amount',
            'total_gst',
            'round_off',
            'grand_total',
            'is_tax_inclusive',
            'loyalty_points_redeemed',
            'loyalty_discount_amount',
            'loyalty_points_earned',
            'customer_name_snapshot',
            'customer_phone_snapshot',
            'customer_gstin_snapshot',
            'notes',
            'store',
            'customer',
            'items',
            'payments',
        ]


class InvoiceCheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=Decimal('0.00'))
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0.00'), min_value=Decimal('0.00'))


class InvoicePaymentInputSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.00'))
    amount_tendered = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    change_returned = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    external_transaction_id = serializers.CharField(max_length=255, required=False, allow_blank=True)


class InvoiceCheckoutSerializer(serializers.Serializer):
    store_id = serializers.UUIDField()
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    customer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    customer_gstin = serializers.CharField(max_length=15, required=False, allow_blank=True)
    type = serializers.ChoiceField(choices=InvoiceType.choices, default=InvoiceType.POS)
    is_tax_inclusive = serializers.BooleanField(default=True)
    items = InvoiceCheckoutItemSerializer(many=True)
    payments = InvoicePaymentInputSerializer(many=True, required=False, default=list)
    loyalty_points_to_redeem = serializers.IntegerField(min_value=0, default=0, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required to checkout an invoice.")
        return value
