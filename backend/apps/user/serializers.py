from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import User

class UserSerializer(BaseModelSerializer):
    class Meta:
        model = User
        fields = (
            'id',
            'password',
            'last_login',
            'is_superuser',
            'username',
            'first_name',
            'last_name',
            'email',
            'is_staff',
            'is_active',
            'date_joined',
        )

