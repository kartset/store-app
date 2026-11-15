from rest_framework.permissions import BasePermission, SAFE_METHODS
from db.models import OrganizationStaff, StoreStaff


class IsOrgAdminOrStoreStaffReadOnly(BasePermission):
    """
    Access Control for Store Management:
    - Superusers: Full access to all stores.
    - Org Admins (ORG_ADMIN): Full CRUD access to stores within their organization.
    - Store Staff (CASHIER, MANAGER, etc.): Read-only access to their assigned store(s).
      Forbidden from creating, updating, or deleting stores.
    """
    message = "Only Organization Admins can manage retail store branches."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if getattr(request.user, 'is_superuser', False):
            return True

        is_org_admin = OrganizationStaff.objects.filter(
            user_id=request.user,
            role='ORG_ADMIN',
            is_active=True,
            is_deleted=False,
        ).exists()

        if is_org_admin:
            return True

        # Non-org-admin staff: only safe read methods allowed (and scoped in queryset)
        if request.method in SAFE_METHODS:
            return StoreStaff.objects.filter(
                user_id=request.user,
                is_deleted=False,
            ).exists()

        return False

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'is_superuser', False):
            return True

        # Check Org Admin access
        is_org_admin = OrganizationStaff.objects.filter(
            user_id=request.user,
            organization_id=obj.organization_id,
            role='ORG_ADMIN',
            is_active=True,
            is_deleted=False,
        ).exists()

        if is_org_admin:
            return True

        if request.method in SAFE_METHODS:
            return StoreStaff.objects.filter(
                user_id=request.user,
                store_id=obj,
                is_deleted=False,
            ).exists()

        return False
