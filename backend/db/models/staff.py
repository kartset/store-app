from django.db import models
from utils.models import BaseModel
from django.conf import settings

class StoreStaff(BaseModel):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('MANAGER', 'Manager'),
        ('CASHIER', 'Cashier'),
    )
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_roles')
    store_id = models.ForeignKey('db.Store', on_delete=models.CASCADE, related_name='staff_members')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CASHIER')

    class Meta:
        unique_together = ('user_id', 'store_id')

    def __str__(self):
        return f"{self.user_id.email} - {self.store_id.name} ({self.role})"
