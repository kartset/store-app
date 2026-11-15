from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from db.models import Store, OrganizationStaff, StoreStaff
from .serializers import StoreSerializer
from .permissions import IsOrgAdminOrStoreStaffReadOnly


class StoreViewSet(viewsets.ModelViewSet):
    serializer_class = StoreSerializer
    permission_classes = [IsOrgAdminOrStoreStaffReadOnly]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Store.objects.none()

        if getattr(user, 'is_superuser', False):
            qs = Store.objects.filter(is_deleted=False)
            org_id = self.request.query_params.get('organization_id')
            if org_id:
                qs = qs.filter(organization_id_id=org_id)
            return qs

        # 1. Org Admin access: see all stores in their organization
        org_staff_qs = OrganizationStaff.objects.filter(
            user_id=user,
            role='ORG_ADMIN',
            is_active=True,
            is_deleted=False,
        ).select_related('organization_id')

        if org_staff_qs.exists():
            user_org_ids = [s.organization_id_id for s in org_staff_qs]
            qs = Store.objects.filter(
                is_deleted=False,
                organization_id_id__in=user_org_ids
            )
            org_id = self.request.query_params.get('organization_id')
            if org_id:
                qs = qs.filter(organization_id_id=org_id)
            return qs

        # 2. Store Staff access: restricted strictly to assigned store(s)
        assigned_store_ids = StoreStaff.objects.filter(
            user_id=user,
            is_deleted=False,
        ).values_list('store_id_id', flat=True)

        return Store.objects.filter(
            is_deleted=False,
            id__in=assigned_store_ids
        )

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, 'is_superuser', False):
            serializer.save(created_by=user)
            return

        org_staff = OrganizationStaff.objects.filter(
            user_id=user,
            role='ORG_ADMIN',
            is_active=True,
            is_deleted=False,
        ).first()

        if not org_staff:
            raise PermissionDenied("Only Organization Admins can create new retail stores.")

        req_org_id = self.request.data.get('organization_id')
        if req_org_id and str(req_org_id) != str(org_staff.organization_id_id):
            raise PermissionDenied("Cannot create a store for an organization you do not manage.")

        serializer.save(
            organization_id=org_staff.organization_id,
            created_by=user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
