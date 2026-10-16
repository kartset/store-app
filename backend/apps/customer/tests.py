from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Customer,
    CustomerType,
    Invoice,
    Organization,
    Store,
    StoreCustomer,
    User,
)


class CustomerModelTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Acme Retail Org', subdomain='acmeretail')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Acme Downtown',
            is_active=True
        )

    def test_customer_creation_and_defaults(self):
        """Test default values and representation of Customer model."""
        customer = Customer.objects.create(
            mobile_number='9876543210',
            name='Rajesh Kumar',
            email='rajesh@example.com'
        )
        self.assertEqual(customer.customer_type, CustomerType.RETAIL)
        self.assertTrue(customer.is_active)
        self.assertEqual(str(customer), 'Rajesh Kumar (9876543210)')

    def test_customer_unique_mobile_constraint(self):
        """Test duplicate mobile numbers are rejected at the DB level."""
        Customer.objects.create(mobile_number='9876543210', name='User A')
        with self.assertRaises(IntegrityError), transaction.atomic():
            Customer.objects.create(mobile_number='9876543210', name='User B')

    def test_store_customer_unique_constraint(self):
        """Test unique_together constraint on (store_id, customer_id)."""
        customer = Customer.objects.create(mobile_number='9876543210', name='User A')
        StoreCustomer.objects.create(store_id=self.store, customer_id=customer, loyalty_points=100)

        with self.assertRaises(IntegrityError), transaction.atomic():
            StoreCustomer.objects.create(store_id=self.store, customer_id=customer, loyalty_points=50)


class CustomerAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='Prime Hypermarket', subdomain='prime')
        self.store_1 = Store.objects.create(
            organization_id=self.org,
            name='Prime Flagship Store',
            is_active=True
        )
        self.store_2 = Store.objects.create(
            organization_id=self.org,
            name='Prime Express Indiranagar',
            is_active=True
        )
        self.user = User.objects.create_user(
            email='pos_cashier@prime.com',
            password='TestPassword123!',
            first_name='Cashier',
            last_name='One'
        )
        self.client.force_authenticate(user=self.user)

        self.customer_retail = Customer.objects.create(
            mobile_number='9876543210',
            name='Ananya Sharma',
            email='ananya@gmail.com',
            customer_type=CustomerType.RETAIL,
            city='Bangalore',
            state='Karnataka',
            pincode='560001',
            is_active=True,
        )
        self.customer_b2b = Customer.objects.create(
            mobile_number='9123456789',
            name='Apex Global Enterprises',
            email='billing@apex.in',
            customer_type=CustomerType.B2B,
            gstin='29ABCDE1234F1Z5',
            pan_number='ABCDE1234F',
            city='Bangalore',
            state='Karnataka',
            pincode='560038',
            is_active=True,
        )

        # StoreCustomer relation with loyalty points
        self.sc_1 = StoreCustomer.objects.create(
            store_id=self.store_1,
            customer_id=self.customer_retail,
            loyalty_points=350,
            credit_limit=Decimal('5000.00'),
            total_visits=4,
        )

    def test_list_customers(self):
        """Test GET /api/customers/ returns all active customers."""
        response = self.client.get('/api/customers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 2)

    def test_search_customers(self):
        """Test searching by phone, name, email, GSTIN, or city."""
        # Search by phone digits
        res1 = self.client.get('/api/customers/?search=9876543210')
        data1 = res1.data['results'] if isinstance(res1.data, dict) else res1.data
        self.assertEqual(len(data1), 1)
        self.assertEqual(data1[0]['name'], 'Ananya Sharma')

        # Search by name
        res2 = self.client.get('/api/customers/?search=Apex')
        data2 = res2.data['results'] if isinstance(res2.data, dict) else res2.data
        self.assertEqual(len(data2), 1)
        self.assertEqual(data2[0]['gstin'], '29ABCDE1234F1Z5')

        # Search by GSTIN
        res3 = self.client.get('/api/customers/?search=29ABCDE1234F1Z5')
        data3 = res3.data['results'] if isinstance(res3.data, dict) else res3.data
        self.assertEqual(len(data3), 1)

    def test_filter_customers_by_type_and_active(self):
        """Test filtering by customer_type and is_active."""
        res_b2b = self.client.get('/api/customers/?customer_type=B2B')
        data_b2b = res_b2b.data['results'] if isinstance(res_b2b.data, dict) else res_b2b.data
        self.assertEqual(len(data_b2b), 1)
        self.assertEqual(data_b2b[0]['customer_type'], CustomerType.B2B)

        res_retail = self.client.get('/api/customers/?customer_type=RETAIL')
        data_retail = res_retail.data['results'] if isinstance(res_retail.data, dict) else res_retail.data
        self.assertEqual(len(data_retail), 1)

    def test_create_customer_success(self):
        """Test creating a new customer with valid data."""
        payload = {
            'mobile_number': '9988776655',
            'name': 'Vikram Mehta',
            'email': 'vikram@mehta.com',
            'customer_type': 'RETAIL',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'pincode': '400001',
        }
        response = self.client.post('/api/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['mobile_number'], '9988776655')
        self.assertEqual(response.data['name'], 'Vikram Mehta')
        self.assertEqual(response.data['total_loyalty_points'], 0)

    def test_create_customer_phone_normalization(self):
        """Test creating a customer with formatted phone (+91 97711-22334) normalizes to 10 digits."""
        payload = {
            'mobile_number': '+91 97711-22334',
            'name': 'Pooja Hegde',
        }
        response = self.client.post('/api/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['mobile_number'], '9771122334')

    def test_create_customer_invalid_phone(self):
        """Test creating a customer with invalid phone number fails."""
        payload = {
            'mobile_number': '12345',  # Too short
            'name': 'Invalid User',
        }
        response = self.client.post('/api/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile_number', response.data)

    def test_create_customer_duplicate_phone_rejected(self):
        """Test creating a customer with already existing phone number fails."""
        payload = {
            'mobile_number': '9876543210',  # Already exists for Ananya Sharma
            'name': 'Imposter User',
        }
        response = self.client.post('/api/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(response.data['mobile_number']))

    def test_create_b2b_customer_with_gstin_auto_pan(self):
        """Test B2B customer creation auto-extracts PAN from GSTIN."""
        payload = {
            'mobile_number': '9555666777',
            'name': 'Zenith Traders Pvt Ltd',
            'gstin': '07AABCB1234C1Z6',
        }
        response = self.client.post('/api/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['pan_number'], 'AABCB1234C')
        self.assertEqual(response.data['customer_type'], CustomerType.B2B)

    def test_create_customer_invalid_gstin_rejected(self):
        """Test invalid GSTIN format is rejected."""
        payload = {
            'mobile_number': '9444333222',
            'name': 'Faulty GSTIN Enterprise',
            'gstin': 'INVALID-GSTIN-123',
        }
        response = self.client.post('/api/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('gstin', response.data)

    def test_customer_fast_lookup_found(self):
        """Test GET /api/customers/lookup/?mobile=...&store_id=... returns customer and store loyalty info."""
        response = self.client.get(
            f'/api/customers/lookup/?mobile=9876543210&store_id={self.store_1.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['found'])
        self.assertEqual(response.data['customer']['name'], 'Ananya Sharma')
        self.assertEqual(response.data['store_loyalty_points'], 350)
        self.assertEqual(response.data['store_visits'], 4)
        self.assertEqual(Decimal(str(response.data['store_credit_limit'])), Decimal('5000.00'))

    def test_customer_fast_lookup_not_found(self):
        """Test GET /api/customers/lookup/ for unregistered phone returns found: False without error."""
        response = self.client.get('/api/customers/lookup/?mobile=9000000000')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['found'])
        self.assertEqual(response.data['mobile_number'], '9000000000')
        self.assertIsNone(response.data['customer'])

    def test_customer_lookup_missing_mobile_param(self):
        """Test GET /api/customers/lookup/ without mobile parameter returns 400."""
        response = self.client.get('/api/customers/lookup/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_invoices_action(self):
        """Test GET /api/customers/{id}/invoices/ returns past billing history."""
        # Create invoices for customer
        Invoice.objects.create(
            store_id=self.store_1,
            customer_id=self.customer_retail,
            type='POS',
            status='PAID',
            subtotal=Decimal('1500.00'),
            grand_total=Decimal('1500.00'),
        )
        Invoice.objects.create(
            store_id=self.store_2,
            customer_id=self.customer_retail,
            type='POS',
            status='PAID',
            subtotal=Decimal('620.00'),
            grand_total=Decimal('620.00'),
        )

        # Get all invoices
        response = self.client.get(f'/api/customers/{self.customer_retail.id}/invoices/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        # Filter by store_1
        res_store1 = self.client.get(
            f'/api/customers/{self.customer_retail.id}/invoices/?store_id={self.store_1.id}'
        )
        self.assertEqual(res_store1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_store1.data), 1)
        self.assertEqual(Decimal(str(res_store1.data[0]['grand_total'])), Decimal('1500.00'))

    def test_customer_soft_delete(self):
        """Test DELETE /api/customers/{id}/ marks customer as soft-deleted."""
        response = self.client.delete(f'/api/customers/{self.customer_retail.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Check soft-deleted
        self.customer_retail.refresh_from_db()
        self.assertTrue(self.customer_retail.is_deleted)

        # Active queries exclude it
        list_res = self.client.get('/api/customers/')
        data = list_res.data['results'] if isinstance(list_res.data, dict) else list_res.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], str(self.customer_b2b.id))
