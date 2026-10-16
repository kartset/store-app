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


class CatalogueItem(BaseModel):
    """
    Global entry for all products available across the platform (Tier 1 Global Product Register).
    Maintained centrally by platform admins and reference catalogs.
    """
    name = models.CharField(max_length=255)
    sku = models.CharField(
        max_length=100,
        unique=True,
        help_text="Canonical global SKU/Item code"
    )
    barcode = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        help_text="Universal EAN-13 / UPC manufacturer barcode"
    )
    brand_name = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        help_text="Manufacturer or brand name"
    )
    category_name = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        help_text="Standard category classification suggestion"
    )
    hsn_code = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Harmonized System Nomenclature code for GST"
    )
    tax_slab = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=18.00,
        help_text="Default standard GST Tax Rate percentage (e.g. 0.00, 5.00, 12.00, 18.00, 28.00)"
    )
    uom = models.CharField(
        max_length=20,
        choices=UnitOfMeasure.choices,
        default=UnitOfMeasure.PCS,
        help_text="Default unit of measure"
    )
    suggested_mrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Suggested Maximum Retail Price (reference)"
    )
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['barcode']),
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"

