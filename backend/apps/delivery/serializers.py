from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import Delivery

class DeliverySerializer(BaseModelSerializer):
    class Meta:
        model = Delivery
        fields = '__all__'

