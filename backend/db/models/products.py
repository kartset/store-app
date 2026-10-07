from django.db import models
from utils.models import BaseModel

class Product(BaseModel):
    """Products maintained at the organization level"""
    organization_id = models.ForeignKey('db.Organization', on_delete=models.CASCADE, related_name='products')
    catalogue_item_id = models.ForeignKey('db.CatalogueItem', on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100)
    hsn_code = models.CharField(max_length=50, null=True, blank=True)
    base_mrp = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ('organization_id', 'sku')

    def __str__(self):
        return self.name
