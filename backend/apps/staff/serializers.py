from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import StoreStaff

class StoreStaffSerializer(BaseModelSerializer):
    class Meta:
        model = StoreStaff
        fields = '__all__'

