from decimal import Decimal
from django.db import models
from django.utils import timezone

from utils.models import BaseModel

__all__ = [
    'GSTFilingPeriod',
    'GSTReturnType',
    'GSTFilingStatus',
]


class GSTReturnType(models.TextChoices):
    GSTR1 = 'GSTR1', 'GSTR-1 Outward Supplies'
    GSTR3B = 'GSTR3B', 'GSTR-3B Monthly Return'


class GSTFilingStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    GENERATED = 'GENERATED', 'Generated'
    FILED = 'FILED', 'Filed'


class GSTFilingPeriod(BaseModel):
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='gst_filing_periods'
    )
    period_key = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Tax period in format YYYY-MM (e.g. 2026-10) or YYYY-QX"
    )
    return_type = models.CharField(
        max_length=20,
        choices=GSTReturnType.choices,
        default=GSTReturnType.GSTR1,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=GSTFilingStatus.choices,
        default=GSTFilingStatus.DRAFT,
        db_index=True
    )
    is_locked = models.BooleanField(
        default=False,
        help_text="Locks the historical period against invoice alterations."
    )

    # Tax totals snapshot
    gross_turnover = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    taxable_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    cgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    sgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    igst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_tax = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    # Document counts
    invoices_count = models.IntegerField(default=0)
    credit_notes_count = models.IntegerField(default=0)

    # Audit & Filing details
    filed_at = models.DateTimeField(null=True, blank=True)
    acknowledged_ref_number = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Application Reference Number (ARN) received from GST portal"
    )
    gstn_json_cache = models.JSONField(
        null=True,
        blank=True,
        help_text="Cached GSTN offline tool JSON output"
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-period_key', 'return_type']
        unique_together = ('store_id', 'period_key', 'return_type')
        indexes = [
            models.Index(fields=['store_id', 'period_key']),
            models.Index(fields=['period_key', 'status']),
        ]

    def __str__(self):
        return f"{self.store_id.name} | {self.period_key} ({self.return_type}) - {self.status}"

    def mark_filed(self, arn: str = '', notes: str = ''):
        self.status = GSTFilingStatus.FILED
        self.is_locked = True
        self.filed_at = timezone.now()
        if arn:
            self.acknowledged_ref_number = arn
        if notes:
            self.notes = notes
        self.save()
