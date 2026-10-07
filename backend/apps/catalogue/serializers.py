from rest_framework import serializers
from db.models import CatalogueItem

class CatalogueItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogueItem
        fields = '__all__'

