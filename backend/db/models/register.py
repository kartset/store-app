import re
from decimal import Decimal

from django.db import models
from django.utils import timezone

from utils.models import BaseModel

__all__ = [
    'CashRegisterSession',
    'CashTransaction',
    'CashTransactionType',
    'RegisterSessionStatus',
    'generate_session_number',
]


class RegisterSessionStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    CLOSED = 'CLOSED', 'Closed'


class CashTransactionType(models.TextChoices):
    OPENING_FLOAT = 'OPENING_FLOAT', 'Opening Cash Float'
    CASH_SALE = 'CASH_SALE', 'Cash Sale Inflow'
    CASH_REFUND = 'CASH_REFUND', 'Cash Return Outflow'
    CASH_DROP = 'CASH_DROP', 'Cash Drop to Store Safe'
    PETTY_PAYOUT = 'PETTY_PAYOUT', 'Petty Cash Store Expense'


def generate_session_number(store, session_date=None) -> str:
    """
    Generates a sequential register shift session number.
    Format: SHIFT-{STORE_CODE}-{YYYYMMDD}-{SEQ:03d}
    Example: SHIFT-CONN-20261017-001
    """
    if not session_date:
        session_date = timezone.now().date()

    store_code = re.sub(r'[^A-Za-z0-9]', '', store.name).upper()[:4] or "STR"
    date_str = session_date.strftime("%Y%m%d")
    prefix = f"SHIFT-{store_code}-{date_str}-"

    last_session = CashRegisterSession.objects.filter(
        store_id=store,
        session_number__startswith=prefix
    ).order_by('-session_number').first()

    if last_session and last_session.session_number:
        try:
            last_seq = int(last_session.session_number.split('-')[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:03d}"
    while CashRegisterSession.objects.filter(session_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:03d}"

    return candidate


class CashRegisterSession(BaseModel):
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='register_sessions'
    )
    cashier_id = models.ForeignKey(
        'db.User',
        on_delete=models.PROTECT,
        related_name='register_sessions'
    )
    session_number = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Sequential register shift identifier e.g. SHIFT-STR01-20261017-001"
    )
    status = models.CharField(
        max_length=20,
        choices=RegisterSessionStatus.choices,
        default=RegisterSessionStatus.OPEN,
        db_index=True
    )
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)

    opening_float = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Initial cash in drawer at start of shift"
    )
    closing_cash_counted = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Physical cash counted by cashier at end of shift"
    )
    expected_cash = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Expected cash: opening_float + cash_sales - cash_drops - payouts"
    )
    cash_variance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Variance: closing_cash_counted - expected_cash (+ overage, - shortage)"
    )

    # Aggregated totals for shift
    total_cash_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_card_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_upi_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_credit_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    invoices_count = models.IntegerField(default=0)

    denomination_breakdown = models.JSONField(
        default=dict,
        blank=True,
        help_text="Physical denomination counts e.g. {'2000': 0, '500': 4, '200': 10, ...}"
    )
    closing_notes = models.TextField(blank=True, default='')
    closed_by = models.ForeignKey(
        'db.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='closed_register_sessions'
    )

    class Meta:
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['store_id', 'status']),
            models.Index(fields=['cashier_id', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.session_number and self.store_id:
            self.session_number = generate_session_number(self.store_id)
        if not self.expected_cash and self.opening_float and not self.pk:
            self.expected_cash = self.opening_float
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.session_number or 'SHIFT'} - {self.store_id.name} ({self.status})"


class CashTransaction(BaseModel):
    session_id = models.ForeignKey(
        CashRegisterSession,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    type = models.CharField(
        max_length=20,
        choices=CashTransactionType.choices,
        db_index=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    invoice_id = models.ForeignKey(
        'db.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_transactions'
    )
    payment_id = models.ForeignKey(
        'db.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_transactions'
    )
    reason = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.type}: ₹{self.amount} ({self.session_id.session_number})"
