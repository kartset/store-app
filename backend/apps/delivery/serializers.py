from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.invoice.serializers import InvoiceSerializer
from apps.orders.serializers import OrderSerializer
from db.models import Delivery

class DeliverySerializer(BaseModelSerializer):
    invoice = InvoiceSerializer(source='invoice_id', read_only=True)
    order = OrderSerializer(source='order_id', read_only=True)
    class Meta:
        model = Delivery
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'invoice_id',
            'order_id',
            'status',
            'tracking_id',
            'delivery_partner',
            'invoice',
            'order',
        )

