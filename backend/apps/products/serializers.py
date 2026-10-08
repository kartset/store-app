from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Product

class ProductSerializer(BaseModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

