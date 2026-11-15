from db.models import OrganizationStaff, StoreStaff


def get_user_organization(user):
    """
    Resolves the single tenant Organization associated with the authenticated user:
    1. Checks active OrganizationStaff (e.g. ORG_ADMIN, CATALOG_MANAGER, AUDITOR).
    2. Checks active StoreStaff (assigned store's organization).
    Returns the Organization instance, or None if the user has no affiliation.
    """
    if not user or not user.is_authenticated:
        return None

    # Check OrganizationStaff
    org_staff = OrganizationStaff.objects.filter(
        user_id=user,
        is_active=True,
        is_deleted=False,
    ).select_related('organization_id').first()
    if org_staff:
        return org_staff.organization_id

    # Check StoreStaff
    store_staff = StoreStaff.objects.filter(
        user_id=user,
        is_deleted=False,
    ).select_related('store_id__organization_id').first()
    if store_staff and store_staff.store_id:
        return store_staff.store_id.organization_id

    return None
