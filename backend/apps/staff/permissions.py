from rest_framework.permissions import BasePermission
from db.models import OrganizationStaff
from utils.tenant import get_user_organization


class IsOrgAdmin(BasePermission):
    """
    Allows access only to Organization Administrators of their own tenant.
    """
    message = "Only Organization Administrators can manage staff and user onboarding."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if getattr(request.user, 'is_superuser', False):
            return True

        user_org = get_user_organization(request.user)
        if not user_org:
            return False

        return OrganizationStaff.objects.filter(
            user_id=request.user,
            organization_id=user_org,
            role='ORG_ADMIN',
            is_active=True,
            is_deleted=False,
        ).exists()
