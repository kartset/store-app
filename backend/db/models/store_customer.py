from decimal import Decimal

from django.db import models

from utils.models import BaseModel

__all__ = ['StoreCustomer']


class StoreCustomer(BaseModel):
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='store_customers'
    )
    customer_id = models.ForeignKey(
        'db.Customer',
        on_delete=models.CASCADE,
        related_name='store_mappings'
    )
    loyalty_points = models.IntegerField(
        default=0,
        help_text="Accrued loyalty reward points at this specific store."
    )
    credit_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Maximum allowed credit (khata) limit for this customer at this store."
    )
    outstanding_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Current outstanding unpaid credit balance."
    )
    first_visit = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp of customer's first interaction or purchase at this store."
    )
    last_visit = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of customer's most recent interaction or checkout."
    )
    total_visits = models.IntegerField(
        default=1,
        help_text="Cumulative number of store visits / checkouts."
    )

    class Meta:
        unique_together = ('store_id', 'customer_id')
        indexes = [
            models.Index(fields=['store_id', 'customer_id']),
            models.Index(fields=['store_id', 'loyalty_points']),
        ]

    def __str__(self):
        return f"{self.customer_id.mobile_number} @ {self.store_id.name} ({self.loyalty_points} pts)"
