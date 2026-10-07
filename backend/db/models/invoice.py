from django.db import models
from utils.models import BaseModel

class Invoice(BaseModel):
    TYPE_CHOICES = (
        ('POS', 'Point of Sale'),
        ('ONLINE', 'Online Order'),
        ('RETURN', 'Return'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    )
    store_id = models.ForeignKey('db.Store', on_delete=models.CASCADE, related_name='invoices')
    customer_id = models.ForeignKey('db.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='POS')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_gst = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def __str__(self):
        return f"Invoice {self.id}"

class InvoiceItem(BaseModel):
    invoice_id = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    product_id = models.ForeignKey('db.Product', on_delete=models.PROTECT)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

class Payment(BaseModel):
    METHOD_CHOICES = (
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
        ('UPI', 'UPI'),
        ('RAZORPAY', 'Razorpay'),
    )
    invoice_id = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='CASH')
    external_transaction_id = models.CharField(max_length=255, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=50, default='SUCCESS')
