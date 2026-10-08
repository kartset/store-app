from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.organisation.serializers import OrganizationSerializer
from apps.catalogue.serializers import CatalogueItemSerializer
from db.models import Product

class ProductSerializer(BaseModelSerializer):
    organization = OrganizationSerializer(source='organization_id', read_only=True)
    catalogue_item = CatalogueItemSerializer(source='catalogue_item_id', read_only=True)
    class Meta:
        model = Product
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'organization_id',
            'catalogue_item_id',
            'name',
            'sku',
            'hsn_code',
            'base_mrp',
            'organization',
            'catalogue_item',
        )

