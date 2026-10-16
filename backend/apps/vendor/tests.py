from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from db.models import Organization, Product, User, Vendor, VendorProduct


class VendorAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create test user
        self.user = User.objects.create_user(
            email="vendor_test@example.com",
            password="testpassword123",
            first_name="Test",
            last_name="User"
        )
        self.client.force_authenticate(user=self.user)

        # Create two test organizations for multi-tenancy verification
        self.org1 = Organization.objects.create(
            name="Org One Retail",
            subdomain="org-one",
            created_by=self.user
        )
        self.org2 = Organization.objects.create(
            name="Org Two Retail",
            subdomain="org-two",
            created_by=self.user
        )


        # Standard valid GSTIN for testing
        self.valid_gstin = "27AAPFU0939F1ZV"

    @staticmethod
    def _extract_results(response_data):
        return response_data['results'] if isinstance(response_data, dict) else response_data

    def test_create_vendor_minimal(self):

        url = reverse('vendor-list')
        payload = {
            'organization_id': str(self.org1.id),
            'name': 'Hindustan Unilever Ltd',
            'vendor_code': 'VEND-HUL-01',
            'payment_terms': 'NET_30',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Hindustan Unilever Ltd')
        self.assertEqual(response.data['vendor_code'], 'VEND-HUL-01')
        self.assertEqual(response.data['payment_terms'], 'NET_30')
        self.assertTrue(response.data['is_active'])

        # Verify DB entry
        vendor = Vendor.objects.get(id=response.data['id'])
        self.assertEqual(vendor.organization_id, self.org1)
        self.assertEqual(vendor.created_by, self.user)

    def test_create_vendor_with_gstin_auto_extracts_state_and_pan(self):
        url = reverse('vendor-list')
        payload = {
            'organization_id': str(self.org1.id),
            'name': 'Nestle India Pvt Ltd',
            'trade_name': 'Nestle',
            'vendor_code': 'VEND-NESTLE',
            'gstin': self.valid_gstin,  # 27AAPFU0939F1ZV
            'contact_person': 'Ramesh Kumar',
            'phone': '9876543210',
            'email': 'orders@nestle.example.com',
            'billing_address': 'Plot 45, MIDC Industrial Area',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'pincode': '400001',
            'payment_terms': 'NET_45',
            'credit_limit': '500000.00',
            'bank_name': 'HDFC Bank',
            'bank_account_number': '50200012345678',
            'bank_ifsc': 'HDFC0000123',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Check auto-extracted state_code and pan_number
        self.assertEqual(response.data['state_code'], '27')
        self.assertEqual(response.data['pan_number'], 'AAPFU0939F')
        self.assertEqual(response.data['gst_number'], self.valid_gstin)
        self.assertEqual(Decimal(response.data['credit_limit']), Decimal('500000.00'))

    def test_gstin_validation_rejects_invalid_format(self):
        url = reverse('vendor-list')
        payload = {
            'organization_id': str(self.org1.id),
            'name': 'Invalid GST Vendor',
            'gstin': 'INVALID_GSTIN_123',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('gstin', response.data)

    def test_pan_validation_rejects_invalid_format(self):
        url = reverse('vendor-list')
        payload = {
            'organization_id': str(self.org1.id),
            'name': 'Invalid PAN Vendor',
            'pan_number': '1234567890',  # Invalid PAN pattern
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pan_number', response.data)

    def test_vendor_code_unique_per_organization(self):
        url = reverse('vendor-list')
        payload1 = {
            'organization_id': str(self.org1.id),
            'name': 'Vendor Alpha',
            'vendor_code': 'CODE-001',
        }
        res1 = self.client.post(url, payload1, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Duplicate in same org should fail
        payload2 = {
            'organization_id': str(self.org1.id),
            'name': 'Vendor Beta',
            'vendor_code': 'CODE-001',
        }
        res2 = self.client.post(url, payload2, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('vendor_code' in res2.data or 'non_field_errors' in res2.data)

        # Same code in different org should succeed

        payload3 = {
            'organization_id': str(self.org2.id),
            'name': 'Vendor Gamma in Org2',
            'vendor_code': 'CODE-001',
        }
        res3 = self.client.post(url, payload3, format='json')
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)

    def test_organization_scoping_and_tenancy(self):
        Vendor.objects.create(
            organization_id=self.org1,
            name='Vendor Org1 A',
            vendor_code='V1-A',
            created_by=self.user
        )
        Vendor.objects.create(
            organization_id=self.org1,
            name='Vendor Org1 B',
            vendor_code='V1-B',
            created_by=self.user
        )
        Vendor.objects.create(
            organization_id=self.org2,
            name='Vendor Org2 C',
            vendor_code='V2-C',
            created_by=self.user
        )

        url = reverse('vendor-list')
        # Filter for Org 1
        res_org1 = self.client.get(url, {'organization_id': str(self.org1.id)})
        self.assertEqual(res_org1.status_code, status.HTTP_200_OK)
        # Handle paginated or non-paginated results
        results_org1 = self._extract_results(res_org1.data)
        self.assertEqual(len(results_org1), 2)
        names_org1 = [v['name'] for v in results_org1]
        self.assertIn('Vendor Org1 A', names_org1)
        self.assertIn('Vendor Org1 B', names_org1)

        # Filter for Org 2
        res_org2 = self.client.get(url, {'organization_id': str(self.org2.id)})
        results_org2 = self._extract_results(res_org2.data)
        self.assertEqual(len(results_org2), 1)
        self.assertEqual(results_org2[0]['name'], 'Vendor Org2 C')

    def test_search_and_filters(self):
        v1 = Vendor.objects.create(
            organization_id=self.org1,
            name='Parle Products Ltd',
            trade_name='Parle-G',
            vendor_code='VEND-PARLE',
            phone='9811122233',
            payment_terms='COD',
            is_active=True,
            created_by=self.user
        )
        v2 = Vendor.objects.create(
            organization_id=self.org1,
            name='Britannia Industries',
            trade_name='Britannia',
            vendor_code='VEND-BRIT',
            phone='9844455566',
            payment_terms='NET_60',
            is_active=False,
            created_by=self.user
        )

        url = reverse('vendor-list')

        # Search by trade name
        res = self.client.get(url, {'organization_id': str(self.org1.id), 'search': 'Parle-G'})
        results = self._extract_results(res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(v1.id))

        # Search by phone
        res = self.client.get(url, {'organization_id': str(self.org1.id), 'search': '9844455566'})
        results = self._extract_results(res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(v2.id))

        # Filter by payment_terms
        res = self.client.get(url, {'organization_id': str(self.org1.id), 'payment_terms': 'COD'})
        results = self._extract_results(res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(v1.id))

        # Filter by is_active=false
        res = self.client.get(url, {'organization_id': str(self.org1.id), 'is_active': 'false'})
        results = self._extract_results(res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(v2.id))

    def test_soft_delete_vendor(self):
        vendor = Vendor.objects.create(
            organization_id=self.org1,
            name='To Be Deleted Vendor',
            created_by=self.user
        )
        url = reverse('vendor-detail', args=[str(vendor.id)])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Should be soft-deleted in database
        vendor.refresh_from_db()
        self.assertTrue(vendor.is_deleted)
        self.assertIsNotNone(vendor.deleted_at)

        # Excluded from list query
        list_url = reverse('vendor-list')
        list_res = self.client.get(list_url, {'organization_id': str(self.org1.id)})
        results = self._extract_results(list_res.data)
        vendor_ids = [v['id'] for v in results]
        self.assertNotIn(str(vendor.id), vendor_ids)


class VendorProductAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="vp_test@example.com",
            password="testpassword123",
            first_name="VendorProduct",
            last_name="Tester"
        )
        self.client.force_authenticate(user=self.user)

        self.org1 = Organization.objects.create(name="Org One Retail", subdomain="org-vp-one", created_by=self.user)
        self.org2 = Organization.objects.create(name="Org Two Retail", subdomain="org-vp-two", created_by=self.user)

        self.vendor1 = Vendor.objects.create(
            organization_id=self.org1,
            name="Unilever Dist",
            vendor_code="VEND-UNI-01",
            created_by=self.user
        )
        self.vendor2 = Vendor.objects.create(
            organization_id=self.org2,
            name="Org2 Vendor",
            vendor_code="VEND-ORG2-01",
            created_by=self.user
        )

        self.product1 = Product.objects.create(
            organization_id=self.org1,
            name="Lux Rose Soap 100g",
            sku="SKU-LUX-ROSE",
            barcode="8901030000001",
            base_mrp=Decimal("45.00"),
            cost_price=Decimal("35.00"),
            created_by=self.user
        )
        self.product2 = Product.objects.create(
            organization_id=self.org1,
            name="Lifebuoy Total 100g",
            sku="SKU-LIFEBUOY-100",
            barcode="8901030000002",
            base_mrp=Decimal("35.00"),
            cost_price=Decimal("28.00"),
            created_by=self.user
        )
        self.product_org2 = Product.objects.create(
            organization_id=self.org2,
            name="Org2 Product",
            sku="SKU-ORG2-P1",
            base_mrp=Decimal("100.00"),
            cost_price=Decimal("80.00"),
            created_by=self.user
        )

    @staticmethod
    def _extract_results(response_data):
        return response_data['results'] if isinstance(response_data, dict) else response_data

    def test_create_vendor_product_mapping(self):
        url = reverse('vendor-product-list')
        payload = {
            'vendor_id': str(self.vendor1.id),
            'product_id': str(self.product1.id),
            'vendor_sku': 'HUL-LUX-100',
            'negotiated_cost_price': '32.50',
            'minimum_order_quantity': 24,
            'lead_time_days': 2,
            'is_primary_supplier': True,
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['vendor_sku'], 'HUL-LUX-100')
        self.assertEqual(Decimal(res.data['negotiated_cost_price']), Decimal('32.50'))
        self.assertEqual(res.data['minimum_order_quantity'], 24)
        self.assertTrue(res.data['is_primary_supplier'])
        self.assertIsNotNone(res.data['vendor'])
        self.assertEqual(res.data['vendor']['name'], 'Unilever Dist')
        self.assertIsNotNone(res.data['product'])
        self.assertEqual(res.data['product']['name'], 'Lux Rose Soap 100g')

    def test_duplicate_vendor_product_rejected(self):
        VendorProduct.objects.create(
            vendor_id=self.vendor1,
            product_id=self.product1,
            negotiated_cost_price=Decimal('32.50'),
            created_by=self.user
        )
        url = reverse('vendor-product-list')
        payload = {
            'vendor_id': str(self.vendor1.id),
            'product_id': str(self.product1.id),
            'negotiated_cost_price': '33.00',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cross_organization_mapping_rejected(self):
        # vendor1 is in org1, product_org2 is in org2
        url = reverse('vendor-product-list')
        payload = {
            'vendor_id': str(self.vendor1.id),
            'product_id': str(self.product_org2.id),
            'negotiated_cost_price': '50.00',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', res.data)

    def test_validation_cost_price_and_moq(self):
        url = reverse('vendor-product-list')
        # Non-positive cost price
        payload_bad_price = {
            'vendor_id': str(self.vendor1.id),
            'product_id': str(self.product1.id),
            'negotiated_cost_price': '0.00',
        }
        res = self.client.post(url, payload_bad_price, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Zero MOQ
        payload_bad_moq = {
            'vendor_id': str(self.vendor1.id),
            'product_id': str(self.product1.id),
            'negotiated_cost_price': '30.00',
            'minimum_order_quantity': 0,
        }
        res = self.client.post(url, payload_bad_moq, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filter_and_search_vendor_products(self):
        vp1 = VendorProduct.objects.create(
            vendor_id=self.vendor1,
            product_id=self.product1,
            vendor_sku='V-LUX-01',
            negotiated_cost_price=Decimal('32.00'),
            is_primary_supplier=True,
            created_by=self.user
        )
        vp2 = VendorProduct.objects.create(
            vendor_id=self.vendor1,
            product_id=self.product2,
            vendor_sku='V-LIFE-02',
            negotiated_cost_price=Decimal('26.00'),
            is_primary_supplier=False,
            created_by=self.user
        )

        url = reverse('vendor-product-list')

        # Filter by product_id
        res = self.client.get(url, {'product_id': str(self.product1.id)})
        results = self._extract_results(res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(vp1.id))

        # Filter by is_primary_supplier=true
        res = self.client.get(url, {'vendor_id': str(self.vendor1.id), 'is_primary_supplier': 'true'})
        results = self._extract_results(res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(vp1.id))

        # Search by product name
        res = self.client.get(url, {'vendor_id': str(self.vendor1.id), 'search': 'Lifebuoy'})
        results = self._extract_results(res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(vp2.id))

    def test_soft_delete_vendor_product(self):
        vp = VendorProduct.objects.create(
            vendor_id=self.vendor1,
            product_id=self.product1,
            negotiated_cost_price=Decimal('32.00'),
            created_by=self.user
        )
        url = reverse('vendor-product-detail', args=[str(vp.id)])
        res = self.client.delete(url)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        vp.refresh_from_db()
        self.assertTrue(vp.is_deleted)
        self.assertIsNotNone(vp.deleted_at)



