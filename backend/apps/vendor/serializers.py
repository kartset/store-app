from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Vendor

class VendorSerializer(BaseModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'

