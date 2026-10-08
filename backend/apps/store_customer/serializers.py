from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import StoreCustomer

class StoreCustomerSerializer(BaseModelSerializer):
    class Meta:
        model = StoreCustomer
        fields = '__all__'

