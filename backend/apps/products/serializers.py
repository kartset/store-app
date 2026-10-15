from decimal import Decimal

from rest_framework import serializers

from apps.organisation.serializers import OrganizationSerializer
from db.models import (
    Brand,
    Category,
    OrganizationCategory,
    Product,
    StoreCategory,
    Subcategory,
    UnitOfMeasure,
)
from utils.serializers import BaseModelSerializer


class CategorySerializer(BaseModelSerializer):
    """Serializer for Platform-level Global Category Master."""
    parent = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'is_deleted',
            'parent_id',
            'parent',
            'name',
            'slug',
            'description',
            'default_hsn_code',
            'default_tax_slab',
            'is_active',
            'display_order',
        )

    def get_parent(self, obj):
        if obj.parent_id:
            return {
                'id': str(obj.parent_id.id),
                'name': obj.parent_id.name,
                'slug': obj.parent_id.slug,
            }
        return None


class CategoryTreeSerializer(CategorySerializer):
    """Hierarchical category serializer with nested subcategories."""
    subcategories = serializers.SerializerMethodField()

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ('subcategories',)

    def get_subcategories(self, obj):
        children = obj.subcategories.filter(is_deleted=False, is_active=True).order_by('display_order', 'name')
        return CategoryTreeSerializer(children, many=True).data


class BrandSerializer(BaseModelSerializer):
    """Serializer for Organization Brands."""
    class Meta:
        model = Brand
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'is_deleted',
            'organization_id',
            'name',
            'slug',
            'logo_url',
            'is_active',
        )

    def validate(self, attrs):
        org = attrs.get('organization_id') or (self.instance.organization_id if self.instance else None)
        name = attrs.get('name') or (self.instance.name if self.instance else None)
        if org and name:
            qs = Brand.objects.filter(organization_id=org, name__iexact=name.strip(), is_deleted=False)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({'name': 'A brand with this name already exists in this organization.'})
        return attrs


class OrganizationCategorySerializer(BaseModelSerializer):
    """Serializer for Categories adopted by an Organization."""
    category = CategorySerializer(source='category_id', read_only=True)

    class Meta:
        model = OrganizationCategory
        fields = (
            'id',
            'created_at',
            'updated_at',
            'is_deleted',
            'organization_id',
            'category_id',
            'category',
            'is_active',
        )


class StoreCategorySerializer(BaseModelSerializer):
    """Serializer for Store <> Category Mappings."""
    category = CategorySerializer(source='category_id', read_only=True)

    class Meta:
        model = StoreCategory
        fields = (
            'id',
            'created_at',
            'updated_at',
            'is_deleted',
            'store_id',
            'category_id',
            'category',
            'is_active',
        )


class SubcategorySerializer(BaseModelSerializer):
    """Serializer for Organization-specific Subcategories."""
    category = CategorySerializer(source='category_id', read_only=True)
    organization = OrganizationSerializer(source='organization_id', read_only=True)

    class Meta:
        model = Subcategory
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'is_deleted',
            'organization_id',
            'organization',
            'category_id',
            'category',
            'name',
            'slug',
            'description',
            'is_active',
            'display_order',
        )

    def validate(self, attrs):
        org = attrs.get('organization_id') or (self.instance.organization_id if self.instance else None)
        category = attrs.get('category_id') or (self.instance.category_id if self.instance else None)
        name = attrs.get('name') or (self.instance.name if self.instance else None)

        if org and category and name:
            qs = Subcategory.objects.filter(
                organization_id=org,
                category_id=category,
                name__iexact=name.strip(),
                is_deleted=False
            )
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({
                    'name': 'A subcategory with this name already exists in this organization under the selected category.'
                })
        return attrs


class ProductSerializer(BaseModelSerializer):
    """
    Serializer for Master Catalog Products with dual barcode support,
    tax calculation defaults, and nested category/brand metadata.
    """
    category = CategorySerializer(source='category_id', read_only=True)
    subcategory = SubcategorySerializer(source='subcategory_id', read_only=True)
    brand = BrandSerializer(source='brand_id', read_only=True)
    organization = OrganizationSerializer(source='organization_id', read_only=True)

    class Meta:
        model = Product
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'is_deleted',
            'organization_id',
            'organization',
            'catalogue_item_id',
            'category_id',
            'category',
            'subcategory_id',
            'subcategory',
            'brand_id',
            'brand',
            'name',
            'sku',
            'barcode',
            'internal_barcode',
            'hsn_code',
            'tax_slab',
            'cost_price',
            'base_mrp',
            'uom',
            'description',
            'is_perishable',
            'has_expiry',
            'is_returnable',
            'is_active',
            'low_stock_threshold',
        )

    def validate_sku(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("SKU cannot be empty.")
        return value.strip()

    def validate_barcode(self, value):
        if value:
            stripped = value.strip()
            return stripped if stripped else None
        return None

    def validate_internal_barcode(self, value):
        if value:
            stripped = value.strip()
            return stripped if stripped else None
        return None

    def validate_base_mrp(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Base MRP must be a positive number.")
        return value

    def validate_cost_price(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Cost price must be a positive number.")
        return value

    def validate_tax_slab(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Tax slab cannot be negative.")
        return value

    def validate_uom(self, value):
        valid_choices = [c[0] for c in UnitOfMeasure.choices]
        if value not in valid_choices:
            raise serializers.ValidationError(f"Invalid unit of measure. Valid options are: {', '.join(valid_choices)}")
        return value

    def validate(self, attrs):
        org = attrs.get('organization_id') or (self.instance.organization_id if self.instance else None)
        sku = attrs.get('sku') or (self.instance.sku if self.instance else None)
        barcode = attrs.get('barcode', self.instance.barcode if self.instance else None)
        internal_barcode = attrs.get('internal_barcode', self.instance.internal_barcode if self.instance else None)

        # SKU uniqueness per org check
        if org and sku:
            qs = Product.objects.filter(organization_id=org, sku__iexact=sku.strip(), is_deleted=False)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({'sku': 'A product with this SKU already exists in this organization.'})

        # Barcode uniqueness per org check
        if org and barcode:
            qs = Product.objects.filter(organization_id=org, barcode=barcode, is_deleted=False)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({'barcode': 'A product with this manufacturer barcode already exists in this organization.'})

        # Internal barcode uniqueness per org check
        if org and internal_barcode:
            qs = Product.objects.filter(organization_id=org, internal_barcode=internal_barcode, is_deleted=False)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({'internal_barcode': 'A product with this internal barcode already exists in this organization.'})

        # Subcategory organization and category matching check
        subcategory = attrs.get('subcategory_id', self.instance.subcategory_id if self.instance else None)
        category = attrs.get('category_id', self.instance.category_id if self.instance else None)
        if subcategory and org:
            sub_org_id = subcategory.organization_id_id if hasattr(subcategory, 'organization_id_id') else subcategory.organization_id.id
            target_org_id = org.id if hasattr(org, 'id') else org
            if sub_org_id != target_org_id:
                raise serializers.ValidationError({'subcategory_id': 'Selected subcategory does not belong to this organization.'})

        if subcategory and category:
            sub_cat_id = subcategory.category_id_id if hasattr(subcategory, 'category_id_id') else subcategory.category_id.id
            target_cat_id = category.id if hasattr(category, 'id') else category
            if sub_cat_id != target_cat_id:
                raise serializers.ValidationError({'subcategory_id': 'Selected subcategory does not belong to the selected category.'})

        return attrs
