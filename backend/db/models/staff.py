from django.db import models

from utils.models import BaseModel


class OrganizationStaff(BaseModel):
    """
    Staff / Admin memberships maintained at the Organization (HQ) level.
    Org Admins have top-level governance across all stores, master catalog,
    categories, subcategories, and store allocations.
    """
    ROLE_CHOICES = (
        ('ORG_ADMIN', 'Org Admin'),
        ('CATALOG_MANAGER', 'Catalog Manager'),
        ('AUDITOR', 'Auditor'),
    )
    user_id = models.ForeignKey(
        'db.User',
        on_delete=models.CASCADE,
        related_name='org_staff_roles'
    )
    organization_id = models.ForeignKey(
        'db.Organization',
        on_delete=models.CASCADE,
        related_name='staff_members'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='ORG_ADMIN')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'organization staff'
        unique_together = ('user_id', 'organization_id')
        indexes = [
            models.Index(fields=['organization_id', 'role']),
            models.Index(fields=['organization_id', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user_id.email} - {self.organization_id.name} ({self.role})"


class StoreStaff(BaseModel):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('MANAGER', 'Manager'),
        ('CASHIER', 'Cashier'),
    )
    user_id = models.ForeignKey(
        'db.User',
        on_delete=models.CASCADE,
        related_name='staff_roles'
    )
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='staff_members'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CASHIER')

    class Meta:
        verbose_name_plural = 'store staff'
        unique_together = ('user_id', 'store_id')
        indexes = [
            models.Index(fields=['store_id', 'role']),
        ]

    def __str__(self):
        return f"{self.user_id.email} - {self.store_id.name} ({self.role})"
