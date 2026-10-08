from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Store

class StoreSerializer(BaseModelSerializer):
    class Meta:
        model = Store
        fields = '__all__'

