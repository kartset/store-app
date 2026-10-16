from django.contrib import admin

from .models import (
    Brand,
    CatalogueItem,
    Category,
    Customer,
    Delivery,
    Inventory,
    Invoice,
    InvoiceItem,
    Order,
    OrderItem,
    Organization,
    OrganizationCategory,
    OrganizationStaff,
    Payment,
    Product,
    StockMovement,
    Store,
    StoreCategory,
    StoreCustomer,
    StoreStaff,
    Subcategory,
    User,
    Vendor,
    VendorProduct,
)


class BaseModelAdmin(admin.ModelAdmin):
    """Base Admin class to show audit and timestamp fields cleanly."""
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')


@admin.register(User)
class UserAdmin(BaseModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'is_active', 'created_at')
    list_filter = ('is_active', 'is_deleted')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    readonly_fields = ('id', 'last_login', 'created_at', 'updated_at', 'deleted_at')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Status', {'fields': ('is_active', 'last_login')}),
        ('Audit & Soft Delete', {'fields': ('id', 'is_deleted', 'deleted_at', 'created_by', 'updated_by', 'deleted_by')}),
    )

    def save_model(self, request, obj, form, change):
        if 'password' in form.changed_data:
            obj.set_password(obj.password)
        super().save_model(request, obj, form, change)


@admin.register(Organization)
class OrganizationAdmin(BaseModelAdmin):
    list_display = ('name', 'subdomain', 'is_active', 'created_at')
    list_filter = ('is_active', 'is_deleted')
    search_fields = ('name', 'subdomain')


@admin.register(Store)
class StoreAdmin(BaseModelAdmin):
    list_display = ('name', 'organization_id', 'gst_number', 'is_active', 'created_at')
    list_filter = ('is_active', 'is_deleted', 'organization_id')
    search_fields = ('name', 'gst_number', 'organization_id__name')


@admin.register(Category)
class CategoryAdmin(BaseModelAdmin):
    list_display = ('name', 'parent_id', 'slug', 'default_hsn_code', 'default_tax_slab', 'is_active', 'created_at')
    list_filter = ('is_active', 'is_deleted')
    search_fields = ('name', 'slug', 'default_hsn_code')


@admin.register(OrganizationCategory)
class OrganizationCategoryAdmin(BaseModelAdmin):
    list_display = ('organization_id', 'category_id', 'is_active', 'created_at')
    list_filter = ('organization_id', 'category_id', 'is_active', 'is_deleted')
    search_fields = ('organization_id__name', 'category_id__name')


@admin.register(StoreCategory)
class StoreCategoryAdmin(BaseModelAdmin):
    list_display = ('store_id', 'category_id', 'is_active', 'created_at')
    list_filter = ('store_id', 'category_id', 'is_active', 'is_deleted')
    search_fields = ('store_id__name', 'category_id__name')


@admin.register(Subcategory)
class SubcategoryAdmin(BaseModelAdmin):
    list_display = ('name', 'category_id', 'organization_id', 'slug', 'is_active', 'created_at')
    list_filter = ('organization_id', 'category_id', 'is_active', 'is_deleted')
    search_fields = ('name', 'slug', 'organization_id__name', 'category_id__name')


@admin.register(Brand)
class BrandAdmin(BaseModelAdmin):
    list_display = ('name', 'organization_id', 'is_active', 'created_at')
    list_filter = ('organization_id', 'is_active', 'is_deleted')
    search_fields = ('name', 'organization_id__name')


@admin.register(CatalogueItem)
class CatalogueItemAdmin(BaseModelAdmin):
    list_display = (
        'name',
        'sku',
        'barcode',
        'brand_name',
        'category_name',
        'tax_slab',
        'uom',
        'suggested_mrp',
        'is_active',
        'created_at',
    )
    search_fields = ('name', 'sku', 'barcode', 'brand_name', 'category_name', 'hsn_code')
    list_filter = ('tax_slab', 'uom', 'is_active', 'is_deleted')



@admin.register(Product)
class ProductAdmin(BaseModelAdmin):
    list_display = (
        'name',
        'organization_id',
        'sku',
        'barcode',
        'internal_barcode',
        'category_id',
        'subcategory_id',
        'brand_id',
        'base_mrp',
        'cost_price',
        'tax_slab',
        'uom',
        'is_active',
    )
    search_fields = ('name', 'sku', 'barcode', 'internal_barcode', 'hsn_code', 'organization_id__name')
    list_filter = ('organization_id', 'category_id', 'subcategory_id', 'brand_id', 'tax_slab', 'uom', 'is_active', 'is_deleted')


@admin.register(Inventory)
class InventoryAdmin(BaseModelAdmin):
    list_display = (
        'product_id',
        'store_id',
        'stock_quantity',
        'low_stock_threshold',
        'reorder_quantity',
        'store_price',
        'batch_number',
        'last_restocked_at',
    )
    search_fields = ('product_id__name', 'product_id__sku', 'store_id__name', 'batch_number')
    list_filter = ('store_id', 'vendor_id', 'is_deleted')


@admin.register(StockMovement)
class StockMovementAdmin(BaseModelAdmin):
    list_display = (
        'product_id',
        'store_id',
        'vendor_id',
        'movement_type',
        'quantity_delta',
        'quantity_before',
        'quantity_after',
        'reference_id',
        'created_at',
    )
    search_fields = ('product_id__name', 'store_id__name', 'vendor_id__name', 'reference_id', 'reason')
    list_filter = ('movement_type', 'store_id', 'vendor_id', 'created_at')
    readonly_fields = (
        'id',
        'inventory_id',
        'store_id',
        'product_id',
        'vendor_id',
        'movement_type',
        'quantity_delta',
        'quantity_before',
        'quantity_after',
        'created_at',
        'updated_at',
        'deleted_at',
    )


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    fk_name = 'invoice_id'
    extra = 0
    readonly_fields = ('id', 'created_at', 'updated_at')


class PaymentInline(admin.TabularInline):
    model = Payment
    fk_name = 'invoice_id'
    extra = 0
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Invoice)
class InvoiceAdmin(BaseModelAdmin):
    list_display = ('id', 'store_id', 'customer_id', 'type', 'status', 'grand_total', 'created_at')
    search_fields = ('id', 'store_id__name', 'customer_id__mobile_number', 'customer_id__name')
    list_filter = ('type', 'status', 'store_id', 'is_deleted', 'created_at')
    inlines = [InvoiceItemInline, PaymentInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(BaseModelAdmin):
    list_display = ('id', 'invoice_id', 'product_id', 'quantity', 'unit_price', 'discount', 'gst_amount')
    search_fields = ('invoice_id__id', 'product_id__name')
    list_filter = ('is_deleted',)


@admin.register(Payment)
class PaymentAdmin(BaseModelAdmin):
    list_display = ('id', 'invoice_id', 'method', 'amount', 'status', 'external_transaction_id', 'created_at')
    search_fields = ('invoice_id__id', 'external_transaction_id')
    list_filter = ('method', 'status', 'is_deleted', 'created_at')


@admin.register(OrganizationStaff)
class OrganizationStaffAdmin(BaseModelAdmin):
    list_display = ('user_id', 'organization_id', 'role', 'is_active', 'created_at')
    search_fields = ('user_id__email', 'organization_id__name')
    list_filter = ('role', 'organization_id', 'is_active', 'is_deleted')


@admin.register(StoreStaff)
class StoreStaffAdmin(BaseModelAdmin):
    list_display = ('user_id', 'store_id', 'role', 'created_at')
    search_fields = ('user_id__email', 'store_id__name')
    list_filter = ('role', 'store_id', 'is_deleted')


@admin.register(Customer)
class CustomerAdmin(BaseModelAdmin):
    list_display = (
        'mobile_number',
        'name',
        'customer_type',
        'gstin',
        'city',
        'is_active',
        'created_at',
    )
    search_fields = ('mobile_number', 'name', 'email', 'gstin', 'city')
    list_filter = ('customer_type', 'is_active', 'is_deleted', 'created_at')


@admin.register(StoreCustomer)
class StoreCustomerAdmin(BaseModelAdmin):
    list_display = (
        'customer_id',
        'store_id',
        'loyalty_points',
        'credit_limit',
        'outstanding_balance',
        'total_visits',
        'last_visit',
        'first_visit',
    )
    search_fields = ('customer_id__mobile_number', 'customer_id__name', 'store_id__name')
    list_filter = ('store_id', 'is_deleted')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    fk_name = 'order_id'
    extra = 0
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Order)
class OrderAdmin(BaseModelAdmin):
    list_display = ('id', 'store_id', 'customer_id', 'status', 'total_amount', 'created_at')
    search_fields = ('id', 'store_id__name', 'customer_id__mobile_number', 'customer_id__name')
    list_filter = ('status', 'store_id', 'is_deleted', 'created_at')
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(BaseModelAdmin):
    list_display = ('id', 'order_id', 'product_id', 'quantity', 'price')
    search_fields = ('order_id__id', 'product_id__name')
    list_filter = ('is_deleted',)


@admin.register(Vendor)
class VendorAdmin(BaseModelAdmin):
    list_display = ('name', 'trade_name', 'vendor_code', 'organization_id', 'gstin', 'phone', 'payment_terms', 'is_active')
    search_fields = ('name', 'trade_name', 'vendor_code', 'gstin', 'pan_number', 'phone', 'email', 'organization_id__name')
    list_filter = ('organization_id', 'payment_terms', 'is_active', 'is_deleted')


@admin.register(VendorProduct)
class VendorProductAdmin(BaseModelAdmin):
    list_display = (
        'vendor_id',
        'product_id',
        'vendor_sku',
        'negotiated_cost_price',
        'minimum_order_quantity',
        'lead_time_days',
        'is_primary_supplier',
        'is_active',
    )
    search_fields = ('vendor_id__name', 'product_id__name', 'product_id__sku', 'vendor_sku')
    list_filter = ('is_primary_supplier', 'is_active', 'is_deleted')




@admin.register(Delivery)
class DeliveryAdmin(BaseModelAdmin):
    list_display = ('id', 'status', 'delivery_partner', 'tracking_id', 'order_id', 'invoice_id', 'created_at')
    search_fields = ('id', 'tracking_id', 'delivery_partner', 'order_id__id', 'invoice_id__id')
    list_filter = ('status', 'delivery_partner', 'is_deleted', 'created_at')
