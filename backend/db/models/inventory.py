from django.db import models
from utils.models import BaseModel

class Inventory(BaseModel):
    """Inventory maintained at the store level"""
    store_id = models.ForeignKey('db.Store', on_delete=models.CASCADE, related_name='inventory')
    product_id = models.ForeignKey('db.Product', on_delete=models.CASCADE, related_name='inventory')
    vendor_id = models.ForeignKey('db.Vendor', on_delete=models.SET_NULL, null=True, blank=True)
    stock_quantity = models.IntegerField(default=0)
    store_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ('store_id', 'product_id')

    def __str__(self):
        return f"{self.product_id.name} @ {self.store_id.name}"