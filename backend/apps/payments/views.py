import json
from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.payments.gateway import get_payment_gateway
from apps.payments.serializers import (
    CreateOrderRequestSerializer,
    CreateOrderResponseSerializer,
    PaymentStatusSerializer,
    VerifyPaymentRequestSerializer,
)
from db.models import (
    CashRegisterSession,
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    RegisterSessionStatus,
)


class PaymentViewSet(viewsets.ViewSet):
    """
    Payment Gateway and Dynamic UPI QR processing for retail counters.
    """
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='create_order')
    def create_order(self, request):
        """
        Creates a payment gateway order and dynamic UPI QR intent for an invoice.
        """
        serializer = CreateOrderRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invoice = get_object_or_404(Invoice, id=data['invoice_id'], is_deleted=False)

        # Calculate remaining balance
        already_paid = sum(
            (p.amount for p in invoice.payments.filter(status='SUCCESS', is_deleted=False)),
            Decimal('0.00')
        )
        remaining_balance = invoice.grand_total - already_paid

        if remaining_balance <= Decimal('0.00'):
            return Response(
                {"error": "This invoice is already fully paid."},
                status=status.HTTP_400_BAD_REQUEST
            )

        pay_amount = data.get('amount') or remaining_balance
        if pay_amount > remaining_balance:
            pay_amount = remaining_balance

        gateway = get_payment_gateway()
        method = data.get('method', PaymentMethod.UPI)
        vpa_override = data.get('vpa')

        upi_data = gateway.generate_upi_payload(
            invoice=invoice,
            amount=pay_amount,
            store_vpa=vpa_override
        )

        # Create or update pending Payment record
        with transaction.atomic():
            payment = Payment.objects.create(
                invoice_id=invoice,
                method=method,
                amount=pay_amount,
                status='PENDING',
                gateway_order_id=upi_data['gateway_order_id'],
                gateway_response=upi_data,
            )

        response_data = {
            "gateway_order_id": upi_data['gateway_order_id'],
            "payment_id": payment.id,
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "amount": pay_amount,
            "currency": upi_data.get('currency', 'INR'),
            "intent_uri": upi_data.get('intent_uri', ''),
            "vpa": upi_data.get('vpa', ''),
            "payee_name": upi_data.get('payee_name', ''),
            "transaction_ref": upi_data.get('transaction_ref', invoice.invoice_number),
            "mode": upi_data.get('mode', 'MOCK'),
        }

        resp_serializer = CreateOrderResponseSerializer(response_data)
        return Response(resp_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='verify')
    def verify_payment(self, request):
        """
        Verifies client checkout signature, captures payment, and settles invoice.
        """
        serializer = VerifyPaymentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invoice = get_object_or_404(Invoice, id=data['invoice_id'], is_deleted=False)
        order_id = data['razorpay_order_id']
        pay_id = data['razorpay_payment_id']
        signature = data['razorpay_signature']

        gateway = get_payment_gateway()
        is_valid = gateway.verify_payment_signature(
            order_id=order_id,
            payment_id=pay_id,
            signature=signature
        )

        if not is_valid:
            # Mark payment as failed if matching payment exists
            Payment.objects.filter(
                invoice_id=invoice,
                gateway_order_id=order_id
            ).update(status='FAILED')
            return Response(
                {"error": "Payment signature verification failed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            payment = Payment.objects.filter(
                invoice_id=invoice,
                gateway_order_id=order_id
            ).first()

            if not payment:
                # If created directly on client without prior create_order
                payment = Payment.objects.create(
                    invoice_id=invoice,
                    method=PaymentMethod.UPI,
                    amount=invoice.grand_total,
                    gateway_order_id=order_id,
                )

            payment.status = 'SUCCESS'
            payment.external_transaction_id = pay_id
            payment.gateway_signature = signature
            payment.save()

            # Check if invoice is now fully paid
            total_settled = sum(
                (p.amount for p in invoice.payments.filter(status='SUCCESS', is_deleted=False)),
                Decimal('0.00')
            )

            if total_settled >= invoice.grand_total:
                invoice.status = InvoiceStatus.PAID
                invoice.save()

            # Update active cash register session shift totals
            active_session = CashRegisterSession.objects.filter(
                store_id=invoice.store_id,
                status=RegisterSessionStatus.OPEN,
                is_deleted=False
            ).first()

            if active_session:
                if payment.method == PaymentMethod.UPI:
                    active_session.total_upi_sales += payment.amount
                elif payment.method in [PaymentMethod.CARD, PaymentMethod.RAZORPAY]:
                    active_session.total_card_sales += payment.amount
                active_session.save()

        return Response({
            "message": "Payment verified and captured successfully.",
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "invoice_status": invoice.status,
            "payment_id": str(payment.id),
            "amount_paid": str(payment.amount),
            "total_settled": str(total_settled),
            "balance_remaining": str(max(Decimal('0.00'), invoice.grand_total - total_settled)),
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='status')
    def payment_status(self, request):
        """
        Polls payment status by payment_id or (invoice_id and gateway_order_id).
        """
        payment_id = request.query_params.get('payment_id')
        gateway_order_id = request.query_params.get('gateway_order_id')
        invoice_id = request.query_params.get('invoice_id')

        payment = None
        if payment_id:
            payment = Payment.objects.filter(id=payment_id, is_deleted=False).first()
        elif gateway_order_id:
            payment = Payment.objects.filter(gateway_order_id=gateway_order_id, is_deleted=False).first()
        elif invoice_id:
            payment = Payment.objects.filter(invoice_id=invoice_id, is_deleted=False).order_by('-created_at').first()

        if not payment:
            return Response(
                {"error": "Payment record not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PaymentStatusSerializer(payment)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='webhook')
    def webhook(self, request):
        """
        Asynchronous webhook listener for Razorpay payment events (e.g. payment.captured).
        """
        signature = request.headers.get('X-Razorpay-Signature', '')
        gateway = get_payment_gateway()

        # In mock mode, if signature is omitted, process payload; otherwise verify
        if signature and not gateway.verify_webhook_signature(request.body, signature):
            return Response(
                {"error": "Invalid webhook signature."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            event_payload = json.loads(request.body.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return Response({"error": "Malformed JSON"}, status=status.HTTP_400_BAD_REQUEST)

        event_name = event_payload.get('event')
        entity_payload = event_payload.get('payload', {}).get('payment', {}).get('entity', {})
        order_id = entity_payload.get('order_id')
        payment_id = entity_payload.get('id')
        notes = entity_payload.get('notes', {})

        if event_name in ['payment.captured', 'order.paid'] and order_id:
            with transaction.atomic():
                payment = Payment.objects.filter(gateway_order_id=order_id).first()
                if payment and payment.status != 'SUCCESS':
                    payment.status = 'SUCCESS'
                    payment.external_transaction_id = payment_id or payment.external_transaction_id
                    payment.save()

                    invoice = payment.invoice_id
                    total_settled = sum(
                        (p.amount for p in invoice.payments.filter(status='SUCCESS', is_deleted=False)),
                        Decimal('0.00')
                    )
                    if total_settled >= invoice.grand_total:
                        invoice.status = InvoiceStatus.PAID
                        invoice.save()

                    # Update active shift
                    active_session = CashRegisterSession.objects.filter(
                        store_id=invoice.store_id,
                        status=RegisterSessionStatus.OPEN,
                        is_deleted=False
                    ).first()
                    if active_session:
                        if payment.method == PaymentMethod.UPI:
                            active_session.total_upi_sales += payment.amount
                        elif payment.method in [PaymentMethod.CARD, PaymentMethod.RAZORPAY]:
                            active_session.total_card_sales += payment.amount
                        active_session.save()

        return Response({"status": "received"}, status=status.HTTP_200_OK)
