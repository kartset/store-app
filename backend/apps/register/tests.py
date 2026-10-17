from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    CashRegisterSession,
    CashTransaction,
    CashTransactionType,
    Category,
    Customer,
    Inventory,
    Invoice,
    Organization,
    PaymentMethod,
    Product,
    RegisterSessionStatus,
    Store,
    User,
)


class CashRegisterSessionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='cashier@storecraft.com',
            password='testpassword123',
            first_name='Rohan',
            last_name='Sharma'
        )
        self.client.force_authenticate(user=self.user)

        self.org = Organization.objects.create(name='Acme Retail Corp')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Acme Connaught Place',
            gst_number='07AAAAA0000A1Z5'
        )
        self.category = Category.objects.create(
            name='Groceries',
            slug='groceries',
            default_tax_slab=Decimal('5.00')
        )
        self.product = Product.objects.create(
            organization_id=self.org,
            category_id=self.category,
            name='Basmati Rice 5kg',
            sku='RICE-BAS-5KG',
            barcode='8901234567890',
            tax_slab=Decimal('5.00'),
            cost_price=Decimal('400.00'),
            base_mrp=Decimal('550.00'),
            uom='PACKET'
        )
        self.inventory = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product,
            stock_quantity=50,
            store_price=Decimal('500.00')
        )
        self.customer = Customer.objects.create(
            name='Amit Verma',
            mobile_number='9876543210'
        )

    def test_open_register_session(self):
        """Verify opening a register session with an initial float."""
        url = '/api/registers/open/'
        payload = {
            'store_id': str(self.store.id),
            'opening_float': '2000.00',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'OPEN')
        self.assertEqual(Decimal(str(response.data['opening_float'])), Decimal('2000.00'))
        self.assertEqual(Decimal(str(response.data['expected_cash'])), Decimal('2000.00'))
        self.assertTrue(response.data['session_number'].startswith('SHIFT-'))

        # Verify opening transaction was logged
        session_id = response.data['id']
        tx = CashTransaction.objects.filter(session_id_id=session_id).first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.type, CashTransactionType.OPENING_FLOAT)
        self.assertEqual(tx.amount, Decimal('2000.00'))

    def test_prevent_duplicate_open_session(self):
        """Verify error is returned if opening a register when one is already OPEN."""
        CashRegisterSession.objects.create(
            store_id=self.store,
            cashier_id=self.user,
            opening_float=Decimal('1000.00'),
            expected_cash=Decimal('1000.00'),
            status=RegisterSessionStatus.OPEN
        )

        url = '/api/registers/open/'
        payload = {
            'store_id': str(self.store.id),
            'opening_float': '500.00',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already OPEN', response.data['error'])

    def test_get_current_active_session(self):
        """Verify current active shift endpoint returns open session details."""
        # When no session is open
        res = self.client.get(f'/api/registers/current/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['is_open'])
        self.assertIsNone(res.data['session'])

        # Create open session
        session = CashRegisterSession.objects.create(
            store_id=self.store,
            cashier_id=self.user,
            opening_float=Decimal('1500.00'),
            expected_cash=Decimal('1500.00'),
            status=RegisterSessionStatus.OPEN
        )

        res = self.client.get(f'/api/registers/current/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['is_open'])
        self.assertEqual(res.data['session']['id'], str(session.id))
        self.assertEqual(Decimal(str(res.data['session']['opening_float'])), Decimal('1500.00'))

    def test_cash_drop_to_safe(self):
        """Verify recording cash drops decrements expected drawer cash."""
        session = CashRegisterSession.objects.create(
            store_id=self.store,
            cashier_id=self.user,
            opening_float=Decimal('5000.00'),
            expected_cash=Decimal('5000.00'),
            status=RegisterSessionStatus.OPEN
        )

        url = f'/api/registers/{session.id}/drop/'
        payload = {
            'amount': '3000.00',
            'type': 'CASH_DROP',
            'reason': 'Excess cash transferred to store safe',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        session.refresh_from_db()
        self.assertEqual(session.expected_cash, Decimal('2000.00'))

        tx = CashTransaction.objects.filter(session_id=session, type='CASH_DROP').first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, Decimal('3000.00'))

    def test_cash_drop_exceeding_drawer_rejected(self):
        """Verify cashier cannot drop more cash than what is expected in the drawer."""
        session = CashRegisterSession.objects.create(
            store_id=self.store,
            cashier_id=self.user,
            opening_float=Decimal('1000.00'),
            expected_cash=Decimal('1000.00'),
            status=RegisterSessionStatus.OPEN
        )

        url = f'/api/registers/{session.id}/drop/'
        payload = {
            'amount': '1500.00',
            'type': 'CASH_DROP',
            'reason': 'Excess drop',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('exceeds current expected cash', res.data['error'])

    def test_invoice_checkout_auto_links_and_updates_register(self):
        """Verify paying an invoice in cash auto-updates register expected cash and logs transaction."""
        session = CashRegisterSession.objects.create(
            store_id=self.store,
            cashier_id=self.user,
            opening_float=Decimal('1000.00'),
            expected_cash=Decimal('1000.00'),
            status=RegisterSessionStatus.OPEN
        )

        checkout_payload = {
            'store_id': str(self.store.id),
            'customer_id': str(self.customer.id),
            'type': 'POS',
            'is_tax_inclusive': True,
            'items': [
                {
                    'product_id': str(self.product.id),
                    'quantity': 2,
                    'unit_price': '500.00',
                    'discount': '0.00',
                }
            ],
            'payments': [
                {
                    'method': 'CASH',
                    'amount': '1000.00',
                    'amount_tendered': '1000.00',
                    'change_returned': '0.00',
                }
            ],
        }

        res = self.client.post('/api/invoices/', checkout_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        invoice_id = res.data['id']

        inv = Invoice.objects.get(id=invoice_id)
        self.assertEqual(inv.register_session_id, session)

        session.refresh_from_db()
        self.assertEqual(session.invoices_count, 1)
        self.assertEqual(session.total_cash_sales, Decimal('1000.00'))
        self.assertEqual(session.expected_cash, Decimal('2000.00'))  # 1000 float + 1000 cash sale

        # Verify CashTransaction entry
        sale_tx = CashTransaction.objects.filter(
            session_id=session,
            type=CashTransactionType.CASH_SALE
        ).first()
        self.assertIsNotNone(sale_tx)
        self.assertEqual(sale_tx.amount, Decimal('1000.00'))
        self.assertEqual(sale_tx.invoice_id, inv)

    def test_close_register_with_exact_and_variance_count(self):
        """Verify closing register computes exact cash variance and generates Z-Report."""
        session = CashRegisterSession.objects.create(
            store_id=self.store,
            cashier_id=self.user,
            opening_float=Decimal('1000.00'),
            expected_cash=Decimal('2500.00'),
            total_cash_sales=Decimal('1500.00'),
            total_sales=Decimal('1500.00'),
            invoices_count=3,
            status=RegisterSessionStatus.OPEN
        )

        close_url = f'/api/registers/{session.id}/close/'
        close_payload = {
            'closing_cash_counted': '2480.00',  # ₹20 shortage
            'denomination_breakdown': {
                '500': 4,
                '200': 2,
                '50': 1,
                '10': 3,
            },
            'closing_notes': '₹20 coin shortage at end of shift',
        }
        res = self.client.post(close_url, close_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'CLOSED')
        self.assertEqual(Decimal(str(res.data['closing_cash_counted'])), Decimal('2480.00'))
        self.assertEqual(Decimal(str(res.data['cash_variance'])), Decimal('-20.00'))
        self.assertIsNotNone(res.data['closed_at'])

        session.refresh_from_db()
        self.assertEqual(session.status, RegisterSessionStatus.CLOSED)
        self.assertEqual(session.cash_variance, Decimal('-20.00'))
        self.assertEqual(session.closed_by, self.user)
