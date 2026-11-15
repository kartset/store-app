from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from db.models import Store, OrganizationStaff, StoreStaff
from utils.tenant import get_user_organization
from .serializers import StoreSerializer
from .permissions import IsOrgAdminOrStoreStaffReadOnly


class StoreViewSet(viewsets.ModelViewSet):
    queryset = Store.objects.filter(is_deleted=False).order_by('name')
    serializer_class = StoreSerializer
    permission_classes = [IsOrgAdminOrStoreStaffReadOnly]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Store.objects.none()

        if getattr(user, 'is_superuser', False):
            return Store.objects.filter(is_deleted=False).order_by('name')

        # 1. Org Admin access: auto-scoped to their single organization
        is_org_admin = OrganizationStaff.objects.filter(
            user_id=user,
            role='ORG_ADMIN',
            is_active=True,
            is_deleted=False,
        ).exists()

        if is_org_admin:
            user_org = get_user_organization(user)
            if not user_org:
                return Store.objects.none()
            return Store.objects.filter(
                is_deleted=False,
                organization_id=user_org
            ).order_by('name')

        # 2. Store Staff access: restricted strictly to assigned store(s)
        assigned_store_ids = StoreStaff.objects.filter(
            user_id=user,
            is_deleted=False,
        ).values_list('store_id_id', flat=True)

        return Store.objects.filter(
            is_deleted=False,
            id__in=assigned_store_ids
        ).order_by('name')

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, 'is_superuser', False):
            serializer.save(created_by=user)
            return

        user_org = get_user_organization(user)
        if not user_org:
            raise PermissionDenied("You must belong to an active organization to create retail stores.")

        serializer.save(
            organization_id=user_org,
            created_by=user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
