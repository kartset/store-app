from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from db.models import OrganizationStaff, Store, StoreStaff, User
from utils.tenant import get_user_organization
from .permissions import IsOrgAdmin
from .serializers import (
    StaffDirectoryItemSerializer,
    StaffOnboardSerializer,
    StaffUpdateSerializer,
)


class StaffPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class StaffListView(APIView):
    """
    List staff members belonging to the authenticated Org Admin's organization.
    Supports filtering by store, role, search (email/name), and active status.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request, *args, **kwargs):
        org = get_user_organization(request.user)
        if not org:
            raise PermissionDenied("You must belong to an active organization.")

        store_id = request.query_params.get('store_id', '').strip()
        role = request.query_params.get('role', '').strip()
        search = request.query_params.get('search', '').strip()
        is_active_param = request.query_params.get('is_active')

        # 1. Fetch OrganizationStaff
        org_staff_items = []
        if not store_id or store_id.lower() in ('all', 'org'):
            qs_org = OrganizationStaff.objects.filter(
                organization_id=org,
                is_deleted=False,
            ).select_related('user_id', 'organization_id')

            if role:
                qs_org = qs_org.filter(role=role)
            if is_active_param is not None and is_active_param != '':
                qs_org = qs_org.filter(is_active=(is_active_param.lower() in ('true', '1')))
            if search:
                qs_org = qs_org.filter(
                    Q(user_id__email__icontains=search) |
                    Q(user_id__first_name__icontains=search) |
                    Q(user_id__last_name__icontains=search)
                )

            for item in qs_org:
                org_staff_items.append({
                    'id': item.id,
                    'type': 'organization',
                    'user': item.user_id,
                    'organization': item.organization_id,
                    'store': None,
                    'role': item.role,
                    'is_active': item.is_active,
                    'created_at': item.created_at,
                    'updated_at': item.updated_at,
                })

        # 2. Fetch StoreStaff
        store_staff_items = []
        if not store_id or (store_id.lower() != 'org'):
            qs_store = StoreStaff.objects.filter(
                store_id__organization_id=org,
                is_deleted=False,
            ).select_related('user_id', 'store_id', 'store_id__organization_id')

            if store_id and store_id.lower() != 'all':
                qs_store = qs_store.filter(store_id_id=store_id)
            if role:
                qs_store = qs_store.filter(role=role)
            if is_active_param is not None and is_active_param != '':
                qs_store = qs_store.filter(is_active=(is_active_param.lower() in ('true', '1')))
            if search:
                qs_store = qs_store.filter(
                    Q(user_id__email__icontains=search) |
                    Q(user_id__first_name__icontains=search) |
                    Q(user_id__last_name__icontains=search)
                )

            for item in qs_store:
                store_staff_items.append({
                    'id': item.id,
                    'type': 'store',
                    'user': item.user_id,
                    'organization': item.store_id.organization_id,
                    'store': item.store_id,
                    'role': item.role,
                    'is_active': item.is_active,
                    'created_at': item.created_at,
                    'updated_at': item.updated_at,
                })

        # Combine and sort by created_at desc
        combined = org_staff_items + store_staff_items
        combined.sort(key=lambda x: x['created_at'], reverse=True)

        paginator = StaffPagination()
        page = paginator.paginate_queryset(combined, request, view=self)
        serializer = StaffDirectoryItemSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class StaffOnboardView(APIView):
    """
    Onboard a new user to an organization or a store outlet.
    Returns HTTP 409 Conflict if confirmation is required (same-org reassignment or reactivation).
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, *args, **kwargs):
        org = get_user_organization(request.user)
        if not org:
            raise PermissionDenied("You must belong to an active organization.")

        serializer = StaffOnboardSerializer(
            data=request.data,
            context={'request': request, 'organization': org}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_201_CREATED)


class StaffCheckEmailView(APIView):
    """
    Pre-check an email for the onboarding flow.
    Surfaces whether the user is new, belongs to another org, belongs to this org, or was deactivated.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request, *args, **kwargs):
        org = get_user_organization(request.user)
        if not org:
            raise PermissionDenied("You must belong to an active organization.")

        email = request.query_params.get('email', '').strip().lower()
        if not email:
            return Response({"error": "email query parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({
                "exists": False,
                "status": "new",
                "message": "User is new and can be onboarded."
            }, status=status.HTTP_200_OK)

        # Check other organization
        other_org_staff = OrganizationStaff.objects.filter(
            user_id=user,
            is_deleted=False,
        ).exclude(organization_id=org).first()

        other_store_staff = StoreStaff.objects.filter(
            user_id=user,
            is_deleted=False,
        ).exclude(store_id__organization_id=org).first()

        if other_org_staff or other_store_staff:
            return Response({
                "exists": True,
                "status": "other_org",
                "message": "User is registered with another organization."
            }, status=status.HTTP_200_OK)

        # Check deactivation in this org
        org_staff_same = OrganizationStaff.objects.filter(user_id=user, organization_id=org).first()
        store_staff_same = StoreStaff.objects.filter(user_id=user, store_id__organization_id=org).first()

        is_deactivated = False
        if not user.is_active or user.is_deleted:
            is_deactivated = True
        elif (org_staff_same and (not org_staff_same.is_active or org_staff_same.is_deleted)) or \
             (store_staff_same and (not store_staff_same.is_active or store_staff_same.is_deleted)):
            is_deactivated = True

        if is_deactivated:
            return Response({
                "exists": True,
                "status": "deactivated",
                "message": f"User was previously deactivated in your organization.",
                "user": {
                    "id": str(user.id),
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                }
            }, status=status.HTTP_200_OK)

        # Active in same org
        active_store_staff = StoreStaff.objects.filter(
            user_id=user,
            store_id__organization_id=org,
            is_active=True,
            is_deleted=False,
        ).select_related('store_id').first()

        active_org_staff = OrganizationStaff.objects.filter(
            user_id=user,
            organization_id=org,
            is_active=True,
            is_deleted=False,
        ).first()

        current_desc = (
            f"assigned to {active_store_staff.store_id.name} as {active_store_staff.role}"
            if active_store_staff
            else f"assigned to Organization HQ as {active_org_staff.role}"
        )

        return Response({
            "exists": True,
            "status": "same_org",
            "message": f"User is currently {current_desc}.",
            "user": {
                "id": str(user.id),
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "current_scope": "store" if active_store_staff else "organization",
            "current_store_id": str(active_store_staff.store_id.id) if active_store_staff else None,
            "current_store_name": active_store_staff.store_id.name if active_store_staff else None,
            "current_role": active_store_staff.role if active_store_staff else active_org_staff.role,
        }, status=status.HTTP_200_OK)


class StaffDetailView(APIView):
    """
    Retrieve, update (role, store assignment, active status), or soft-delete a staff member.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def _resolve_staff(self, staff_id, org):
        store_staff = StoreStaff.objects.filter(
            id=staff_id,
            store_id__organization_id=org,
            is_deleted=False,
        ).select_related('user_id', 'store_id', 'store_id__organization_id').first()

        if store_staff:
            return store_staff, 'store'

        org_staff = OrganizationStaff.objects.filter(
            id=staff_id,
            organization_id=org,
            is_deleted=False,
        ).select_related('user_id', 'organization_id').first()

        if org_staff:
            return org_staff, 'organization'

        return None, None

    def patch(self, request, staff_id, *args, **kwargs):
        org = get_user_organization(request.user)
        if not org:
            raise PermissionDenied("You must belong to an active organization.")

        staff_instance, staff_type = self._resolve_staff(staff_id, org)
        if not staff_instance:
            return Response({"error": "Staff member not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StaffUpdateSerializer(data=request.data, context={'organization': org})
        serializer.is_valid(raise_exception=True)

        new_role = serializer.validated_data.get('role')
        new_store = serializer.validated_data.get('store_instance')
        new_is_active = serializer.validated_data.get('is_active')

        with transaction.atomic():
            if staff_type == 'store':
                if new_role:
                    valid_roles = [c[0] for c in StoreStaff.ROLE_CHOICES]
                    if new_role not in valid_roles:
                        raise ValidationError({"role": f"Invalid store role. Choose from: {valid_roles}"})
                    staff_instance.role = new_role

                if new_store:
                    staff_instance.store_id = new_store

                if new_is_active is not None:
                    staff_instance.is_active = new_is_active

                staff_instance.updated_by = request.user
                staff_instance.save()

                result = {
                    'id': staff_instance.id,
                    'type': 'store',
                    'user': staff_instance.user_id,
                    'organization': staff_instance.store_id.organization_id,
                    'store': staff_instance.store_id,
                    'role': staff_instance.role,
                    'is_active': staff_instance.is_active,
                    'created_at': staff_instance.created_at,
                    'updated_at': staff_instance.updated_at,
                }

            else:  # organization
                if new_role:
                    valid_roles = [c[0] for c in OrganizationStaff.ROLE_CHOICES]
                    if new_role not in valid_roles:
                        raise ValidationError({"role": f"Invalid org role. Choose from: {valid_roles}"})

                    # Safety check: do not downgrade the only active ORG_ADMIN
                    if staff_instance.role == 'ORG_ADMIN' and new_role != 'ORG_ADMIN':
                        active_admins_count = OrganizationStaff.objects.filter(
                            organization_id=org,
                            role='ORG_ADMIN',
                            is_active=True,
                            is_deleted=False,
                        ).count()
                        if active_admins_count <= 1:
                            raise ValidationError({"role": "Cannot change the role of the only active Organization Administrator."})

                    staff_instance.role = new_role

                if new_is_active is not None:
                    if not new_is_active and staff_instance.role == 'ORG_ADMIN':
                        active_admins_count = OrganizationStaff.objects.filter(
                            organization_id=org,
                            role='ORG_ADMIN',
                            is_active=True,
                            is_deleted=False,
                        ).count()
                        if active_admins_count <= 1:
                            raise ValidationError({"is_active": "Cannot deactivate the only active Organization Administrator."})

                    staff_instance.is_active = new_is_active

                staff_instance.updated_by = request.user
                staff_instance.save()

                result = {
                    'id': staff_instance.id,
                    'type': 'organization',
                    'user': staff_instance.user_id,
                    'organization': staff_instance.organization_id,
                    'store': None,
                    'role': staff_instance.role,
                    'is_active': staff_instance.is_active,
                    'created_at': staff_instance.created_at,
                    'updated_at': staff_instance.updated_at,
                }

        out_serializer = StaffDirectoryItemSerializer(result)
        return Response(out_serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, staff_id, *args, **kwargs):
        org = get_user_organization(request.user)
        if not org:
            raise PermissionDenied("You must belong to an active organization.")

        staff_instance, staff_type = self._resolve_staff(staff_id, org)
        if not staff_instance:
            return Response({"error": "Staff member not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if staff_type == 'organization':
                if staff_instance.role == 'ORG_ADMIN':
                    active_admins_count = OrganizationStaff.objects.filter(
                        organization_id=org,
                        role='ORG_ADMIN',
                        is_active=True,
                        is_deleted=False,
                    ).count()
                    if active_admins_count <= 1:
                        raise ValidationError({"error": "Cannot remove the only active Organization Administrator."})

            target_user = staff_instance.user_id

            staff_instance.is_active = False
            staff_instance.is_deleted = True
            staff_instance.deleted_at = timezone.now()
            staff_instance.deleted_by = request.user
            staff_instance.save()

            # Check if user has any other active memberships in the org
            has_other_store = StoreStaff.objects.filter(
                user_id=target_user,
                store_id__organization_id=org,
                is_active=True,
                is_deleted=False,
            ).exists()

            has_other_org = OrganizationStaff.objects.filter(
                user_id=target_user,
                organization_id=org,
                is_active=True,
                is_deleted=False,
            ).exists()

            if not has_other_store and not has_other_org:
                target_user.is_active = False
                target_user.save()

        return Response({"detail": "Staff member removed successfully."}, status=status.HTTP_200_OK)
