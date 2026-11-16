from django.urls import path

from .views import (
    AppTokenObtainPairView,
    AppTokenRefreshView,
    ChangePasswordView,
    GoogleAuthView,
    OnboardOrganizationView,
)

urlpatterns = [
    path('auth/login/', AppTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', AppTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/google/', GoogleAuthView.as_view(), name='google_auth'),
    path('auth/onboard-organization/', OnboardOrganizationView.as_view(), name='onboard_organization'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
]
