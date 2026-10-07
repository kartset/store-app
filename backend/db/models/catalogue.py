from django.db import models
from utils.models import BaseModel

class CatalogueItem(BaseModel):
    """Global entry for all products available to be entered on the app level, maintained by us"""
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, unique=True)
    hsn_code = models.CharField(max_length=50, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.name
