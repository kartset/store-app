from django.db import models

from utils.models import BaseModel

__all__ = ['Customer', 'CustomerType']


class CustomerType(models.TextChoices):
    RETAIL = 'RETAIL', 'Retail Consumer (B2C)'
    B2B = 'B2B', 'Business / Wholesale (B2B)'


class Customer(BaseModel):
    user_id = models.OneToOneField(
        'db.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_profile',
        help_text="Optional link to system User account if customer has portal access."
    )
    mobile_number = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        help_text="Primary unique identifier for POS checkout (e.g. 10-digit mobile number)."
    )
    name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Customer full legal or display name."
    )
    email = models.EmailField(
        null=True,
        blank=True,
        help_text="Optional customer email address."
    )
    customer_type = models.CharField(
        max_length=20,
        choices=CustomerType.choices,
        default=CustomerType.RETAIL,
        help_text="Classification for tax invoicing (B2C retail vs B2B wholesale)."
    )
    gstin = models.CharField(
        max_length=15,
        null=True,
        blank=True,
        db_index=True,
        help_text="15-character Goods and Services Tax Identification Number for B2B billing."
    )
    pan_number = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        help_text="10-character Permanent Account Number."
    )
    address_line1 = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Flat / House No., Building Name, Street"
    )
    address_line2 = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Locality, Landmark"
    )
    city = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="City / Town"
    )
    state = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="State / Union Territory"
    )
    pincode = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        help_text="Postal PIN Code"
    )
    date_of_birth = models.DateField(
        null=True,
        blank=True,
        help_text="Birth date for loyalty greetings / birthday discounts."
    )
    anniversary_date = models.DateField(
        null=True,
        blank=True,
        help_text="Anniversary date for celebratory discounts."
    )
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Staff or CRM notes."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether customer account is active."
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['mobile_number']),
            models.Index(fields=['name']),
            models.Index(fields=['customer_type']),
            models.Index(fields=['gstin']),
        ]

    def __str__(self):
        display = self.name or 'Unknown Customer'
        return f"{display} ({self.mobile_number})"
