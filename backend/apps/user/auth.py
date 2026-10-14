from django.contrib.auth.backends import BaseBackend
from rest_framework_simplejwt.authentication import JWTAuthentication
from db.models import User


class AppUserBackend(BaseBackend):
    """
    Authenticates application users (db.models.User) using email and password.
    """
    def authenticate(self, request, email=None, password=None, **kwargs):
        if not email or not password:
            return None
        try:
            user = User.objects.get(email=email, is_deleted=False)
        except User.DoesNotExist:
            return None

        if user.check_password(password) and user.is_active:
            return user
        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id, is_deleted=False)
        except User.DoesNotExist:
            return None


class AppJWTAuthentication(JWTAuthentication):
    """
    SimpleJWT Authentication class pointing explicitly to db.models.User
    instead of settings.AUTH_USER_MODEL.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_model = User
