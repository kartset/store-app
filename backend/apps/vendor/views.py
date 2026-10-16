import logging

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from db.models import Vendor, VendorProduct

from .serializers import VendorProductSerializer, VendorSerializer

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


class VendorProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Vendor-Product procurement catalog and negotiated cost pricing.
    Supports filtering by vendor, product, primary supplier status, and search.
    """
    queryset = (
        VendorProduct.objects.filter(is_deleted=False)
        .select_related('vendor_id', 'product_id', 'vendor_id__organization_id')
        .order_by('vendor_id__name', 'product_id__name')
    )
    serializer_class = VendorProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        vendor_id = self.request.query_params.get('vendor_id')
        product_id = self.request.query_params.get('product_id')
        org_id = self.request.query_params.get('organization_id')
        is_primary = self.request.query_params.get('is_primary_supplier')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')

        if vendor_id:
            qs = qs.filter(vendor_id_id=vendor_id)

        if product_id:
            qs = qs.filter(product_id_id=product_id)

        if org_id:
            qs = qs.filter(vendor_id__organization_id_id=org_id)

        if is_primary is not None:
            qs = qs.filter(is_primary_supplier=is_primary.lower() in ('true', '1'))

        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))

        if search:
            search = search.strip()
            qs = qs.filter(
                Q(product_id__name__icontains=search) |
                Q(product_id__sku__icontains=search) |
                Q(product_id__barcode__icontains=search) |
                Q(vendor_sku__icontains=search) |
                Q(vendor_id__name__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
