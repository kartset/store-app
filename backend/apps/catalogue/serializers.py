from rest_framework import serializers

from db.models import (
    Brand,
    CatalogueItem,
    Category,
    Organization,
    Store,
    Subcategory,
    UnitOfMeasure,
)
from utils.serializers import BaseModelSerializer


class CatalogueItemSerializer(BaseModelSerializer):
    """
    Serializer for Global Product Register items (Tier 1).
    Maintained centrally across the entire platform.
    """
    class Meta:
        model = CatalogueItem
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'name',
            'sku',
            'barcode',
            'brand_name',
            'category_name',
            'hsn_code',
            'tax_slab',
            'uom',
            'suggested_mrp',
            'description',
            'is_active',
        )


class CatalogueItemAdoptSerializer(serializers.Serializer):
    """
    Request serializer for forking/adopting a Global Catalogue Item into an
    Organization's Product Master (Tier 1 -> Tier 2 adoption).
    """
    organization_id = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.filter(is_deleted=False)
    )
    cost_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=0.00
    )
    base_mrp = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        default=None
    )
    sku = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=''
    )
    internal_barcode = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=''
    )
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
        default=None
    )
    subcategory_id = serializers.PrimaryKeyRelatedField(
        queryset=Subcategory.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
        default=None
    )
    brand_id = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
        default=None
    )
    tax_slab = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=False,
        allow_null=True,
        default=None
    )
    uom = serializers.ChoiceField(
        choices=UnitOfMeasure.choices,
        required=False,
        default=None,
        allow_null=True
    )
    low_stock_threshold = serializers.IntegerField(
        required=False,
        default=10
    )
    is_perishable = serializers.BooleanField(
        required=False,
        default=False
    )
    has_expiry = serializers.BooleanField(
        required=False,
        default=False
    )
    is_returnable = serializers.BooleanField(
        required=False,
        default=True
    )

    # Optional Tier 3 store placement at adoption time
    store_id = serializers.PrimaryKeyRelatedField(
        queryset=Store.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
        default=None
    )
    initial_stock = serializers.IntegerField(
        required=False,
        default=0
    )
    store_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        default=None
    )


class BulkAdoptSerializer(serializers.Serializer):
    """
    Request serializer for bulk-adopting multiple catalogue items into an organization.
    """
    organization_id = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.filter(is_deleted=False)
    )
    catalogue_item_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="List of CatalogueItem UUIDs to adopt"
    )
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
        default=None
    )
    store_id = serializers.PrimaryKeyRelatedField(
        queryset=Store.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
        default=None
    )
