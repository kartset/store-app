from django.db import models

from utils.models import BaseModel


class Brand(BaseModel):
    """
    Brand entity maintained at the Organization level.
    """
    organization_id = models.ForeignKey(
        'db.Organization',
        on_delete=models.CASCADE,
        related_name='brands'
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, null=True, blank=True)
    logo_url = models.URLField(max_length=500, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('organization_id', 'name')
        indexes = [
            models.Index(fields=['organization_id', 'name']),
            models.Index(fields=['organization_id', 'is_active']),
        ]

    def __str__(self):
        return self.name
