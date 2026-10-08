from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Organization

class OrganizationSerializer(BaseModelSerializer):
    class Meta:
        model = Organization
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
            'subdomain',
            'is_active',
        )

