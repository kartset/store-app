from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.organisation.serializers import OrganizationSerializer
from db.models import Store

class StoreSerializer(BaseModelSerializer):
    organization = OrganizationSerializer(source='organization_id', read_only=True)
    class Meta:
        model = Store
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
            'name',
            'gst_number',
            'address',
            'is_active',
            'organization',
        )

