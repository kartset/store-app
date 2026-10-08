from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.store.serializers import StoreSerializer
from apps.user.serializers import UserSerializer
from db.models import StoreStaff

class StoreStaffSerializer(BaseModelSerializer):
    user = UserSerializer(source='user_id', read_only=True)
    store = StoreSerializer(source='store_id', read_only=True)
    class Meta:
        model = StoreStaff
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
            'store_id',
            'role',
            'user',
            'store',
        )

