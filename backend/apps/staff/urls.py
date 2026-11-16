from django.urls import path
from .views import (
    StaffListView,
    StaffOnboardView,
    StaffCheckEmailView,
    StaffDetailView,
)

urlpatterns = [
    path('', StaffListView.as_view(), name='staff_list'),
    path('onboard/', StaffOnboardView.as_view(), name='staff_onboard'),
    path('check-email/', StaffCheckEmailView.as_view(), name='staff_check_email'),
    path('<uuid:staff_id>/', StaffDetailView.as_view(), name='staff_detail'),
]
