from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import CatalogueItem

class CatalogueItemSerializer(BaseModelSerializer):
    class Meta:
        model = CatalogueItem
        fields = '__all__'

