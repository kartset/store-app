from django.db import models

from utils.models import BaseModel


class Category(BaseModel):
    """
    Product Category maintained at the Organization level.
    Supports a hierarchical category tree via self-referencing parent_id.
    """
    organization_id = models.ForeignKey(
        'db.Organization',
        on_delete=models.CASCADE,
        related_name='categories'
    )
    parent_id = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcategories'
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'categories'
        unique_together = ('organization_id', 'slug')
        indexes = [
            models.Index(fields=['organization_id', 'slug']),
            models.Index(fields=['organization_id', 'is_active']),
        ]

    def __str__(self):
        if self.parent_id:
            return f"{self.parent_id.name} > {self.name}"
        return self.name
