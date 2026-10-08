from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import User

class UserSerializer(BaseModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

