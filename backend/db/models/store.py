from django.db import models
from utils.models import BaseModel

class Store(BaseModel):
    organization_id = models.ForeignKey('db.Organization', on_delete=models.CASCADE, related_name='stores')
    name = models.CharField(max_length=255)
    gst_number = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
