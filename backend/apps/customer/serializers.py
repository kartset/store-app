from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.user.serializers import UserSerializer
from db.models import Customer

class CustomerSerializer(BaseModelSerializer):
    user = UserSerializer(source='user_id', read_only=True)
    class Meta:
        model = Customer
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'user_id',
            'mobile_number',
            'name',
            'email',
            'user',
        )

