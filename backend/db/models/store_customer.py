from django.db import models
from utils.models import BaseModel

class StoreCustomer(BaseModel):
    store_id = models.ForeignKey('db.Store', on_delete=models.CASCADE, related_name='store_customers')
    customer_id = models.ForeignKey('db.Customer', on_delete=models.CASCADE, related_name='store_mappings')
    loyalty_points = models.IntegerField(default=0)
    first_visit = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('store_id', 'customer_id')

    def __str__(self):
        return f"{self.customer_id.mobile_number} - {self.store_id.name}"
