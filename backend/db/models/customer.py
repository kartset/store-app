from django.db import models
from utils.models import BaseModel
from django.conf import settings

class Customer(BaseModel):
    user_id = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_profile')
    mobile_number = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)

    def __str__(self):
        return self.mobile_number
