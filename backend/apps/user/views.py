from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import AppTokenObtainPairSerializer, AppTokenRefreshSerializer

class AppTokenObtainPairView(TokenObtainPairView):
    serializer_class = AppTokenObtainPairSerializer

class AppTokenRefreshView(TokenRefreshView):
    serializer_class = AppTokenRefreshSerializer
