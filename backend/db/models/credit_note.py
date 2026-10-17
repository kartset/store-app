import re
from decimal import Decimal

from django.db import models
from django.utils import timezone

from utils.models import BaseModel

__all__ = [
    'CreditNote',
    'CreditNoteItem',
    'CreditNoteStatus',
    'RefundMethod',
    'ReturnReason',
    'generate_credit_note_number',
]


class ReturnReason(models.TextChoices):
    DEFECTIVE = 'DEFECTIVE', 'Defective / Damaged Product'
    WRONG_ITEM = 'WRONG_ITEM', 'Wrong Item / Size / Color'
    EXPIRED = 'EXPIRED', 'Near Expiry or Expired'
    CUSTOMER_DISSATISFACTION = 'CUSTOMER_DISSATISFACTION', 'Customer Not Satisfied'
    OTHER = 'OTHER', 'Other / Exchange'


class CreditNoteStatus(models.TextChoices):
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class RefundMethod(models.TextChoices):
    CASH = 'CASH', 'Cash Refund'
    UPI = 'UPI', 'UPI / Online Refund'
    STORE_CREDIT = 'STORE_CREDIT', 'Store Credit / Wallet'
    ORIGINAL_PAYMENT = 'ORIGINAL_PAYMENT', 'Original Payment Method'


def generate_credit_note_number(store, return_date=None) -> str:
    """
    Format: CN-{STORE_CODE}-{YYYYMMDD}-{SEQ:04d}
    Example: CN-CONN-20261017-0001
    """
    if not return_date:
        return_date = timezone.now().date()

    store_code = re.sub(r'[^A-Za-z0-9]', '', store.name).upper()[:4] or "STR"
    date_str = return_date.strftime("%Y%m%d")
    prefix = f"CN-{store_code}-{date_str}-"

    last_cn = CreditNote.objects.filter(
        store_id=store,
        credit_note_number__startswith=prefix
    ).order_by('-credit_note_number').first()

    if last_cn and last_cn.credit_note_number:
        try:
            last_seq = int(last_cn.credit_note_number.split('-')[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:04d}"
    while CreditNote.objects.filter(credit_note_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:04d}"

    return candidate


class CreditNote(BaseModel):
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='credit_notes'
    )
    invoice_id = models.ForeignKey(
        'db.Invoice',
        on_delete=models.CASCADE,
        related_name='credit_notes'
    )
    customer_id = models.ForeignKey(
        'db.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='credit_notes'
    )
    register_session_id = models.ForeignKey(
        'db.CashRegisterSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='credit_notes'
    )
    credit_note_number = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Unique credit note identifier e.g. CN-STR01-20261017-0001"
    )
    status = models.CharField(
        max_length=20,
        choices=CreditNoteStatus.choices,
        default=CreditNoteStatus.COMPLETED
    )
    refund_method = models.CharField(
        max_length=20,
        choices=RefundMethod.choices,
        default=RefundMethod.CASH
    )
    reason = models.CharField(
        max_length=50,
        choices=ReturnReason.choices,
        default=ReturnReason.CUSTOMER_DISSATISFACTION
    )

    # Financial Breakup
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_discount_reversed = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_gst = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Loyalty Points Revocation
    loyalty_points_deducted = models.IntegerField(default=0)

    notes = models.TextField(blank=True, default='')
    processed_by = models.ForeignKey(
        'db.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_credit_notes'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store_id', '-created_at']),
            models.Index(fields=['credit_note_number']),
            models.Index(fields=['invoice_id']),
        ]

    def save(self, *args, **kwargs):
        if not self.credit_note_number and self.store_id:
            self.credit_note_number = generate_credit_note_number(self.store_id)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.credit_note_number or self.id} for Invoice {self.invoice_id.invoice_number} - ₹{self.total_refund_amount}"


class CreditNoteItem(BaseModel):
    credit_note_id = models.ForeignKey(
        CreditNote,
        on_delete=models.CASCADE,
        related_name='items'
    )
    invoice_item_id = models.ForeignKey(
        'db.InvoiceItem',
        on_delete=models.CASCADE,
        related_name='return_items'
    )
    product_id = models.ForeignKey(
        'db.Product',
        on_delete=models.PROTECT,
        related_name='credit_note_items'
    )
    product_name_snapshot = models.CharField(max_length=255, blank=True, default='')
    sku_snapshot = models.CharField(max_length=100, blank=True, default='')
    hsn_code = models.CharField(max_length=50, blank=True, default='')

    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_reversed = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    tax_slab = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    restock_inventory = models.BooleanField(default=True)
    reason = models.CharField(max_length=50, blank=True, default='')

    def __str__(self):
        return f"{self.product_name_snapshot} x {self.quantity} (Refund: ₹{self.refund_amount})"
