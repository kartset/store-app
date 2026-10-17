from decimal import Decimal
import logging
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from db.models import (
    CashRegisterSession,
    CashTransaction,
    CashTransactionType,
    RegisterSessionStatus,
    Store,
)
from .serializers import (
    CashDropRequestSerializer,
    CashRegisterSessionSerializer,
    CashTransactionSerializer,
    CloseRegisterRequestSerializer,
    OpenRegisterRequestSerializer,
)

logger = logging.getLogger(__name__)


class CashRegisterSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Cash Register Sessions and Drawer Management.
    Supports shift opening, mid-shift cash drops/payouts, active shift status,
    and End-of-Day (EOD) closure with denomination count and variance calculation.
    """
    queryset = CashRegisterSession.objects.filter(is_deleted=False).select_related(
        'store_id', 'cashier_id', 'closed_by'
    ).prefetch_related('transactions').order_by('-opened_at')
    serializer_class = CashRegisterSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store_id')
        session_status = self.request.query_params.get('status')
        cashier_id = self.request.query_params.get('cashier_id')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if store_id:
            qs = qs.filter(store_id_id=store_id)
        if session_status:
            qs = qs.filter(status=session_status)
        if cashier_id:
            qs = qs.filter(cashier_id_id=cashier_id)
        if start_date:
            qs = qs.filter(opened_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(opened_at__date__lte=end_date)

        return qs

    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        """
        Retrieve the current open register session for the given store.
        GET /api/registers/current/?store_id=<uuid>
        """
        store_id = request.query_params.get('store_id')
        if not store_id:
            return Response(
                {'error': 'store_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        active_session = CashRegisterSession.objects.filter(
            store_id_id=store_id,
            status=RegisterSessionStatus.OPEN,
            is_deleted=False
        ).select_related('store_id', 'cashier_id').prefetch_related('transactions').first()

        if not active_session:
            return Response({
                'is_open': False,
                'session': None,
            }, status=status.HTTP_200_OK)

        serializer = self.get_serializer(active_session)
        return Response({
            'is_open': True,
            'session': serializer.data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='open')
    @transaction.atomic
    def open_session(self, request):
        """
        Open a new Cash Register Shift Session with an initial cash float.
        POST /api/registers/open/
        """
        serializer = OpenRegisterRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        store_id = serializer.validated_data['store_id']
        opening_float = serializer.validated_data.get('opening_float', Decimal('0.00'))

        try:
            store = Store.objects.get(id=store_id, is_deleted=False)
        except Store.DoesNotExist:
            return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if an open session already exists for this store
        existing_open = CashRegisterSession.objects.filter(
            store_id=store,
            status=RegisterSessionStatus.OPEN,
            is_deleted=False
        ).first()

        if existing_open:
            return Response(
                {
                    'error': f'Register session #{existing_open.session_number} is already OPEN for {store.name}. Please close the active session first.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        session = CashRegisterSession.objects.create(
            store_id=store,
            cashier_id=request.user,
            opening_float=opening_float,
            expected_cash=opening_float,
            status=RegisterSessionStatus.OPEN,
            opened_at=timezone.now(),
            created_by=request.user,
        )

        # Create opening float transaction record
        if opening_float > 0:
            CashTransaction.objects.create(
                session_id=session,
                type=CashTransactionType.OPENING_FLOAT,
                amount=opening_float,
                reason="Opening drawer cash float",
                created_by=request.user,
            )

        return Response(self.get_serializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='drop')
    @transaction.atomic
    def cash_drop(self, request, pk=None):
        """
        Record a cash drop to store safe or petty cash expense.
        POST /api/registers/{id}/drop/
        """
        session = self.get_object()
        if session.status != RegisterSessionStatus.OPEN:
            return Response(
                {'error': 'Cannot record cash drops on a closed register session'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CashDropRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data['amount']
        drop_type = serializer.validated_data.get('type', CashTransactionType.CASH_DROP)
        reason = serializer.validated_data['reason']

        if amount > session.expected_cash:
            return Response(
                {
                    'error': f'Drop amount (₹{amount}) exceeds current expected cash in drawer (₹{session.expected_cash})'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Decrement expected cash in drawer
        session.expected_cash = Decimal(str(session.expected_cash)) - Decimal(str(amount))
        session.save(update_fields=['expected_cash'])

        # Create transaction audit record
        transaction_record = CashTransaction.objects.create(
            session_id=session,
            type=drop_type,
            amount=amount,
            reason=reason,
            created_by=request.user,
        )

        return Response(
            {
                'message': f'Recorded {drop_type} of ₹{amount}',
                'transaction': CashTransactionSerializer(transaction_record).data,
                'session': self.get_serializer(session).data,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='close')
    @transaction.atomic
    def close_session(self, request, pk=None):
        """
        Close register session at end of shift with physical cash count.
        Calculates cash variance and produces the End-of-Day Z-Report.
        POST /api/registers/{id}/close/
        """
        session = self.get_object()
        if session.status != RegisterSessionStatus.OPEN:
            return Response(
                {'error': 'Register session is already closed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CloseRegisterRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        counted_cash = Decimal(str(serializer.validated_data['closing_cash_counted']))
        denomination_breakdown = serializer.validated_data.get('denomination_breakdown', {})
        closing_notes = serializer.validated_data.get('closing_notes', '')

        variance = counted_cash - Decimal(str(session.expected_cash))

        session.closing_cash_counted = counted_cash
        session.cash_variance = variance
        session.denomination_breakdown = denomination_breakdown
        session.closing_notes = closing_notes
        session.status = RegisterSessionStatus.CLOSED
        session.closed_at = timezone.now()
        session.closed_by = request.user
        session.save()

        return Response(self.get_serializer(session).data, status=status.HTTP_200_OK)
