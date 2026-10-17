from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.delivery.serializers import (
    AssignDriverSerializer,
    DeliveryCreateSerializer,
    DeliverySerializer,
    UpdateStatusSerializer,
    VerifyOTPSerializer,
)
from db.models import (
    Delivery,
    DeliveryStatus,
    Order,
    OrderPaymentStatus,
    OrderStatus,
)


class DeliveryViewSet(viewsets.ModelViewSet):
    """
    Delivery & Dispatch Operations ViewSet:
    - Lists deliveries with store scoping, status tabs, date ranges, and search.
    - Driver allocation (internal driver or 3rd party courier).
    - Dispatch out-for-delivery triggering.
    - Secure customer OTP verification for completed handoff and COD settlement.
    - Pipeline summary endpoint for fast tab counts.
    """
    queryset = Delivery.objects.filter(is_deleted=False).select_related(
        'store_id', 'order_id', 'invoice_id'
    ).order_by('-created_at')
    serializer_class = DeliverySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()

        store_id = self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id=store_id)

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)

        delivery_type = self.request.query_params.get('delivery_type')
        if delivery_type:
            qs = qs.filter(delivery_type=delivery_type)

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(tracking_id__icontains=search)
                | Q(recipient_name__icontains=search)
                | Q(recipient_phone__icontains=search)
                | Q(driver_name__icontains=search)
                | Q(driver_phone__icontains=search)
                | Q(order_id__order_number__icontains=search)
            )

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = DeliveryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delivery = serializer.save()
        output = DeliverySerializer(delivery)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='assign-driver')
    def assign_driver(self, request, pk=None):
        delivery = self.get_object()
        serializer = AssignDriverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        delivery.assign_driver(
            driver_name=data['driver_name'],
            driver_phone=data['driver_phone'],
            vehicle_number=data.get('vehicle_number'),
            partner=data.get('delivery_partner'),
            delivery_type=data.get('delivery_type', delivery.delivery_type)
        )

        if data.get('mark_out_for_delivery'):
            delivery.mark_out_for_delivery()
            if delivery.order_id and delivery.order_id.status in [OrderStatus.CONFIRMED, OrderStatus.PACKED]:
                delivery.order_id.status = OrderStatus.READY_FOR_PICKUP
                delivery.order_id.save(update_fields=['status'])

        return Response(DeliverySerializer(delivery).data)

    @action(detail=True, methods=['post'], url_path='dispatch')
    def dispatch_package(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status in [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED]:
            return Response(
                {'error': f"Cannot dispatch delivery in {delivery.status} state."},
                status=status.HTTP_400_BAD_REQUEST
            )

        delivery.mark_out_for_delivery()

        if delivery.order_id and delivery.order_id.status in [OrderStatus.CONFIRMED, OrderStatus.PACKED]:
            delivery.order_id.status = OrderStatus.READY_FOR_PICKUP
            delivery.order_id.save(update_fields=['status'])

        return Response(DeliverySerializer(delivery).data)

    @action(detail=True, methods=['post'], url_path='verify-otp')
    @transaction.atomic
    def verify_otp(self, request, pk=None):
        delivery = self.get_object()
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entered_otp = serializer.validated_data['otp_code']
        cod_collected = serializer.validated_data.get('cod_amount_collected')
        cod_method = serializer.validated_data.get('cod_payment_method', 'CASH')

        success = delivery.verify_and_deliver(
            entered_otp=entered_otp,
            cod_collected=cod_collected,
            cod_method=cod_method
        )

        if not success:
            return Response(
                {'error': 'Invalid delivery OTP code. Please verify with recipient.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reconcile linked Order if applicable
        if delivery.order_id:
            order = delivery.order_id
            order.status = OrderStatus.COMPLETED
            if delivery.is_cod and cod_collected:
                order.payment_status = OrderPaymentStatus.PAID
            order.save()

        return Response(DeliverySerializer(delivery).data)

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        delivery = self.get_object()
        serializer = UpdateStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        reason = serializer.validated_data.get('reason')

        if new_status == DeliveryStatus.FAILED:
            delivery.mark_failed(reason or 'Customer unavailable')
        elif new_status == DeliveryStatus.RETURNED:
            delivery.mark_returned(reason or 'Returned to store inventory')
        elif new_status == DeliveryStatus.CANCELLED:
            delivery.cancel(reason or 'Cancelled by operator')
        elif new_status == DeliveryStatus.OUT_FOR_DELIVERY:
            delivery.mark_out_for_delivery()
        else:
            delivery.status = new_status
            delivery.save(update_fields=['status'])

        return Response(DeliverySerializer(delivery).data)

    @action(detail=False, methods=['get'], url_path='pipeline-summary')
    def pipeline_summary(self, request):
        qs = Delivery.objects.filter(is_deleted=False)
        store_id = request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id=store_id)

        aggregates = qs.aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status=DeliveryStatus.PENDING)),
            assigned=Count('id', filter=Q(status=DeliveryStatus.ASSIGNED)),
            out_for_delivery=Count('id', filter=Q(status=DeliveryStatus.OUT_FOR_DELIVERY)),
            delivered=Count('id', filter=Q(status=DeliveryStatus.DELIVERED)),
            failed=Count('id', filter=Q(status=DeliveryStatus.FAILED)),
            returned=Count('id', filter=Q(status=DeliveryStatus.RETURNED)),
            cancelled=Count('id', filter=Q(status=DeliveryStatus.CANCELLED)),
        )
        return Response(aggregates)
