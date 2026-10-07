from django.db import models
from utils.models import BaseModel

class Vendor(BaseModel):
    organization_id = models.ForeignKey('db.Organization', on_delete=models.CASCADE, related_name='vendors')
    name = models.CharField(max_length=255)
    contact_info = models.TextField(null=True, blank=True)
    gst_number = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return self.name
