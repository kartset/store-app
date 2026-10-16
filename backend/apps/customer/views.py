import logging
import re

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.invoice.serializers import InvoiceSerializer
from db.models import Customer, Invoice, Store, StoreCustomer

from .serializers import (
    CustomerSerializer,
)

logger = logging.getLogger(__name__)


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Customer Master management.
    Supports live search, retail vs B2B filtering, store filtering,
    instant POS mobile lookup, and purchase invoice history.
    """
    queryset = Customer.objects.filter(is_deleted=False).prefetch_related(
        'store_mappings',
        'store_mappings__store_id'
    )
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        customer_type = self.request.query_params.get('customer_type')
        is_active = self.request.query_params.get('is_active')
        store_id = self.request.query_params.get('store_id')

        if customer_type:
            qs = qs.filter(customer_type=customer_type)

        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        if store_id:
            qs = qs.filter(store_mappings__store_id_id=store_id, store_mappings__is_deleted=False)

        if search:
            search = search.strip()
            # Clean search if digits for phone matching
            cleaned_digits = re.sub(r'[\s\-\(\)\+]', '', search)
            query = (
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(gstin__icontains=search)
                | Q(city__icontains=search)
            )
            if cleaned_digits:
                query |= Q(mobile_number__icontains=cleaned_digits)
            else:
                query |= Q(mobile_number__icontains=search)

            qs = qs.filter(query)

        return qs.distinct()

    def perform_create(self, serializer):
        customer = serializer.save(created_by=self.request.user)

        # Optional: Auto-bind to store if store_id provided in creation payload
        store_id = self.request.data.get('store_id')
        if store_id:
            try:
                store = Store.objects.get(id=store_id, is_deleted=False)
                StoreCustomer.objects.get_or_create(
                    store_id=store,
                    customer_id=customer,
                    defaults={'created_by': self.request.user, 'loyalty_points': 0}
                )
            except Store.DoesNotExist:
                logger.warning(f"Store '{store_id}' not found when registering customer '{customer.id}'.")

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request):
        """
        Fast POS lookup by 10-digit mobile number.
        Returns customer details and store-specific loyalty balance.
        """
        mobile = request.query_params.get('mobile') or request.query_params.get('phone')
        if not mobile:
            return Response(
                {'error': "Query parameter 'mobile' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        cleaned = re.sub(r'[\s\-\(\)\+]', '', str(mobile))
        if cleaned.startswith('91') and len(cleaned) == 12:
            cleaned = cleaned[2:]
        elif cleaned.startswith('0') and len(cleaned) == 11:
            cleaned = cleaned[1:]

        customer = (
            Customer.objects.filter(mobile_number=cleaned, is_deleted=False)
            .prefetch_related('store_mappings', 'store_mappings__store_id')
            .first()
        )

        if not customer:
            return Response(
                {
                    'found': False,
                    'mobile_number': cleaned,
                    'customer': None,
                    'store_loyalty_points': 0,
                    'store_credit_limit': '0.00',
                    'store_outstanding_balance': '0.00',
                    'store_visits': 0,
                },
                status=status.HTTP_200_OK
            )

        store_id = request.query_params.get('store_id')
        store_customer = None
        if store_id:
            store_customer = StoreCustomer.objects.filter(
                customer_id=customer,
                store_id_id=store_id,
                is_deleted=False
            ).first()

        data = {
            'found': True,
            'customer': CustomerSerializer(customer).data,
            'store_loyalty_points': store_customer.loyalty_points if store_customer else 0,
            'store_credit_limit': str(store_customer.credit_limit) if store_customer else '0.00',
            'store_outstanding_balance': str(store_customer.outstanding_balance) if store_customer else '0.00',
            'store_visits': store_customer.total_visits if store_customer else 0,
        }

        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='invoices')
    def invoices(self, request, pk=None):
        """
        Chronological invoice purchase history for the specified customer.
        Supports filtering by store_id.
        """
        customer = self.get_object()
        store_id = request.query_params.get('store_id')

        qs = Invoice.objects.filter(customer_id=customer, is_deleted=False).select_related('store_id').order_by('-created_at')
        if store_id:
            qs = qs.filter(store_id_id=store_id)

        serializer = InvoiceSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
