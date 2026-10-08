from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Organization

class OrganizationSerializer(BaseModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'

