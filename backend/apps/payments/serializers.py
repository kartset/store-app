from decimal import Decimal
from rest_framework import serializers
from db.models import Invoice, Payment, PaymentMethod


class CreateOrderRequestSerializer(serializers.Serializer):
    invoice_id = serializers.UUIDField(required=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    method = serializers.ChoiceField(
        choices=[PaymentMethod.UPI, PaymentMethod.CARD, PaymentMethod.RAZORPAY],
        default=PaymentMethod.UPI
    )
    vpa = serializers.CharField(max_length=100, required=False, allow_blank=True)


class CreateOrderResponseSerializer(serializers.Serializer):
    gateway_order_id = serializers.CharField()
    payment_id = serializers.UUIDField()
    invoice_id = serializers.UUIDField()
    invoice_number = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(default='INR')
    intent_uri = serializers.CharField(required=False, allow_blank=True)
    vpa = serializers.CharField(required=False, allow_blank=True)
    payee_name = serializers.CharField(required=False, allow_blank=True)
    transaction_ref = serializers.CharField()
    mode = serializers.CharField()


class VerifyPaymentRequestSerializer(serializers.Serializer):
    invoice_id = serializers.UUIDField(required=True)
    payment_id = serializers.UUIDField(required=False, allow_null=True)
    razorpay_order_id = serializers.CharField(required=True)
    razorpay_payment_id = serializers.CharField(required=True)
    razorpay_signature = serializers.CharField(required=True)


class PaymentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id',
            'invoice_id',
            'method',
            'amount',
            'status',
            'external_transaction_id',
            'gateway_order_id',
            'created_at',
            'updated_at',
        ]
