from decimal import Decimal
from rest_framework import serializers
from db.models import (
    CashRegisterSession,
    CashTransaction,
    CashTransactionType,
    RegisterSessionStatus,
    Store,
)


class CashTransactionSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice_id.invoice_number', read_only=True)

    class Meta:
        model = CashTransaction
        fields = [
            'id',
            'created_at',
            'session_id',
            'type',
            'amount',
            'invoice_id',
            'invoice_number',
            'payment_id',
            'reason',
        ]
        read_only_fields = ['id', 'created_at']


class CashRegisterSessionSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store_id.name', read_only=True)
    cashier_name = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()
    transactions = CashTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = CashRegisterSession
        fields = [
            'id',
            'created_at',
            'updated_at',
            'store_id',
            'store_name',
            'cashier_id',
            'cashier_name',
            'session_number',
            'status',
            'opened_at',
            'closed_at',
            'opening_float',
            'closing_cash_counted',
            'expected_cash',
            'cash_variance',
            'total_cash_sales',
            'total_card_sales',
            'total_upi_sales',
            'total_credit_sales',
            'total_sales',
            'invoices_count',
            'denomination_breakdown',
            'closing_notes',
            'closed_by',
            'closed_by_name',
            'transactions',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'session_number',
            'expected_cash',
            'cash_variance',
            'total_cash_sales',
            'total_card_sales',
            'total_upi_sales',
            'total_credit_sales',
            'total_sales',
            'invoices_count',
            'transactions',
        ]

    def get_cashier_name(self, obj) -> str:
        if not obj.cashier_id:
            return ''
        name = f"{obj.cashier_id.first_name or ''} {obj.cashier_id.last_name or ''}".strip()
        return name or obj.cashier_id.email or 'Cashier'

    def get_closed_by_name(self, obj) -> str:
        if not obj.closed_by:
            return ''
        name = f"{obj.closed_by.first_name or ''} {obj.closed_by.last_name or ''}".strip()
        return name or obj.closed_by.email or 'Manager'


class OpenRegisterRequestSerializer(serializers.Serializer):
    store_id = serializers.UUIDField(required=True)
    opening_float = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=Decimal('0.00'),
        min_value=Decimal('0.00'),
    )


class CashDropRequestSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=True,
        min_value=Decimal('0.01'),
    )
    type = serializers.ChoiceField(
        choices=[CashTransactionType.CASH_DROP, CashTransactionType.PETTY_PAYOUT],
        default=CashTransactionType.CASH_DROP,
    )
    reason = serializers.CharField(max_length=255, required=True)


class CloseRegisterRequestSerializer(serializers.Serializer):
    closing_cash_counted = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=True,
        min_value=Decimal('0.00'),
    )
    denomination_breakdown = serializers.DictField(
        required=False,
        default=dict,
    )
    closing_notes = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        default='',
    )
