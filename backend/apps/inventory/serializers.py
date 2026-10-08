from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Inventory

class InventorySerializer(BaseModelSerializer):
    class Meta:
        model = Inventory
        fields = '__all__'

