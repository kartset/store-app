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
            'must_change_password',
            'last_login',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'last_login')


import json
import urllib.error
import urllib.request

from django.db import transaction
from django.utils.text import slugify
from rest_framework import exceptions
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings

from db.models import Organization, OrganizationStaff, Store, StoreStaff, User
from utils.serializers import BaseModelSerializer


def build_auth_payload(user, target_store_id=None):
    """
    Builds the standard JWT authentication response payload for a user,
    including their active store memberships, organization memberships,
    and resolving their primary active store context.
    """
    active_stores_qs = StoreStaff.objects.filter(
        user_id=user,
        is_deleted=False,
        store_id__is_active=True,
        store_id__is_deleted=False,
    ).select_related('store_id', 'store_id__organization_id')

    active_org_staff_qs = OrganizationStaff.objects.filter(
        user_id=user,
        is_active=True,
        is_deleted=False,
        organization_id__is_active=True,
        organization_id__is_deleted=False,
    ).select_related('organization_id')

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

    current_store = None
    if target_store_id:
        current_store = next((s for s in stores_data if s['id'] == str(target_store_id)), None)
        if not current_store and is_org_admin:
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

    if not current_store and stores_data:
        current_store = stores_data[0]
    elif not current_store and orgs_data:
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

    refresh = AppTokenObtainPairSerializer.get_token(user)

    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': {
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'current_store': current_store,
            'stores': stores_data,
            'organizations': orgs_data,
            'is_org_admin': is_org_admin,
            'must_change_password': getattr(user, 'must_change_password', False),
        }
    }


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
                'must_change_password': getattr(self.user, 'must_change_password', False),
            }
        }




class AppTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Token refresh serializer that resolves the user from db.models.User (UUID PK)
    instead of the default integer auth.User model.
    """
    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])
        user_id = refresh[api_settings.USER_ID_CLAIM]
        try:
            user = User.objects.get(id=user_id, is_deleted=False)
        except (User.DoesNotExist, ValueError):
            raise exceptions.AuthenticationFailed("User not found", "user_not_found")
        if not user.is_active:
            raise exceptions.AuthenticationFailed("User is inactive", "user_inactive")

        data = {"access": str(refresh.access_token)}
        if api_settings.ROTATE_REFRESH_TOKENS:
            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()
            data["refresh"] = str(refresh)

        return data


def verify_google_id_token(id_token: str) -> dict:
    """
    Verifies a Google ID token.
    Supports local/dev mock tokens for testing and offline environments:
      - 'mock:<email>:<first_name>:<last_name>'
      - 'mock-<email>'
      - 'dev-google-token'
    For real tokens, queries Google's tokeninfo API endpoint.
    """
    if not id_token or not isinstance(id_token, str):
        raise serializers.ValidationError({"id_token": "Google ID token is required."})

    token = id_token.strip()

    # Dev/Mock simulation tokens
    if token.startswith("mock:"):
        parts = token.split(":")
        email = parts[1].strip() if len(parts) > 1 and parts[1].strip() else "owner@example.com"
        first_name = parts[2].strip() if len(parts) > 2 else "Demo"
        last_name = parts[3].strip() if len(parts) > 3 else "Owner"
        return {
            "email": email.lower(),
            "first_name": first_name,
            "last_name": last_name,
            "sub": f"mock-{email.lower()}",
            "is_mock": True,
        }
    elif token.startswith(("mock-", "dev-")):
        token_clean = token.replace("mock-", "").replace("dev-", "").strip()
        email = token_clean if "@" in token_clean else "dev-owner@example.com"
        return {
            "email": email.lower(),
            "first_name": "Dev",
            "last_name": "Owner",
            "sub": f"mock-{email.lower()}",
            "is_mock": True,
        }

    # Real Google ID token verification via Google API
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
        req = urllib.request.Request(url, headers={"User-Agent": "StoreApp-Onboarding/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status != 200:
                raise serializers.ValidationError({"id_token": "Failed to verify Google ID token."})
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise serializers.ValidationError({"id_token": f"Invalid Google ID token: {e.reason}"})
    except (urllib.error.URLError, ValueError, TimeoutError) as e:
        raise serializers.ValidationError({"id_token": f"Google token verification failed: {e!s}"})

    email = data.get("email")
    if not email:
        raise serializers.ValidationError({"id_token": "Google token does not contain an email address."})

    email_verified = data.get("email_verified")
    if email_verified is not None and str(email_verified).lower() not in ("true", "1"):
        raise serializers.ValidationError({"id_token": "Google account email is not verified."})

    first_name = data.get("given_name", "")
    last_name = data.get("family_name", "")
    if not first_name and data.get("name"):
        name_parts = data["name"].split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

    return {
        "email": email.lower(),
        "first_name": first_name,
        "last_name": last_name,
        "sub": data.get("sub", ""),
        "picture": data.get("picture", ""),
        "is_mock": False,
    }


class GoogleAuthSerializer(serializers.Serializer):
    """
    Serializes and verifies a Google sign-in attempt.
    If the user exists and has store/org access, returns JWT credentials.
    If the user does not exist or has no memberships, returns profile with registered=False.
    """
    id_token = serializers.CharField(write_only=True)

    def validate(self, attrs):
        id_token = attrs.get('id_token')
        google_info = verify_google_id_token(id_token)
        email = google_info['email']

        user = User.objects.filter(email__iexact=email, is_deleted=False).first()
        if not user:
            return {
                'registered': False,
                'email': email,
                'first_name': google_info.get('first_name', ''),
                'last_name': google_info.get('last_name', ''),
                'message': 'User not registered. Please complete organization onboarding.',
            }

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User account is inactive.', 'user_inactive')

        # Check store / org memberships
        active_stores_qs = StoreStaff.objects.filter(
            user_id=user,
            is_deleted=False,
            store_id__is_active=True,
            store_id__is_deleted=False,
        )
        active_org_staff_qs = OrganizationStaff.objects.filter(
            user_id=user,
            is_active=True,
            is_deleted=False,
            organization_id__is_active=True,
            organization_id__is_deleted=False,
        )

        if not active_stores_qs.exists() and not active_org_staff_qs.exists():
            return {
                'registered': False,
                'email': email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'message': 'User has no active organization or store membership. Please complete onboarding.',
            }

        payload = build_auth_payload(user)
        payload['registered'] = True
        return payload


class OnboardOrganizationSerializer(serializers.Serializer):
    """
    Onboards a new organization owner:
    1. Verifies Google ID token.
    2. Provisions Organization with slugified subdomain.
    3. Provisions initial flagship Store.
    4. Grants user ORG_ADMIN in OrganizationStaff and ADMIN in StoreStaff.
    5. Returns standard auth payload with JWT access & refresh tokens.
    """
    id_token = serializers.CharField(write_only=True)
    organization_name = serializers.CharField(max_length=255)
    subdomain = serializers.CharField(max_length=255, required=False, allow_blank=True)
    store_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='Main Flagship Store')
    store_address = serializers.CharField(required=False, allow_blank=True, default='')
    gst_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)

    def validate_subdomain(self, value):
        if value:
            clean = slugify(value)
            if not clean:
                raise serializers.ValidationError("Invalid subdomain format.")
            if Organization.objects.filter(subdomain=clean, is_deleted=False).exists():
                raise serializers.ValidationError(f"Subdomain '{clean}' is already in use.")
            return clean
        return value

    def validate(self, attrs):
        id_token = attrs.get('id_token')
        google_info = verify_google_id_token(id_token)
        attrs['google_info'] = google_info

        org_name = attrs.get('organization_name', '').strip()
        if not org_name:
            raise serializers.ValidationError({'organization_name': 'Organization name is required.'})

        subdomain = attrs.get('subdomain')
        if not subdomain:
            base_slug = slugify(org_name) or 'org'
            candidate_slug = base_slug
            counter = 1
            while Organization.objects.filter(subdomain=candidate_slug, is_deleted=False).exists():
                candidate_slug = f"{base_slug}-{counter}"
                counter += 1
            attrs['subdomain'] = candidate_slug
        else:
            attrs['subdomain'] = subdomain.lower()

        password = attrs.get('password')
        if password and len(password.strip()) < 6:
            raise serializers.ValidationError({'password': 'Password must be at least 6 characters long.'})

        return attrs

    def create(self, validated_data):
        google_info = validated_data['google_info']
        email = google_info['email'].lower()
        first_name = google_info.get('first_name', '')
        last_name = google_info.get('last_name', '')
        org_name = validated_data['organization_name'].strip()
        subdomain = validated_data['subdomain']
        store_name = (validated_data.get('store_name') or '').strip() or 'Main Flagship Store'
        store_address = (validated_data.get('store_address') or '').strip()
        gst_number = (validated_data.get('gst_number') or '').strip()
        password = (validated_data.get('password') or '').strip()

        with transaction.atomic():
            user = User.objects.filter(email__iexact=email, is_deleted=False).first()
            if not user:
                user = User.objects.create(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True,
                )
            else:
                updated = False
                if not user.first_name and first_name:
                    user.first_name = first_name
                    updated = True
                if not user.last_name and last_name:
                    user.last_name = last_name
                    updated = True
                if not user.is_active:
                    user.is_active = True
                    updated = True
                if updated:
                    user.save()

            if password:
                user.set_password(password)
                user.save()

            organization = Organization.objects.create(
                name=org_name,
                subdomain=subdomain,
                is_active=True,
            )

            store = Store.objects.create(
                organization_id=organization,
                name=store_name,
                address=store_address,
                gst_number=gst_number,
                is_active=True,
            )

            OrganizationStaff.objects.create(
                user_id=user,
                organization_id=organization,
                role='ORG_ADMIN',
                is_active=True,
            )

            StoreStaff.objects.create(
                user_id=user,
                store_id=store,
                role='ADMIN',
            )

            auth_payload = build_auth_payload(user, target_store_id=store.id)
            auth_payload['organization'] = {
                'id': str(organization.id),
                'name': organization.name,
                'subdomain': organization.subdomain,
            }
            auth_payload['store'] = {
                'id': str(store.id),
                'name': store.name,
                'address': store.address,
                'gst_number': store.gst_number,
            }
            return auth_payload


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        user = self.context['request'].user
        if user.check_password(value):
            raise serializers.ValidationError("New password cannot be the same as the old password.")
        return value

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.must_change_password = False
        user.save()
        return user





