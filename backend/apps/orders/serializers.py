from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Order, OrderItem

class OrderSerializer(BaseModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'

class OrderItemSerializer(BaseModelSerializer):
    class Meta:
        model = OrderItem
        fields = '__all__'

