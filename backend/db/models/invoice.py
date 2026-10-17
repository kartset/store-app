import re
from decimal import Decimal

from django.db import models
from django.utils import timezone

from utils.models import BaseModel

__all__ = [
    'Invoice',
    'InvoiceItem',
    'InvoiceStatus',
    'InvoiceType',
    'Payment',
    'PaymentMethod',
    'generate_invoice_number',
]


class InvoiceType(models.TextChoices):
    POS = 'POS', 'Point of Sale'
    ONLINE = 'ONLINE', 'Online Order'
    RETURN = 'RETURN', 'Customer Return / Credit Note'


class InvoiceStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PAID = 'PAID', 'Paid'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    CANCELLED = 'CANCELLED', 'Cancelled'


class PaymentMethod(models.TextChoices):
    CASH = 'CASH', 'Cash'
    CARD = 'CARD', 'Credit / Debit Card'
    UPI = 'UPI', 'UPI / QR Code'
    RAZORPAY = 'RAZORPAY', 'Razorpay Gateway'
    STORE_CREDIT = 'STORE_CREDIT', 'Store Credit / Khata'
    LOYALTY_POINTS = 'LOYALTY_POINTS', 'Loyalty Points Redemption'


def generate_invoice_number(store, invoice_date=None) -> str:
    """
    Generates a sequential, store-prefixed, date-based invoice number.
    Format: INV-{STORE_CODE}-{YYYYMMDD}-{SEQ:04d}
    Example: INV-CONN-20261017-0001
    """
    if not invoice_date:
        invoice_date = timezone.now().date()

    store_code = re.sub(r'[^A-Za-z0-9]', '', store.name).upper()[:4] or "STR"
    date_str = invoice_date.strftime("%Y%m%d")
    prefix = f"INV-{store_code}-{date_str}-"

    last_inv = Invoice.objects.filter(
        store_id=store,
        invoice_number__startswith=prefix
    ).order_by('-invoice_number').first()

    if last_inv and last_inv.invoice_number:
        try:
            last_seq = int(last_inv.invoice_number.split('-')[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:04d}"
    # Safety loop in case of race condition
    while Invoice.objects.filter(invoice_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:04d}"

    return candidate


class Invoice(BaseModel):
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    customer_id = models.ForeignKey(
        'db.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices'
    )
    register_session_id = models.ForeignKey(
        'db.CashRegisterSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices'
    )
    invoice_number = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Unique human-readable invoice identifier e.g. INV-STR01-20261017-0001"
    )
    type = models.CharField(
        max_length=20,
        choices=InvoiceType.choices,
        default=InvoiceType.POS
    )
    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.DRAFT
    )

    # Financial Totals & Tax Breakups
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # GST Breakup (Intra-State CGST+SGST vs Inter-State IGST)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_gst = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Adjustments & Net Total
    round_off = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    is_tax_inclusive = models.BooleanField(
        default=True,
        help_text="Indicates whether item retail prices were tax-inclusive."
    )

    # Customer & Loyalty Snapshot
    loyalty_points_redeemed = models.IntegerField(default=0)
    loyalty_discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    loyalty_points_earned = models.IntegerField(default=0)
    customer_name_snapshot = models.CharField(max_length=255, blank=True, default='')
    customer_phone_snapshot = models.CharField(max_length=20, blank=True, default='')
    customer_gstin_snapshot = models.CharField(max_length=15, blank=True, default='')

    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store_id', 'status']),
            models.Index(fields=['store_id', '-created_at']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['customer_phone_snapshot']),
        ]

    def __str__(self):
        return f"{self.invoice_number or self.id} ({self.status}) - ₹{self.grand_total}"

    def save(self, *args, **kwargs):
        if not self.invoice_number and self.store_id:
            self.invoice_number = generate_invoice_number(self.store_id)
        super().save(*args, **kwargs)


class InvoiceItem(BaseModel):
    invoice_id = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product_id = models.ForeignKey(
        'db.Product',
        on_delete=models.PROTECT,
        related_name='invoice_items'
    )
    product_name_snapshot = models.CharField(max_length=255, blank=True, default='')
    sku_snapshot = models.CharField(max_length=100, blank=True, default='')
    barcode_snapshot = models.CharField(max_length=100, blank=True, default='')
    hsn_code = models.CharField(max_length=50, blank=True, default='')

    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Taxes
    tax_slab = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    def __str__(self):
        return f"{self.product_name_snapshot or self.product_id.name} x {self.quantity}"

    @property
    def returned_quantity(self) -> int:
        return sum(
            self.return_items.filter(credit_note_id__status='COMPLETED', is_deleted=False).values_list('quantity', flat=True)
        )

    @property
    def returnable_quantity(self) -> int:
        return max(0, self.quantity - self.returned_quantity)


class Payment(BaseModel):
    invoice_id = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH
    )
    external_transaction_id = models.CharField(max_length=255, null=True, blank=True)
    gateway_order_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    gateway_signature = models.CharField(max_length=255, null=True, blank=True)
    gateway_response = models.JSONField(null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    amount_tendered = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    change_returned = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=50, default='SUCCESS')

    def __str__(self):
        return f"{self.method}: ₹{self.amount} ({self.status})"
