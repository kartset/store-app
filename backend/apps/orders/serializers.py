from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.customer.serializers import CustomerSerializer
from apps.store.serializers import StoreSerializer
from db.models import Order, OrderItem

class OrderSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    customer = CustomerSerializer(source='customer_id', read_only=True)
    class Meta:
        model = Order
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
            'status',
            'total_amount',
            'store',
            'customer',
        )

class OrderItemSerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    customer = CustomerSerializer(source='customer_id', read_only=True)
    class Meta:
        model = OrderItem
        fields = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by', 'is_deleted', 'order_id', 'product_id', 'quantity', 'price']

