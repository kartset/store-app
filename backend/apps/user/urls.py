from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import AppTokenObtainPairView

urlpatterns = [
    path('auth/login/', AppTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
