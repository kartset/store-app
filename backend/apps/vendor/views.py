import logging

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from db.models import Vendor

from .serializers import VendorSerializer

logger = logging.getLogger(__name__)


class VendorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Organization Vendors and Suppliers.
    Supports organization scoping, multi-field search, payment term filters, and soft deletion.
    """
    queryset = Vendor.objects.filter(is_deleted=False).select_related('organization_id').order_by('name')
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        is_active = self.request.query_params.get('is_active')
        payment_terms = self.request.query_params.get('payment_terms')
        state_code = self.request.query_params.get('state_code')
        search = self.request.query_params.get('search')

        if org_id:
            qs = qs.filter(organization_id_id=org_id)

        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))

        if payment_terms:
            qs = qs.filter(payment_terms__iexact=payment_terms)

        if state_code:
            qs = qs.filter(state_code__iexact=state_code)

        if search:
            search = search.strip()
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(trade_name__icontains=search) |
                Q(vendor_code__icontains=search) |
                Q(gstin__icontains=search) |
                Q(pan_number__icontains=search) |
                Q(contact_person__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
