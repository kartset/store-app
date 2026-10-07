from rest_framework import serializers
from db.models import StoreCustomer

class StoreCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreCustomer
        fields = '__all__'

