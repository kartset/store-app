from django.db import models

from utils.models import BaseModel


class UnitOfMeasure(models.TextChoices):
    PCS = 'PCS', 'Pieces'
    KG = 'KG', 'Kilograms'
    G = 'G', 'Grams'
    LITRE = 'LITRE', 'Litres'
    ML = 'ML', 'Millilitres'
    BOX = 'BOX', 'Box'
    PACKET = 'PACKET', 'Packet'
    METER = 'METER', 'Meters'


class Product(BaseModel):
    """
    Products maintained at the Organization level with dual barcode support.
    Supports both manufacturer-printed global barcodes and in-store custom stickers.
    """
    organization_id = models.ForeignKey(
        'db.Organization',
        on_delete=models.CASCADE,
        related_name='products'
    )
    catalogue_item_id = models.ForeignKey(
        'db.CatalogueItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    category_id = models.ForeignKey(
        'db.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    subcategory_id = models.ForeignKey(
        'db.Subcategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    brand_id = models.ForeignKey(
        'db.Brand',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )

    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100)

    # Dual Barcode System
    barcode = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Global EAN-13 / UPC manufacturer barcode"
    )
    internal_barcode = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="System-generated in-store barcode sticker"
    )

    # Tax & Classification
    hsn_code = models.CharField(max_length=50, null=True, blank=True)
    tax_slab = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=18.00,
        help_text="GST Tax Rate percentage (e.g. 0.00, 5.00, 12.00, 18.00, 28.00)"
    )

    # Pricing & Valuation
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Purchase/Cost price"
    )
    base_mrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Maximum Retail Price"
    )

    # Inventory & Retail Attributes
    uom = models.CharField(
        max_length=20,
        choices=UnitOfMeasure.choices,
        default=UnitOfMeasure.PCS
    )
    description = models.TextField(null=True, blank=True)
    is_perishable = models.BooleanField(default=False)
    has_expiry = models.BooleanField(default=False)
    is_returnable = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    low_stock_threshold = models.IntegerField(default=10)

    class Meta:
        unique_together = (
            ('organization_id', 'sku'),
        )
        constraints = [
            models.UniqueConstraint(
                fields=['organization_id', 'barcode'],
                name='unique_org_manufacturer_barcode',
                condition=models.Q(barcode__isnull=False) & ~models.Q(barcode='')
            ),
            models.UniqueConstraint(
                fields=['organization_id', 'internal_barcode'],
                name='unique_org_internal_barcode',
                condition=models.Q(internal_barcode__isnull=False) & ~models.Q(internal_barcode='')
            ),
        ]
        indexes = [
            models.Index(fields=['organization_id', 'sku']),
            models.Index(fields=['organization_id', 'barcode']),
            models.Index(fields=['organization_id', 'internal_barcode']),
            models.Index(fields=['organization_id', 'subcategory_id']),
            models.Index(fields=['organization_id', 'is_active']),
        ]

    def __str__(self):
        return self.name
