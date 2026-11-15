from rest_framework.permissions import SAFE_METHODS, BasePermission

from db.models import OrganizationStaff
from utils.tenant import get_user_organization


class IsOrgAdminOrReadOnly(BasePermission):
    """
    RBAC Permission Gate for Centralized Merchandising Governance:
    - SAFE_METHODS (GET, HEAD, OPTIONS): Accessible to any authenticated user
      (including Store Staff, Cashiers, Store Managers for barcode scanning and POS search).
    - Mutation methods (POST, PUT, PATCH, DELETE): Strictly restricted to active
      Organization Admins (and Catalog Managers) of the relevant organization.
    - Store Staff without OrganizationStaff membership receive 403 Forbidden.
    """
    message = "Only Organization Admins can create, modify, or delete catalog products and categories."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        if getattr(request.user, 'is_superuser', False):
            return True

        if request.method == 'POST':
            user_org = get_user_organization(request.user)
            org_id = request.data.get('organization_id') or request.query_params.get('organization_id')
            if org_id:
                return OrganizationStaff.objects.filter(
                    user_id=request.user,
                    organization_id_id=org_id,
                    role__in=['ORG_ADMIN', 'CATALOG_MANAGER'],
                    is_active=True,
                    is_deleted=False,
                ).exists()

            if user_org:
                return OrganizationStaff.objects.filter(
                    user_id=request.user,
                    organization_id=user_org,
                    role__in=['ORG_ADMIN', 'CATALOG_MANAGER'],
                    is_active=True,
                    is_deleted=False,
                ).exists()

            return False

        # For PUT / PATCH / DELETE, delegate to object-level permission
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        if getattr(request.user, 'is_superuser', False):
            return True

        org_id = getattr(obj, 'organization_id_id', None) or getattr(obj, 'organization_id', None)
        if hasattr(org_id, 'id'):
            org_id = org_id.id

        if not org_id:
            return False

        return OrganizationStaff.objects.filter(
            user_id=request.user,
            organization_id_id=org_id,
            role__in=['ORG_ADMIN', 'CATALOG_MANAGER'],
            is_active=True,
            is_deleted=False,
        ).exists()
