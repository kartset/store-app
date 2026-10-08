from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Invoice, InvoiceItem, Payment

class InvoiceSerializer(BaseModelSerializer):
    class Meta:
        model = Invoice
        fields = '__all__'

class InvoiceItemSerializer(BaseModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = '__all__'

class PaymentSerializer(BaseModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

