from django.db import models

from utils.models import BaseModel


class PaymentTerms(models.TextChoices):
    COD = 'COD', 'Cash On Delivery'
    PREPAID = 'PREPAID', 'Prepaid'
    NET_7 = 'NET_7', 'Net 7 Days'
    NET_15 = 'NET_15', 'Net 15 Days'
    NET_30 = 'NET_30', 'Net 30 Days'
    NET_45 = 'NET_45', 'Net 45 Days'
    NET_60 = 'NET_60', 'Net 60 Days'


class Vendor(BaseModel):
    organization_id = models.ForeignKey(
        'db.Organization',
        on_delete=models.CASCADE,
        related_name='vendors'
    )
    name = models.CharField(max_length=255, help_text="Legal name or primary business name")
    trade_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Doing Business As (DBA) / Brand / Trade Name"
    )
    vendor_code = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Internal unique vendor code, e.g. VEND-001"
    )

    # Tax & Identification
    gstin = models.CharField(
        max_length=15,
        null=True,
        blank=True,
        help_text="15-character GST Identification Number"
    )
    pan_number = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        help_text="10-character Permanent Account Number (PAN)"
    )
    gst_number = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Legacy GST / tax number field maintained for backward compatibility"
    )

    # Primary Contact Details
    contact_person = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    contact_info = models.TextField(
        null=True,
        blank=True,
        help_text="General contact info or remarks"
    )

    # Address Details
    billing_address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    state_code = models.CharField(
        max_length=2,
        null=True,
        blank=True,
        help_text="2-digit GST state code e.g. 27 (Maharashtra), 07 (Delhi)"
    )
    pincode = models.CharField(max_length=10, null=True, blank=True)

    # Commercial & Credit Terms
    payment_terms = models.CharField(
        max_length=20,
        choices=PaymentTerms.choices,
        default=PaymentTerms.NET_30,
        help_text="Default payment terms for invoices and purchase orders"
    )
    credit_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Credit limit extended by vendor"
    )

    # Banking Information
    bank_name = models.CharField(max_length=100, null=True, blank=True)
    bank_account_number = models.CharField(max_length=50, null=True, blank=True)
    bank_ifsc = models.CharField(max_length=20, null=True, blank=True)

    # Operational & Lifecycle
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['organization_id', 'vendor_code'],
                condition=models.Q(vendor_code__isnull=False, is_deleted=False),
                name='unique_org_vendor_code'
            )
        ]
        indexes = [
            models.Index(fields=['is_deleted']),
            models.Index(fields=['organization_id', 'is_active']),
            models.Index(fields=['organization_id', 'vendor_code']),
        ]


    def save(self, *args, **kwargs):
        if self.vendor_code == "":
            self.vendor_code = None
        if self.gstin:
            self.gstin = self.gstin.strip().upper()
        if self.pan_number:
            self.pan_number = self.pan_number.strip().upper()
        if self.state_code:
            self.state_code = self.state_code.strip()

        # Synchronize gstin and gst_number
        if self.gstin and not self.gst_number:
            self.gst_number = self.gstin
        elif self.gst_number and not self.gstin:
            self.gstin = self.gst_number

        super().save(*args, **kwargs)

    def __str__(self):
        if self.trade_name and self.trade_name != self.name:
            return f"{self.name} ({self.trade_name})"
        return self.name


class VendorProduct(BaseModel):
    vendor_id = models.ForeignKey(
        'db.Vendor',
        on_delete=models.CASCADE,
        related_name='vendor_products'
    )
    product_id = models.ForeignKey(
        'db.Product',
        on_delete=models.CASCADE,
        related_name='product_vendors'
    )
    vendor_sku = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Supplier's internal catalog code or SKU"
    )
    negotiated_cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Agreed procurement cost price per unit"
    )
    minimum_order_quantity = models.IntegerField(
        default=1,
        help_text="Minimum procurement quantity (MOQ) per purchase order"
    )
    lead_time_days = models.IntegerField(
        default=3,
        help_text="Expected delivery lead time in days"
    )
    is_primary_supplier = models.BooleanField(
        default=False,
        help_text="Indicates primary/default vendor for automated replenishment"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['vendor_id', 'product_id']
        constraints = [
            models.UniqueConstraint(
                fields=['vendor_id', 'product_id'],
                condition=models.Q(is_deleted=False),
                name='unique_vendor_product_mapping'
            )
        ]
        indexes = [
            models.Index(fields=['is_deleted']),
            models.Index(fields=['vendor_id', 'is_active']),
            models.Index(fields=['product_id', 'is_active']),
            models.Index(fields=['vendor_id', 'is_primary_supplier']),
        ]

    def __str__(self):
        return f"{self.vendor_id.name} -> {self.product_id.name} (₹{self.negotiated_cost_price})"

