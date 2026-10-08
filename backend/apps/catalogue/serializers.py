from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import CatalogueItem

class CatalogueItemSerializer(BaseModelSerializer):
    class Meta:
        model = CatalogueItem
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'name',
            'sku',
            'hsn_code',
            'description',
        )

