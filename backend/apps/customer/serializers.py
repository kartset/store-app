from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Customer

class CustomerSerializer(BaseModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

