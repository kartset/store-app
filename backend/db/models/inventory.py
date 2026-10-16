from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from utils.models import BaseModel

__all__ = ['Inventory', 'StockMovement', 'StockMovementType']


class StockMovementType(models.TextChoices):
    PURCHASE_RECEIPT = 'PURCHASE_RECEIPT', 'Goods Received / Purchase'
    POS_SALE = 'POS_SALE', 'Point of Sale'
    RETURN_RESTOCK = 'RETURN_RESTOCK', 'Customer Return / Restock'
    DAMAGE_WASTE = 'DAMAGE_WASTE', 'Damage / Expiry / Shrinkage'
    AUDIT_ADJUSTMENT = 'AUDIT_ADJUSTMENT', 'Audit / Physical Count Adjustment'
    TRANSFER_IN = 'TRANSFER_IN', 'Inter-Store Transfer In'
    TRANSFER_OUT = 'TRANSFER_OUT', 'Inter-Store Transfer Out'
    INITIAL_STOCK = 'INITIAL_STOCK', 'Initial Stock Opening Balance'


class Inventory(BaseModel):
    """
    Inventory maintained at the store level.
    Tracks stock quantities, store-level pricing overrides, batch details,
    low stock thresholds, and maintains an immutable movement audit trail.
    """
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='inventory'
    )
    product_id = models.ForeignKey(
        'db.Product',
        on_delete=models.CASCADE,
        related_name='inventory'
    )
    vendor_id = models.ForeignKey(
        'db.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory'
    )
    stock_quantity = models.IntegerField(default=0)
    store_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Store-level price override. If null, product base_mrp is used."
    )
    low_stock_threshold = models.IntegerField(
        default=10,
        help_text="Threshold below which inventory triggers low-stock alerts."
    )
    reorder_quantity = models.IntegerField(
        default=50,
        help_text="Recommended reorder quantity for stock replenishment."
    )
    batch_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Current lot / batch identification number."
    )
    last_restocked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of the most recent stock replenishment."
    )

    class Meta:
        verbose_name_plural = 'Inventories'
        unique_together = ('store_id', 'product_id')
        indexes = [
            models.Index(fields=['store_id', 'product_id']),
            models.Index(fields=['store_id', 'stock_quantity']),
        ]

    def __str__(self):
        return f"{self.product_id.name} @ {self.store_id.name} ({self.stock_quantity} in stock)"

    @property
    def is_low_stock(self) -> bool:
        """Indicates if current stock is at or below the reorder threshold."""
        return self.stock_quantity <= self.low_stock_threshold

    @property
    def effective_price(self):
        """Returns the store-specific price override or falls back to product base MRP."""
        if self.store_price is not None:
            return self.store_price
        return getattr(self.product_id, 'base_mrp', None)

    @transaction.atomic
    def adjust_stock(
        self,
        quantity_delta: int,
        movement_type: str,
        reason: str = '',
        user=None,
        reference_id: str | None = None,
        notes: str = '',
        allow_negative: bool = False,
        vendor=None,
    ):
        """
        Atomically adjusts stock quantity and writes an immutable StockMovement audit record.
        Uses select_for_update to guard against race conditions in concurrent POS/GRN operations.
        """
        locked_inv = Inventory.objects.select_for_update().get(pk=self.pk)

        quantity_before = locked_inv.stock_quantity
        quantity_after = quantity_before + quantity_delta

        if quantity_after < 0 and not allow_negative:
            raise ValidationError(
                f"Insufficient stock for product '{locked_inv.product_id.name}' at store '{locked_inv.store_id.name}'. "
                f"Current: {quantity_before}, Requested deduction: {-quantity_delta}."
            )

        locked_inv.stock_quantity = quantity_after
        if quantity_delta > 0 and movement_type in {
            StockMovementType.PURCHASE_RECEIPT,
            StockMovementType.RETURN_RESTOCK,
            StockMovementType.INITIAL_STOCK,
            StockMovementType.TRANSFER_IN,
        }:
            locked_inv.last_restocked_at = timezone.now()

        if vendor:
            locked_inv.vendor_id = vendor

        if user:
            locked_inv.updated_by = user

        locked_inv.save()

        # Reflect updated fields on current instance
        self.stock_quantity = locked_inv.stock_quantity
        self.last_restocked_at = locked_inv.last_restocked_at
        self.vendor_id = locked_inv.vendor_id
        self.updated_at = locked_inv.updated_at

        # Record immutable audit ledger entry
        movement = StockMovement.objects.create(
            inventory_id=locked_inv,
            store_id=locked_inv.store_id,
            product_id=locked_inv.product_id,
            vendor_id=vendor or (locked_inv.vendor_id if movement_type == StockMovementType.PURCHASE_RECEIPT else None),
            movement_type=movement_type,
            quantity_delta=quantity_delta,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            reason=reason or '',
            reference_id=reference_id,
            notes=notes or '',
            created_by=user,
        )

        return movement


class StockMovement(BaseModel):
    """
    Immutable audit ledger for every stock change (sales, GRN receipts, damage, audit adjustments).
    """
    inventory_id = models.ForeignKey(
        'db.Inventory',
        on_delete=models.CASCADE,
        related_name='movements'
    )
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='stock_movements'
    )
    product_id = models.ForeignKey(
        'db.Product',
        on_delete=models.CASCADE,
        related_name='stock_movements'
    )
    vendor_id = models.ForeignKey(
        'db.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements',
        help_text="Supplier delivering consignment for purchase receipts or restocks."
    )
    movement_type = models.CharField(
        max_length=30,
        choices=StockMovementType.choices,
        help_text="Categorized operational reason for the stock movement."
    )
    quantity_delta = models.IntegerField(
        help_text="Quantity delta: positive for incoming stock, negative for deductions."
    )
    quantity_before = models.IntegerField(
        help_text="Stock quantity immediately before this movement."
    )
    quantity_after = models.IntegerField(
        help_text="Stock quantity immediately after this movement."
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Brief human-readable reason or classification."
    )
    reference_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="External document reference (e.g. Invoice #, GRN PO #, Transfer Order #)."
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Detailed notes or remarks from store staff or auditor."
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['inventory_id', 'created_at']),
            models.Index(fields=['store_id', 'created_at']),
            models.Index(fields=['product_id', 'created_at']),
            models.Index(fields=['vendor_id', 'created_at']),
            models.Index(fields=['movement_type', 'created_at']),
        ]

    def __str__(self):
        sign = '+' if self.quantity_delta > 0 else ''
        return f"{self.product_id.name} @ {self.store_id.name}: {sign}{self.quantity_delta} ({self.movement_type})"