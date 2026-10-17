import re
from decimal import Decimal

from django.db import models
from django.utils import timezone

from utils.models import BaseModel

__all__ = [
    'FulfillmentType',
    'Order',
    'OrderItem',
    'OrderPaymentStatus',
    'OrderStatus',
    'generate_order_number',
]


class OrderStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Confirmation'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    PACKED = 'PACKED', 'Packed'
    READY_FOR_PICKUP = 'READY_FOR_PICKUP', 'Ready for Pickup / Out for Delivery'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class FulfillmentType(models.TextChoices):
    STORE_PICKUP = 'STORE_PICKUP', 'Store Pickup / Click & Collect'
    HOME_DELIVERY = 'HOME_DELIVERY', 'Home Delivery'
    COUNTER_HOLD = 'COUNTER_HOLD', 'Counter Hold'


class OrderPaymentStatus(models.TextChoices):
    UNPAID = 'UNPAID', 'Unpaid'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    PAID = 'PAID', 'Paid'


def generate_order_number(store, order_date=None) -> str:
    """
    Generates a sequential, store-prefixed, date-based order number.
    Format: ORD-{STORE_CODE}-{YYYYMMDD}-{SEQ:04d}
    Example: ORD-CONN-20261018-0001
    """
    if not order_date:
        order_date = timezone.now().date()

    store_code = re.sub(r'[^A-Za-z0-9]', '', store.name).upper()[:4] or "STR"
    date_str = order_date.strftime("%Y%m%d")
    prefix = f"ORD-{store_code}-{date_str}-"

    last_order = Order.objects.filter(
        store_id=store,
        order_number__startswith=prefix
    ).order_by('-order_number').first()

    if last_order and last_order.order_number:
        try:
            last_seq = int(last_order.order_number.split('-')[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:04d}"
    while Order.objects.filter(order_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:04d}"

    return candidate


class Order(BaseModel):
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='orders'
    )
    customer_id = models.ForeignKey(
        'db.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )
    invoice_id = models.ForeignKey(
        'db.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_orders'
    )
    order_number = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Unique human-readable order number e.g. ORD-CONN-20261018-0001"
    )
    status = models.CharField(
        max_length=30,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
        db_index=True
    )
    fulfillment_type = models.CharField(
        max_length=30,
        choices=FulfillmentType.choices,
        default=FulfillmentType.STORE_PICKUP,
        db_index=True
    )
    payment_status = models.CharField(
        max_length=30,
        choices=OrderPaymentStatus.choices,
        default=OrderPaymentStatus.UNPAID,
        db_index=True
    )

    # Financial Totals
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Customer Snapshot (protect against customer record modifications/deletions)
    customer_name_snapshot = models.CharField(max_length=255, blank=True, default='')
    customer_phone_snapshot = models.CharField(max_length=30, blank=True, default='', db_index=True)
    customer_email_snapshot = models.CharField(max_length=255, blank=True, default='')

    # Delivery & Shipping Address Snapshot
    delivery_address_line1 = models.CharField(max_length=255, blank=True, default='')
    delivery_address_line2 = models.CharField(max_length=255, blank=True, default='')
    delivery_city = models.CharField(max_length=100, blank=True, default='')
    delivery_state = models.CharField(max_length=100, blank=True, default='')
    delivery_pincode = models.CharField(max_length=20, blank=True, default='')
    delivery_notes = models.TextField(blank=True, default='')

    # Lifecycle & Status Transition Timestamps
    confirmed_at = models.DateTimeField(null=True, blank=True)
    packed_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, default='')

    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store_id', 'status']),
            models.Index(fields=['store_id', '-created_at']),
            models.Index(fields=['order_number']),
            models.Index(fields=['customer_phone_snapshot']),
        ]

    def __str__(self):
        return f"{self.order_number or self.id} ({self.status}) - ₹{self.grand_total}"

    def save(self, *args, **kwargs):
        if not self.order_number and self.store_id:
            self.order_number = generate_order_number(self.store_id)
        super().save(*args, **kwargs)

    @property
    def total_amount(self):
        return self.grand_total


class OrderItem(BaseModel):
    order_id = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product_id = models.ForeignKey(
        'db.Product',
        on_delete=models.PROTECT,
        related_name='order_items'
    )
    product_name_snapshot = models.CharField(max_length=255, blank=True, default='')
    sku_snapshot = models.CharField(max_length=100, blank=True, default='')
    barcode_snapshot = models.CharField(max_length=100, blank=True, default='')

    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_slab = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.product_name_snapshot or self.product_id.name} x {self.quantity}"

    @property
    def price(self):
        return self.unit_price
