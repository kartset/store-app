from django.db import models
from utils.models import BaseModel

class Delivery(BaseModel):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('OUT_FOR_DELIVERY', 'Out for Delivery'),
        ('DELIVERED', 'Delivered'),
        ('FAILED', 'Failed'),
    )
    invoice_id = models.ForeignKey('db.Invoice', on_delete=models.CASCADE, null=True, blank=True, related_name='deliveries')
    order_id = models.ForeignKey('db.Order', on_delete=models.CASCADE, null=True, blank=True, related_name='deliveries')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='PENDING')
    tracking_id = models.CharField(max_length=255, null=True, blank=True)
    delivery_partner = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"Delivery {self.id} - {self.status}"
