from django.db import models
from utils.models import BaseModel

class Organization(BaseModel):
    name = models.CharField(max_length=255)
    subdomain = models.CharField(max_length=255, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
