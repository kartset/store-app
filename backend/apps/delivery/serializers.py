import re
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers

from apps.invoice.serializers import InvoiceSerializer
from apps.orders.serializers import OrderSerializer
from db.models import (
    Delivery,
    DeliveryStatus,
    DeliveryType,
    Invoice,
    Order,
    OrderPaymentStatus,
    Store,
)
from utils.serializers import BaseModelSerializer


class DeliveryNestedStoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ('id', 'name', 'address', 'gst_number')


class DeliveryNestedOrderSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id',
            'order_number',
            'status',
            'fulfillment_type',
            'payment_status',
            'grand_total',
            'items_count',
            'created_at',
        )

    def get_items_count(self, obj):
        return obj.items.count() if hasattr(obj, 'items') else 0


class DeliverySerializer(BaseModelSerializer):
    store = DeliveryNestedStoreSerializer(source='store_id', read_only=True)
    order = DeliveryNestedOrderSerializer(source='order_id', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_type_display = serializers.CharField(source='get_delivery_type_display', read_only=True)

    class Meta:
        model = Delivery
        fields = (
            'id',
            'store_id',
            'order_id',
            'invoice_id',
            'tracking_id',
            'delivery_type',
            'delivery_type_display',
            'status',
            'status_display',
            'delivery_partner',
            'driver_name',
            'driver_phone',
            'vehicle_number',
            'recipient_name',
            'recipient_phone',
            'delivery_address',
            'delivery_notes',
            'otp_code',
            'is_cod',
            'cod_amount_due',
            'cod_amount_collected',
            'cod_payment_method',
            'dispatched_at',
            'delivered_at',
            'failure_reason',
            'created_at',
            'updated_at',
            'store',
            'order',
        )


class DeliveryCreateSerializer(serializers.Serializer):
    store_id = serializers.UUIDField(required=False)
    order_id = serializers.UUIDField(required=False, allow_null=True)
    invoice_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_type = serializers.ChoiceField(
        choices=DeliveryType.choices,
        default=DeliveryType.INTERNAL
    )
    delivery_partner = serializers.CharField(required=False, allow_blank=True)
    driver_name = serializers.CharField(required=False, allow_blank=True)
    driver_phone = serializers.CharField(required=False, allow_blank=True)
    vehicle_number = serializers.CharField(required=False, allow_blank=True)
    recipient_name = serializers.CharField(required=False, allow_blank=True)
    recipient_phone = serializers.CharField(required=False, allow_blank=True)
    delivery_address = serializers.CharField(required=False, allow_blank=True)
    delivery_notes = serializers.CharField(required=False, allow_blank=True)
    is_cod = serializers.BooleanField(required=False, default=False)
    cod_amount_due = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=Decimal('0.00')
    )

    def validate(self, attrs):
        order = None
        store = None

        if attrs.get('order_id'):
            try:
                order = Order.objects.select_related('customer_id', 'store_id').get(
                    id=attrs['order_id'], is_deleted=False
                )
            except Order.DoesNotExist:
                raise serializers.ValidationError({'order_id': 'Order not found.'})

        if attrs.get('store_id'):
            try:
                store = Store.objects.get(id=attrs['store_id'], is_deleted=False)
            except Store.DoesNotExist:
                raise serializers.ValidationError({'store_id': 'Store not found.'})
        elif order:
            store = order.store_id

        if not store:
            raise serializers.ValidationError({'store_id': 'Store is required.'})

        attrs['_order_instance'] = order
        attrs['_store_instance'] = store
        return attrs

    def create(self, validated_data):
        order = validated_data.pop('_order_instance', None)
        store = validated_data.pop('_store_instance')

        recipient_name = validated_data.get('recipient_name')
        recipient_phone = validated_data.get('recipient_phone')
        delivery_address = validated_data.get('delivery_address')
        is_cod = validated_data.get('is_cod', False)
        cod_amount_due = validated_data.get('cod_amount_due', Decimal('0.00'))

        # Auto-fill recipient from order if not explicitly passed
        if order:
            if not recipient_name:
                recipient_name = (
                    order.customer_name_snapshot
                    or (order.customer_id.name if order.customer_id else '')
                )
            if not recipient_phone:
                recipient_phone = (
                    order.customer_phone_snapshot
                    or (order.customer_id.mobile_number if order.customer_id else '')
                )
            if not delivery_address:
                address_parts = [
                    order.delivery_address_line1,
                    order.delivery_address_line2,
                    order.delivery_city,
                    order.delivery_state,
                    order.delivery_pincode,
                ]
                delivery_address = ', '.join([p for p in address_parts if p])

            # Determine COD if order is not fully paid
            if order.payment_status != OrderPaymentStatus.PAID and not is_cod:
                is_cod = True
                cod_amount_due = order.grand_total

        # Generate unique tracking ID: DLV-{STORE_CODE}-{YYYYMMDD}-{SEQ:04d}
        date_str = timezone.now().strftime('%Y%m%d')
        store_code = re.sub(r'[^A-Za-z0-9]', '', store.name).upper()[:4] or "STR"
        count_today = Delivery.objects.filter(
            store_id=store,
            created_at__date=timezone.now().date()
        ).count()
        seq = count_today + 1
        tracking_id = f"DLV-{store_code}-{date_str}-{seq:04d}"

        # If driver details supplied, initial state is ASSIGNED
        status = DeliveryStatus.PENDING
        if validated_data.get('driver_name'):
            status = DeliveryStatus.ASSIGNED

        delivery = Delivery.objects.create(
            store_id=store,
            order_id=order,
            invoice_id_id=validated_data.get('invoice_id'),
            tracking_id=tracking_id,
            delivery_type=validated_data.get('delivery_type', DeliveryType.INTERNAL),
            delivery_partner=validated_data.get('delivery_partner', ''),
            driver_name=validated_data.get('driver_name', ''),
            driver_phone=validated_data.get('driver_phone', ''),
            vehicle_number=validated_data.get('vehicle_number', ''),
            recipient_name=recipient_name or '',
            recipient_phone=recipient_phone or '',
            delivery_address=delivery_address or '',
            delivery_notes=validated_data.get('delivery_notes', ''),
            status=status,
            is_cod=is_cod,
            cod_amount_due=cod_amount_due,
        )
        return delivery


class AssignDriverSerializer(serializers.Serializer):
    driver_name = serializers.CharField(max_length=255, required=True)
    driver_phone = serializers.CharField(max_length=20, required=True)
    vehicle_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    delivery_partner = serializers.CharField(max_length=255, required=False, allow_blank=True)
    delivery_type = serializers.ChoiceField(
        choices=DeliveryType.choices,
        default=DeliveryType.INTERNAL
    )
    mark_out_for_delivery = serializers.BooleanField(default=False)


class VerifyOTPSerializer(serializers.Serializer):
    otp_code = serializers.CharField(max_length=6, required=True)
    cod_amount_collected = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=None,
        allow_null=True
    )
    cod_payment_method = serializers.CharField(max_length=20, required=False, default='CASH')


class UpdateStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=DeliveryStatus.choices, required=True)
    reason = serializers.CharField(required=False, allow_blank=True)
