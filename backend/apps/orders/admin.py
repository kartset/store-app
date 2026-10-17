from django.contrib import admin

from db.models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ('product_id', 'product_name_snapshot', 'quantity', 'unit_price', 'discount', 'line_total')
    readonly_fields = ('product_name_snapshot', 'line_total')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'store_id', 'customer_name_snapshot', 'status', 'fulfillment_type', 'payment_status', 'grand_total', 'created_at')
    list_filter = ('status', 'fulfillment_type', 'payment_status', 'store_id')
    search_fields = ('order_number', 'customer_name_snapshot', 'customer_phone_snapshot')
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'product_name_snapshot', 'quantity', 'unit_price', 'line_total')
    search_fields = ('order_id__order_number', 'product_name_snapshot', 'sku_snapshot')
