from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    AppTokenObtainPairSerializer,
    AppTokenRefreshSerializer,
    ChangePasswordSerializer,
    GoogleAuthSerializer,
    OnboardOrganizationSerializer,
)


class AppTokenObtainPairView(TokenObtainPairView):
    serializer_class = AppTokenObtainPairSerializer


class AppTokenRefreshView(TokenRefreshView):
    serializer_class = AppTokenRefreshSerializer


class GoogleAuthView(APIView):
    """
    Endpoint for Google Sign-In verification.
    If the user exists and has store or org memberships, returns JWT credentials.
    Otherwise returns registered=False so the client can trigger onboarding.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class OnboardOrganizationView(APIView):
    """
    Endpoint for creating a new Organization, flagship Store, and
    onboarding the owner as ORG_ADMIN and Store ADMIN.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = OnboardOrganizationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_201_CREATED)


class ChangePasswordView(APIView):
    """
    Endpoint for authenticated users to change their password.
    Clears the must_change_password flag upon successful password update.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            "detail": "Password updated successfully.",
            "must_change_password": user.must_change_password
        }, status=status.HTTP_200_OK)

