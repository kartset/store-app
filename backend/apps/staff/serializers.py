from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from django.db import transaction
from db.models import User, Organization, Store, OrganizationStaff, StoreStaff
from apps.user.serializers import UserSerializer
from apps.store.serializers import StoreSerializer
from utils.serializers import BaseModelSerializer


class ConfirmationRequiredException(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Confirmation required.'
    default_code = 'confirmation_required'

    def __init__(self, data):
        self.detail = data



class StaffDirectoryItemSerializer(serializers.Serializer):
    """
    Unified representation of a staff membership (either OrganizationStaff or StoreStaff).
    """
    id = serializers.UUIDField()
    type = serializers.CharField()  # 'store' or 'organization'
    user = UserSerializer()
    organization = serializers.SerializerMethodField()
    store = serializers.SerializerMethodField()
    role = serializers.CharField()
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()

    def get_organization(self, obj):
        org = obj.get('organization')
        if not org:
            return None
        return {
            'id': str(org.id),
            'name': org.name,
            'subdomain': org.subdomain,
        }

    def get_store(self, obj):
        store = obj.get('store')
        if not store:
            return None
        return {
            'id': str(store.id),
            'name': store.name,
            'address': store.address,
        }


class StaffOnboardSerializer(serializers.Serializer):
    """
    Onboard a user to an organization or a specific retail store outlet.
    Enforces multi-tenant restrictions:
    - User cannot belong to multiple organizations.
    - A worker cannot belong to multiple stores.
    - Prompts / confirmation flags for same-org reassignment and reactivation.
    - Sets must_change_password=True for new accounts.
    """
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    password = serializers.CharField(min_length=8, required=False, allow_blank=True, default='')
    scope = serializers.ChoiceField(choices=['store', 'organization'])
    store_id = serializers.UUIDField(required=False, allow_null=True)
    role = serializers.CharField(max_length=30)
    reassign_if_exists = serializers.BooleanField(required=False, default=False)
    reactivate_if_deactivated = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        scope = attrs.get('scope')
        store_id = attrs.get('store_id')
        role = attrs.get('role')
        email = attrs.get('email')
        password = attrs.get('password')
        reassign_if_exists = attrs.get('reassign_if_exists', False)
        reactivate_if_deactivated = attrs.get('reactivate_if_deactivated', False)

        org = self.context.get('organization')
        if not org:
            raise serializers.ValidationError({"organization": "Valid organization context is required."})

        # Validate scope & role
        if scope == 'store':
            if not store_id:
                raise serializers.ValidationError({"store_id": "Store ID is required when onboarding to a store."})
            store = Store.objects.filter(id=store_id, organization_id=org, is_deleted=False).first()
            if not store:
                raise serializers.ValidationError({"store_id": "Store not found or does not belong to your organization."})
            attrs['store_instance'] = store

            valid_roles = [c[0] for c in StoreStaff.ROLE_CHOICES]
            if role not in valid_roles:
                raise serializers.ValidationError({"role": f"Invalid store role. Choose from: {valid_roles}"})

        elif scope == 'organization':
            valid_roles = [c[0] for c in OrganizationStaff.ROLE_CHOICES]
            if role not in valid_roles:
                raise serializers.ValidationError({"role": f"Invalid organization role. Choose from: {valid_roles}"})

        # Check existing user
        user = User.objects.filter(email__iexact=email).first()
        if user:
            # 1. Check if user is associated with a different organization
            other_org_staff = OrganizationStaff.objects.filter(
                user_id=user,
                is_deleted=False,
            ).exclude(organization_id=org).first()

            other_store_staff = StoreStaff.objects.filter(
                user_id=user,
                is_deleted=False,
            ).exclude(store_id__organization_id=org).first()

            if other_org_staff or other_store_staff:
                raise serializers.ValidationError({
                    "email": "User is already registered with another organization. A user cannot belong to multiple organizations."
                })

            # 2. Check if user was previously deactivated in this same organization
            is_deactivated = False
            if not user.is_active or user.is_deleted:
                is_deactivated = True

            org_staff_same = OrganizationStaff.objects.filter(user_id=user, organization_id=org).first()
            store_staff_same = StoreStaff.objects.filter(user_id=user, store_id__organization_id=org).first()

            if (org_staff_same and (not org_staff_same.is_active or org_staff_same.is_deleted)) or \
               (store_staff_same and (not store_staff_same.is_active or store_staff_same.is_deleted)):
                is_deactivated = True

            if is_deactivated and not reactivate_if_deactivated:
                raise ConfirmationRequiredException({
                    "code": "user_deactivated_same_org",
                    "email": f"User {email} was previously deactivated in your organization.",
                    "requires_confirmation": True,
                    "action": "reactivate"
                })

            # 3. Check if user already has an active assignment in this same organization
            active_store_membership = StoreStaff.objects.filter(
                user_id=user,
                store_id__organization_id=org,
                is_active=True,
                is_deleted=False,
            ).select_related('store_id').first()

            active_org_membership = OrganizationStaff.objects.filter(
                user_id=user,
                organization_id=org,
                is_active=True,
                is_deleted=False,
            ).first()

            if active_store_membership or active_org_membership:
                if not reassign_if_exists:
                    current_desc = (
                        f"currently assigned to {active_store_membership.store_id.name} as {active_store_membership.role}"
                        if active_store_membership
                        else f"currently assigned to Organization HQ as {active_org_membership.role}"
                    )
                    raise ConfirmationRequiredException({
                        "code": "user_exists_same_org",
                        "email": f"User {email} is {current_desc}.",
                        "requires_confirmation": True,
                        "action": "reassign",
                        "current_store_id": str(active_store_membership.store_id.id) if active_store_membership else None,
                        "current_role": active_store_membership.role if active_store_membership else active_org_membership.role,
                    })

            attrs['existing_user'] = user
        else:
            if not password:
                raise serializers.ValidationError({"password": "Password is required when onboarding a new user."})

        return attrs

    def save(self):
        email = self.validated_data['email']
        first_name = self.validated_data['first_name']
        last_name = self.validated_data.get('last_name', '')
        password = self.validated_data.get('password')
        scope = self.validated_data['scope']
        role = self.validated_data['role']
        org = self.context['organization']
        request_user = self.context['request'].user
        existing_user = self.validated_data.get('existing_user')

        with transaction.atomic():
            if existing_user:
                user = existing_user
                if first_name and not user.first_name:
                    user.first_name = first_name
                if last_name and not user.last_name:
                    user.last_name = last_name
                user.is_active = True
                user.is_deleted = False
                user.deleted_at = None
                if password:
                    user.set_password(password)
                    user.must_change_password = True
                user.save()
            else:
                user = User.objects.create(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True,
                    must_change_password=True,
                    created_by=request_user,
                )
                user.set_password(password)
                user.save()

            if scope == 'store':
                target_store = self.validated_data['store_instance']

                # Enforce: a worker cannot belong to multiple stores
                # Soft-delete any existing store staff memberships in this org
                StoreStaff.objects.filter(
                    user_id=user,
                    store_id__organization_id=org,
                ).update(
                    is_active=False,
                    is_deleted=True,
                    deleted_by=request_user,
                )

                # Create or reactivate the staff record for this store
                store_staff, _ = StoreStaff.objects.update_or_create(
                    user_id=user,
                    store_id=target_store,
                    defaults={
                        'role': role,
                        'is_active': True,
                        'is_deleted': False,
                        'deleted_at': None,
                        'updated_by': request_user,
                    }
                )
                return {
                    'id': str(store_staff.id),
                    'type': 'store',
                    'user': UserSerializer(user).data,
                    'organization': {'id': str(org.id), 'name': org.name, 'subdomain': org.subdomain},
                    'store': {'id': str(target_store.id), 'name': target_store.name, 'address': target_store.address},
                    'role': store_staff.role,
                    'is_active': store_staff.is_active,
                    'created_at': store_staff.created_at,
                    'updated_at': store_staff.updated_at,
                }

            else:  # scope == 'organization'
                org_staff, _ = OrganizationStaff.objects.update_or_create(
                    user_id=user,
                    organization_id=org,
                    defaults={
                        'role': role,
                        'is_active': True,
                        'is_deleted': False,
                        'deleted_at': None,
                        'updated_by': request_user,
                    }
                )
                return {
                    'id': str(org_staff.id),
                    'type': 'organization',
                    'user': UserSerializer(user).data,
                    'organization': {'id': str(org.id), 'name': org.name, 'subdomain': org.subdomain},
                    'store': None,
                    'role': org_staff.role,
                    'is_active': org_staff.is_active,
                    'created_at': org_staff.created_at,
                    'updated_at': org_staff.updated_at,
                }


class StaffUpdateSerializer(serializers.Serializer):
    """
    Updates role, store assignment, or active status of a staff member.
    """
    role = serializers.CharField(required=False, allow_blank=False)
    store_id = serializers.UUIDField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        org = self.context['organization']
        store_id = attrs.get('store_id')
        if store_id:
            store = Store.objects.filter(id=store_id, organization_id=org, is_deleted=False).first()
            if not store:
                raise serializers.ValidationError({"store_id": "Store not found or does not belong to your organization."})
            attrs['store_instance'] = store
        return attrs


class StoreStaffSerializer(BaseModelSerializer):
    user = UserSerializer(source='user_id', read_only=True)
    store = StoreSerializer(source='store_id', read_only=True)

    class Meta:
        model = StoreStaff
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'is_active',
            'user_id',
            'store_id',
            'role',
            'user',
            'store',
        )
