import random
from decimal import Decimal
from django.db import models
from django.utils import timezone
from utils.models import BaseModel


class DeliveryType(models.TextChoices):
    INTERNAL = 'INTERNAL', 'Internal Store Staff'
    THIRD_PARTY = 'THIRD_PARTY', 'Third Party Logistics'


class DeliveryStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Assignment'
    ASSIGNED = 'ASSIGNED', 'Assigned'
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', 'Out for Delivery'
    DELIVERED = 'DELIVERED', 'Delivered'
    FAILED = 'FAILED', 'Failed'
    RETURNED = 'RETURNED', 'Returned'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Delivery(BaseModel):
    """
    Delivery & Dispatch Model:
    Tracks order and invoice local delivery, driver assignments,
    transit milestones, secure 4-digit OTP customer handoff, and COD reconciliation.
    """
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='deliveries'
    )
    order_id = models.ForeignKey(
        'db.Order',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='deliveries'
    )
    invoice_id = models.ForeignKey(
        'db.Invoice',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='deliveries'
    )

    tracking_id = models.CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)
    delivery_type = models.CharField(
        max_length=20,
        choices=DeliveryType.choices,
        default=DeliveryType.INTERNAL
    )
    status = models.CharField(
        max_length=30,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
        db_index=True
    )
    delivery_partner = models.CharField(max_length=255, null=True, blank=True)

    # Driver / Courier Agent Details
    driver_name = models.CharField(max_length=255, null=True, blank=True)
    driver_phone = models.CharField(max_length=20, null=True, blank=True)
    vehicle_number = models.CharField(max_length=50, null=True, blank=True)

    # Customer & Address Snapshot
    recipient_name = models.CharField(max_length=255, null=True, blank=True)
    recipient_phone = models.CharField(max_length=20, null=True, blank=True)
    delivery_address = models.TextField(null=True, blank=True)
    delivery_notes = models.TextField(null=True, blank=True)

    # Secure Proof of Delivery & OTP
    otp_code = models.CharField(max_length=6, null=True, blank=True)

    # Cash on Delivery (COD) Accounting
    is_cod = models.BooleanField(default=False)
    cod_amount_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    cod_amount_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    cod_payment_method = models.CharField(max_length=20, null=True, blank=True)

    # Milestones & Audit
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store_id', 'status']),
            models.Index(fields=['tracking_id']),
            models.Index(fields=['order_id']),
        ]

    def __str__(self):
        return f"{self.tracking_id} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if not self.otp_code:
            self.otp_code = f"{random.randint(1000, 9999)}"
        super().save(*args, **kwargs)

    def assign_driver(self, driver_name: str, driver_phone: str, vehicle_number: str = None, partner: str = None, delivery_type: str = DeliveryType.INTERNAL):
        """Allocate a driver and move status to ASSIGNED."""
        self.driver_name = driver_name
        self.driver_phone = driver_phone
        self.vehicle_number = vehicle_number
        if partner:
            self.delivery_partner = partner
        self.delivery_type = delivery_type
        if self.status == DeliveryStatus.PENDING:
            self.status = DeliveryStatus.ASSIGNED
        self.save()

    def mark_out_for_delivery(self):
        """Package picked up and in transit."""
        self.status = DeliveryStatus.OUT_FOR_DELIVERY
        if not self.dispatched_at:
            self.dispatched_at = timezone.now()
        if not self.otp_code:
            self.otp_code = f"{random.randint(1000, 9999)}"
        self.save()

    def verify_and_deliver(self, entered_otp: str, cod_collected: Decimal = None, cod_method: str = 'CASH') -> bool:
        """
        Validates OTP code. On success, transitions to DELIVERED,
        stamps delivered_at, and reconciles COD collection.
        """
        if str(entered_otp).strip() != str(self.otp_code).strip():
            return False

        self.status = DeliveryStatus.DELIVERED
        self.delivered_at = timezone.now()

        if self.is_cod and cod_collected is not None:
            self.cod_amount_collected = Decimal(str(cod_collected))
            self.cod_payment_method = cod_method

        self.save()
        return True

    def mark_failed(self, reason: str):
        """Customer unreachable, wrong address, rejected package."""
        self.status = DeliveryStatus.FAILED
        self.failure_reason = reason
        self.save()

    def mark_returned(self, reason: str = None):
        """Package returned back to store."""
        self.status = DeliveryStatus.RETURNED
        if reason:
            self.failure_reason = reason
        self.save()

    def cancel(self, reason: str = None):
        """Cancelled delivery."""
        self.status = DeliveryStatus.CANCELLED
        if reason:
            self.failure_reason = reason
        self.save()
