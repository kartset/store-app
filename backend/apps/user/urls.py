from django.urls import path
from .views import AppTokenObtainPairView, AppTokenRefreshView

urlpatterns = [
    path('auth/login/', AppTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', AppTokenRefreshView.as_view(), name='token_refresh'),
]
