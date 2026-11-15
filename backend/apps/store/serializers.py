from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.organisation.serializers import OrganizationSerializer
from db.models import Store, Organization

class StoreSerializer(BaseModelSerializer):
    organization = OrganizationSerializer(source='organization_id', read_only=True)
    organization_id = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.filter(is_deleted=False),
        required=False
    )
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

