from rest_framework import serializers
from utils.serializers import BaseModelSerializer
from db.models import User

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
from db.models import User, StoreStaff


class AppTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom TokenObtainPairSerializer to authenticate against db.models.User
    using email and password.
    Enforces that only users associated with an active store (StoreStaff) can log in.
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

        # Enforce store association gate:
        # A user must be assigned to at least one active, non-deleted store as staff.
        active_stores_qs = StoreStaff.objects.filter(
            user_id=user,
            is_deleted=False,
            store_id__is_active=True,
            store_id__is_deleted=False,
        ).select_related('store_id', 'store_id__organization_id')

        if not active_stores_qs.exists():
            raise exceptions.AuthenticationFailed(
                "User is not associated with any active store.",
                "no_store_association",
            )

        target_store_id = attrs.get('store_id')
        if target_store_id:
            store_match = active_stores_qs.filter(store_id_id=target_store_id).first()
            if not store_match:
                raise exceptions.AuthenticationFailed(
                    "User is not associated with the requested store.",
                    "invalid_store_association",
                )

        self.user = user
        refresh = self.get_token(self.user)

        stores_data = [
            {
                'id': str(staff.store_id.id),
                'name': staff.store_id.name,
                'role': staff.role,
                'organization_id': str(staff.store_id.organization_id_id),
            }
            for staff in active_stores_qs
        ]

        current_store = None
        if target_store_id:
            current_store = next((s for s in stores_data if s['id'] == str(target_store_id)), stores_data[0])
        elif stores_data:
            current_store = stores_data[0]

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
            }
        }


