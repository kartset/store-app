from rest_framework import serializers

from db.models import User
from utils.serializers import BaseModelSerializer


class UserSerializer(BaseModelSerializer):
    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'last_login',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'last_login')


from rest_framework import exceptions
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from db.models import OrganizationStaff, Store, StoreStaff, User


class AppTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom TokenObtainPairSerializer to authenticate against db.models.User
    using email and password.
    Enforces that users must be associated with either an active store (StoreStaff)
    or an active organization (OrganizationStaff e.g. Org Admin).
    Org Admins have full access across all stores in their organization.
    """
    username_field = 'email'
    store_id = serializers.UUIDField(required=False, allow_null=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        return token

    def validate(self, attrs):
        email = attrs.get(self.username_field)
        password = attrs.get('password')

        user = None
        if email and password:
            try:
                candidate = User.objects.get(email__iexact=email.strip(), is_deleted=False)
                if candidate.check_password(password):
                    user = candidate
            except User.DoesNotExist:
                pass

        if user is None or not user.is_active:
            raise exceptions.AuthenticationFailed(
                self.error_messages['no_active_account'],
                'no_active_account',
            )

        # 1. Fetch active store memberships
        active_stores_qs = StoreStaff.objects.filter(
            user_id=user,
            is_deleted=False,
            store_id__is_active=True,
            store_id__is_deleted=False,
        ).select_related('store_id', 'store_id__organization_id')

        # 2. Fetch active organization memberships (HQ Org Admins / Staff)
        active_org_staff_qs = OrganizationStaff.objects.filter(
            user_id=user,
            is_active=True,
            is_deleted=False,
            organization_id__is_active=True,
            organization_id__is_deleted=False,
        ).select_related('organization_id')

        if not active_stores_qs.exists() and not active_org_staff_qs.exists():
            raise exceptions.AuthenticationFailed(
                "User is not associated with any active store or organization.",
                "no_store_association",
            )

        stores_data = [
            {
                'id': str(staff.store_id.id),
                'name': staff.store_id.name,
                'role': staff.role,
                'organization_id': str(staff.store_id.organization_id_id),
            }
            for staff in active_stores_qs
        ]

        orgs_data = [
            {
                'id': str(staff.organization_id.id),
                'name': staff.organization_id.name,
                'role': staff.role,
            }
            for staff in active_org_staff_qs
        ]
        is_org_admin = any(staff.role == 'ORG_ADMIN' for staff in active_org_staff_qs)

        target_store_id = attrs.get('store_id')
        current_store = None

        if target_store_id:
            store_match = next((s for s in stores_data if s['id'] == str(target_store_id)), None)
            if store_match:
                current_store = store_match
            else:
                # If user is an Org Admin, verify if the requested store belongs to one of their organizations
                admin_org_ids = [
                    staff.organization_id_id
                    for staff in active_org_staff_qs
                    if staff.role == 'ORG_ADMIN'
                ]
                org_store = Store.objects.filter(
                    id=target_store_id,
                    organization_id__in=admin_org_ids,
                    is_active=True,
                    is_deleted=False,
                ).first()
                if org_store:
                    current_store = {
                        'id': str(org_store.id),
                        'name': org_store.name,
                        'role': 'ORG_ADMIN',
                        'organization_id': str(org_store.organization_id_id),
                    }
                else:
                    raise exceptions.AuthenticationFailed(
                        "User is not associated with the requested store.",
                        "invalid_store_association",
                    )
        elif stores_data:
            current_store = stores_data[0]
        elif orgs_data:
            primary_org_id = active_org_staff_qs[0].organization_id_id
            first_org_store = Store.objects.filter(
                organization_id=primary_org_id,
                is_active=True,
                is_deleted=False,
            ).first()
            if first_org_store and is_org_admin:
                current_store = {
                    'id': str(first_org_store.id),
                    'name': first_org_store.name,
                    'role': 'ORG_ADMIN',
                    'organization_id': str(first_org_store.organization_id_id),
                }

        self.user = user
        refresh = self.get_token(self.user)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': str(self.user.id),
                'email': self.user.email,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
                'current_store': current_store,
                'stores': stores_data,
                'organizations': orgs_data,
                'is_org_admin': is_org_admin,
            }
        }


