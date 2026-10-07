from rest_framework import serializers
from db.models import StoreStaff

class StoreStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreStaff
        fields = '__all__'

