from django.db import models
from utils.models import BaseModel

class Order(BaseModel):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'),
    )
    store_id = models.ForeignKey('db.Store', on_delete=models.CASCADE, related_name='orders')
    customer_id = models.ForeignKey('db.Customer', on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    def __str__(self):
        return f"Order {self.id}"

class OrderItem(BaseModel):
    order_id = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product_id = models.ForeignKey('db.Product', on_delete=models.PROTECT)
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
