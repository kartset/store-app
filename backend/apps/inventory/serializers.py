from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from apps.products.serializers import ProductSerializer
from apps.vendor.serializers import VendorSerializer
from apps.store.serializers import StoreSerializer
from db.models import Inventory

class InventorySerializer(BaseModelSerializer):
    store = StoreSerializer(source='store_id', read_only=True)
    product = ProductSerializer(source='product_id', read_only=True)
    vendor = VendorSerializer(source='vendor_id', read_only=True)
    class Meta:
        model = Inventory
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'store_id',
            'product_id',
            'vendor_id',
            'stock_quantity',
            'store_price',
            'store',
            'product',
            'vendor',
        )

