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

class AppTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom TokenObtainPairSerializer to authenticate against db.models.User
    using email and password.
    """
    username_field = 'email'

    def validate(self, attrs):
        email = attrs.get(self.username_field)
        password = attrs.get('password')

        user = None
        try:
            candidate = User.objects.get(email=email, is_deleted=False)
            if candidate.check_password(password):
                user = candidate
        except User.DoesNotExist:
            pass

        if user is None or not user.is_active:
            raise exceptions.AuthenticationFailed(
                self.error_messages['no_active_account'],
                'no_active_account',
            )

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
            }
        }

