from django.db import models

from utils.models import BaseModel


class Category(BaseModel):
    """
    Platform-level Global Category Master (e.g. Groceries, Apparel, Electronics).
    Hierarchical: supports subcategories via self-referencing parent_id.
    """
    parent_id = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcategories'
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(null=True, blank=True)
    default_hsn_code = models.CharField(max_length=50, null=True, blank=True)
    default_tax_slab = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=18.00,
        help_text="Default GST Tax Rate percentage for this category"
    )
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = 'categories'
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        if self.parent_id:
            return f"{self.parent_id.name} > {self.name}"
        return self.name


class OrganizationCategory(BaseModel):
    """
    Categories adopted/supported by an Organization.
    An organization opts into which business domains/categories they operate in.
    """
    organization_id = models.ForeignKey(
        'db.Organization',
        on_delete=models.CASCADE,
        related_name='org_categories'
    )
    category_id = models.ForeignKey(
        'db.Category',
        on_delete=models.CASCADE,
        related_name='category_orgs'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'organization categories'
        unique_together = ('organization_id', 'category_id')
        indexes = [
            models.Index(fields=['organization_id', 'is_active']),
        ]

    def __str__(self):
        return f"{self.organization_id.name} <> {self.category_id.name}"


class StoreCategory(BaseModel):
    """
    Store <> Category Mapping.
    Allows stores to specialize in single categories or support overlapping multi-category mixes.
    """
    store_id = models.ForeignKey(
        'db.Store',
        on_delete=models.CASCADE,
        related_name='store_categories'
    )
    category_id = models.ForeignKey(
        'db.Category',
        on_delete=models.CASCADE,
        related_name='category_stores'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'store categories'
        unique_together = ('store_id', 'category_id')
        indexes = [
            models.Index(fields=['store_id', 'is_active']),
        ]

    def __str__(self):
        return f"{self.store_id.name} <> {self.category_id.name}"
