from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.customer.serializers import CustomerSerializer
from apps.store.serializers import StoreSerializer
from db.models import Invoice, InvoiceItem, Payment


class InvoiceItemSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    customer = CustomerSerializer(source='customer_id', read_only=True)
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
            'quantity',
            'unit_price',
            'discount',
            'gst_amount',
        ]


class PaymentSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    customer = CustomerSerializer(source='customer_id', read_only=True)

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
            'status',
        ]


class InvoiceSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    customer = CustomerSerializer(source='customer_id', read_only=True)
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
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
            'customer_id',
            'type',
            'status',
            'subtotal',
            'total_discount',
            'total_gst',
            'grand_total',
            'store',
            'customer',
            'items',
            'payments',
        )
