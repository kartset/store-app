import json
from decimal import Decimal
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.payments.gateway import (
    MockPaymentGateway,
    build_upi_intent_uri,
    get_payment_gateway,
)
from db.models import (
    CashRegisterSession,
    Category,
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Organization,
    Payment,
    PaymentMethod,
    RegisterSessionStatus,
    Store,
    User,
)


class PaymentGatewayTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='cashier@payments.com',
            password='testpassword123',
            first_name='Rohan',
            last_name='Sharma'
        )
        self.client.force_authenticate(user=self.user)

        self.org = Organization.objects.create(name='Fresh Mart Ltd')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Fresh Mart Indiranagar',
            gst_number='29AAAAA0000A1Z5'
        )
        self.category = Category.objects.create(
            name='Beverages',
            slug='beverages',
            default_tax_slab=Decimal('18.00')
        )

        self.invoice = Invoice.objects.create(
            store_id=self.store,
            type=InvoiceType.POS,
            status=InvoiceStatus.DRAFT,
            subtotal=Decimal('500.00'),
            total_gst=Decimal('90.00'),
            grand_total=Decimal('590.00'),
            round_off=Decimal('0.00'),
            invoice_number='INV-FRESH-20261017-0001'
        )

    def test_build_upi_intent_uri(self):
        """Verify standard NPCI UPI URI generation format."""
        uri = build_upi_intent_uri(
            vpa='freshmart@icici',
            payee_name='Fresh Mart Retail',
            amount=Decimal('590.00'),
            transaction_ref='INV-001',
            note='Counter checkout'
        )
        self.assertTrue(uri.startswith('upi://pay?'))
        self.assertIn('pa=freshmart%40icici', uri)
        self.assertIn('pn=Fresh%20Mart%20Retail', uri)
        self.assertIn('am=590.00', uri)
        self.assertIn('cu=INR', uri)
        self.assertIn('tr=INV-001', uri)

    def test_create_order_endpoint(self):
        """Verify POST /api/payments/create_order/ creates pending payment and returns UPI data."""
        payload = {
            'invoice_id': str(self.invoice.id),
            'method': PaymentMethod.UPI,
        }
        res = self.client.post('/api/payments/create_order/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data
        self.assertTrue(data['gateway_order_id'].startswith('order_mock_'))
        self.assertEqual(data['amount'], '590.00')
        self.assertTrue(data['intent_uri'].startswith('upi://pay?'))
        self.assertEqual(data['transaction_ref'], 'INV-FRESH-20261017-0001')

        # Verify DB Payment record
        payment = Payment.objects.get(id=data['payment_id'])
        self.assertEqual(payment.status, 'PENDING')
        self.assertEqual(payment.amount, Decimal('590.00'))
        self.assertEqual(payment.gateway_order_id, data['gateway_order_id'])

    def test_create_order_already_paid_rejected(self):
        """Verify cannot create payment order for already paid invoice."""
        self.invoice.status = InvoiceStatus.PAID
        self.invoice.save()
        Payment.objects.create(
            invoice_id=self.invoice,
            method=PaymentMethod.CASH,
            amount=Decimal('590.00'),
            status='SUCCESS'
        )

        res = self.client.post('/api/payments/create_order/', {
            'invoice_id': str(self.invoice.id),
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already fully paid", res.data['error'])

    def test_verify_payment_success_and_invoice_settlement(self):
        """Verify signature verification transitions payment and invoice to PAID."""
        gateway = get_payment_gateway()
        order_res = self.client.post('/api/payments/create_order/', {
            'invoice_id': str(self.invoice.id),
            'method': PaymentMethod.UPI,
        }, format='json')
        self.assertEqual(order_res.status_code, status.HTTP_201_CREATED)
        order_id = order_res.data['gateway_order_id']

        pay_id = 'pay_mock_123456789'
        valid_signature = gateway.generate_mock_signature(order_id, pay_id)

        verify_payload = {
            'invoice_id': str(self.invoice.id),
            'razorpay_order_id': order_id,
            'razorpay_payment_id': pay_id,
            'razorpay_signature': valid_signature,
        }

        res = self.client.post('/api/payments/verify/', verify_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, InvoiceStatus.PAID)

        payment = Payment.objects.get(gateway_order_id=order_id)
        self.assertEqual(payment.status, 'SUCCESS')
        self.assertEqual(payment.external_transaction_id, pay_id)
        self.assertEqual(payment.gateway_signature, valid_signature)

    def test_verify_payment_invalid_signature_rejected(self):
        """Verify invalid signature fails and marks payment FAILED."""
        order_res = self.client.post('/api/payments/create_order/', {
            'invoice_id': str(self.invoice.id),
        }, format='json')
        order_id = order_res.data['gateway_order_id']

        verify_payload = {
            'invoice_id': str(self.invoice.id),
            'razorpay_order_id': order_id,
            'razorpay_payment_id': 'pay_mock_invalid',
            'razorpay_signature': 'invalid_forged_signature_hex_123456',
        }

        res = self.client.post('/api/payments/verify/', verify_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        self.invoice.refresh_from_db()
        self.assertNotEqual(self.invoice.status, InvoiceStatus.PAID)

        payment = Payment.objects.get(gateway_order_id=order_id)
        self.assertEqual(payment.status, 'FAILED')

    def test_verify_payment_updates_active_shift_totals(self):
        """Verify captured digital payment increments active register session total_upi_sales."""
        # Open a register session
        shift = CashRegisterSession.objects.create(
            store_id=self.store,
            cashier_id=self.user,
            session_number='SHIFT-FRESH-20261017-001',
            status=RegisterSessionStatus.OPEN,
            opening_float=Decimal('1000.00'),
            expected_cash=Decimal('1000.00')
        )

        gateway = get_payment_gateway()
        order_res = self.client.post('/api/payments/create_order/', {
            'invoice_id': str(self.invoice.id),
            'method': PaymentMethod.UPI,
        }, format='json')
        order_id = order_res.data['gateway_order_id']
        pay_id = 'pay_mock_shift_test'
        signature = gateway.generate_mock_signature(order_id, pay_id)

        res = self.client.post('/api/payments/verify/', {
            'invoice_id': str(self.invoice.id),
            'razorpay_order_id': order_id,
            'razorpay_payment_id': pay_id,
            'razorpay_signature': signature,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        shift.refresh_from_db()
        self.assertEqual(shift.total_upi_sales, Decimal('590.00'))

    def test_payment_status_endpoint(self):
        """Verify polling payment status endpoint."""
        order_res = self.client.post('/api/payments/create_order/', {
            'invoice_id': str(self.invoice.id),
        }, format='json')
        payment_id = order_res.data['payment_id']

        res = self.client.get(f'/api/payments/status/?payment_id={payment_id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'PENDING')
        self.assertEqual(res.data['amount'], '590.00')

    def test_webhook_payment_captured(self):
        """Verify webhook processes payment.captured event and settles invoice."""
        gateway = get_payment_gateway()
        order_res = self.client.post('/api/payments/create_order/', {
            'invoice_id': str(self.invoice.id),
        }, format='json')
        order_id = order_res.data['gateway_order_id']

        webhook_body = json.dumps({
            'event': 'payment.captured',
            'payload': {
                'payment': {
                    'entity': {
                        'id': 'pay_webhook_999',
                        'order_id': order_id,
                        'amount': 59000,
                        'currency': 'INR',
                        'status': 'captured',
                    }
                }
            }
        }).encode('utf-8')

        secret = MockPaymentGateway.DEFAULT_SECRET.encode('utf-8')
        import hmac, hashlib
        valid_webhook_sig = hmac.new(secret, webhook_body, hashlib.sha256).hexdigest()

        res = self.client.post(
            '/api/payments/webhook/',
            data=webhook_body,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE=valid_webhook_sig
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, InvoiceStatus.PAID)

        payment = Payment.objects.get(gateway_order_id=order_id)
        self.assertEqual(payment.status, 'SUCCESS')
        self.assertEqual(payment.external_transaction_id, 'pay_webhook_999')
