from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Customer,
    CustomerType,
    Inventory,
    Invoice,
    InvoiceStatus,
    Organization,
    Product,
    StockMovement,
    StockMovementType,
    Store,
    StoreCustomer,
    generate_invoice_number,
)


class InvoiceModelTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='SuperStore Retail', subdomain='superstore')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Connaught Place Flagship',
            gst_number='07AAAAA0000A1Z5',
            is_active=True
        )

    def test_invoice_number_generation(self):
        """Verifies invoice numbers generate cleanly with store code and sequence."""
        inv_no_1 = generate_invoice_number(self.store)
        today_str = timezone.now().date().strftime("%Y%m%d")
        self.assertTrue(inv_no_1.startswith(f"INV-CONN-{today_str}-"))
        self.assertTrue(inv_no_1.endswith("0001"))

        # Create an invoice using this number
        Invoice.objects.create(
            store_id=self.store,
            invoice_number=inv_no_1,
            grand_total=Decimal('100.00')
        )

        # Second invoice should increment
        inv_no_2 = generate_invoice_number(self.store)
        self.assertTrue(inv_no_2.endswith("0002"))

    def test_invoice_auto_assigns_number_on_save(self):
        """Verifies invoice assigns sequential number automatically on save if omitted."""
        inv = Invoice.objects.create(
            store_id=self.store,
            grand_total=Decimal('250.00')
        )
        self.assertIsNotNone(inv.invoice_number)
        self.assertTrue(inv.invoice_number.startswith("INV-CONN-"))


class InvoiceAPICheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='MegaMart Corp', subdomain='megamart')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Indiranagar Branch',
            gst_number='29ABCDE1234F1Z5',  # Karnataka (State code 29)
            is_active=True
        )

        # Products
        self.product_a = Product.objects.create(
            organization_id=self.org,
            name='Aashirvaad Shudh Chakki Atta 5kg',
            sku='ATTA-005',
            barcode='8901030000001',
            base_mrp=Decimal('260.00'),
            tax_slab=Decimal('5.00'),
            hsn_code='11010000'
        )
        self.product_b = Product.objects.create(
            organization_id=self.org,
            name='Tata Salt 1kg',
            sku='SALT-001',
            barcode='8901030000002',
            base_mrp=Decimal('28.00'),
            tax_slab=Decimal('0.00'),
            hsn_code='25010000'
        )

        # Inventories
        self.inv_a = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product_a,
            stock_quantity=50,
            store_price=Decimal('250.00')
        )
        self.inv_b = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product_b,
            stock_quantity=100,
            store_price=Decimal('28.00')
        )

        # Customer in same state (Intra-state)
        self.customer = Customer.objects.create(
            mobile_number='9876543210',
            name='Ramesh Gupta',
            gstin='29XYZAB5678C1Z2',  # Karnataka (29)
            customer_type=CustomerType.RETAIL
        )
        self.store_customer = StoreCustomer.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            loyalty_points=120
        )

    def test_atomic_checkout_success(self):
        """Verifies full checkout creates invoice, deducts stock, records payments and stock movements."""
        payload = {
            "store_id": str(self.store.id),
            "customer_id": str(self.customer.id),
            "customer_name": "Ramesh Gupta",
            "customer_phone": "9876543210",
            "type": "POS",
            "is_tax_inclusive": True,
            "items": [
                {
                    "product_id": str(self.product_a.id),
                    "quantity": 2,
                    "unit_price": "250.00",
                    "discount": "20.00"
                },
                {
                    "product_id": str(self.product_b.id),
                    "quantity": 3,
                    "unit_price": "28.00",
                    "discount": "0.00"
                }
            ],
            "payments": [
                {
                    "method": "CASH",
                    "amount": "564.00",
                    "amount_tendered": "600.00",
                    "change_returned": "36.00"
                }
            ],
            "notes": "Counter sale"
        }

        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.data

        # Verify Invoice status and totals
        # Product A: 2 * 250 - 20 = 480. Product B: 3 * 28 = 84. Total = 564
        self.assertEqual(res_data['status'], InvoiceStatus.PAID)
        self.assertEqual(Decimal(str(res_data['grand_total'])), Decimal('564.00'))
        self.assertEqual(len(res_data['items']), 2)
        self.assertEqual(len(res_data['payments']), 1)

        # Verify stock was deducted in Inventory
        self.inv_a.refresh_from_db()
        self.inv_b.refresh_from_db()
        self.assertEqual(self.inv_a.stock_quantity, 48)  # 50 - 2
        self.assertEqual(self.inv_b.stock_quantity, 97)  # 100 - 3

        # Verify StockMovement records created with POS_SALE
        movements = StockMovement.objects.filter(reference_id=res_data['invoice_number'])
        self.assertEqual(movements.count(), 2)
        for m in movements:
            self.assertEqual(m.movement_type, StockMovementType.POS_SALE)

        # Verify loyalty points earned (₹564 // 100 = 5 points)
        self.store_customer.refresh_from_db()
        self.assertEqual(self.store_customer.loyalty_points, 125)  # 120 + 5

    def test_checkout_insufficient_stock_fails_atomically(self):
        """Verifies insufficient stock rejects checkout without partial deductions."""
        payload = {
            "store_id": str(self.store.id),
            "items": [
                {
                    "product_id": str(self.product_a.id),
                    "quantity": 55,  # Exceeds available stock (50)
                    "unit_price": "250.00"
                }
            ]
        }

        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient stock", str(response.data))

        # Stock remains untouched
        self.inv_a.refresh_from_db()
        self.assertEqual(self.inv_a.stock_quantity, 50)
        self.assertEqual(Invoice.objects.count(), 0)

    def test_checkout_intra_state_gst_split(self):
        """Verifies intra-state sale splits GST equally into CGST and SGST."""
        payload = {
            "store_id": str(self.store.id),
            "customer_id": str(self.customer.id),  # Both store and customer in State 29
            "is_tax_inclusive": False,
            "items": [
                {
                    "product_id": str(self.product_a.id),  # 5% GST
                    "quantity": 1,
                    "unit_price": "100.00"
                }
            ]
        }

        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.data

        # 5% of 100 = 5.00 GST (2.50 CGST + 2.50 SGST, 0.00 IGST)
        self.assertEqual(Decimal(str(res_data['total_gst'])), Decimal('5.00'))
        self.assertEqual(Decimal(str(res_data['cgst_amount'])), Decimal('2.50'))
        self.assertEqual(Decimal(str(res_data['sgst_amount'])), Decimal('2.50'))
        self.assertEqual(Decimal(str(res_data['igst_amount'])), Decimal('0.00'))

    def test_checkout_inter_state_gst(self):
        """Verifies inter-state sale routes all GST to IGST."""
        # Customer in Maharashtra (State 27) vs Store in Karnataka (State 29)
        interstate_customer = Customer.objects.create(
            mobile_number='9123456789',
            name='Mumbai Traders',
            gstin='27ABCDE9999Z1Z8',
            customer_type=CustomerType.B2B
        )

        payload = {
            "store_id": str(self.store.id),
            "customer_id": str(interstate_customer.id),
            "is_tax_inclusive": False,
            "items": [
                {
                    "product_id": str(self.product_a.id),
                    "quantity": 2,
                    "unit_price": "100.00"
                }
            ]
        }

        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.data

        # 5% of 200 = 10.00 IGST, 0 CGST, 0 SGST
        self.assertEqual(Decimal(str(res_data['total_gst'])), Decimal('10.00'))
        self.assertEqual(Decimal(str(res_data['cgst_amount'])), Decimal('0.00'))
        self.assertEqual(Decimal(str(res_data['sgst_amount'])), Decimal('0.00'))
        self.assertEqual(Decimal(str(res_data['igst_amount'])), Decimal('10.00'))

    def test_checkout_with_loyalty_redemption(self):
        """Verifies customer loyalty points redemption subtracts discount and reduces point balance."""
        payload = {
            "store_id": str(self.store.id),
            "customer_id": str(self.customer.id),
            "items": [
                {
                    "product_id": str(self.product_a.id),
                    "quantity": 1,
                    "unit_price": "250.00"
                }
            ],
            "loyalty_points_to_redeem": 50,  # ₹50 discount
            "payments": [
                {
                    "method": "UPI",
                    "amount": "200.00"  # 250 - 50 = 200
                }
            ]
        }

        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.data

        self.assertEqual(Decimal(str(res_data['loyalty_discount_amount'])), Decimal('50.00'))
        self.assertEqual(Decimal(str(res_data['grand_total'])), Decimal('200.00'))
        self.assertEqual(res_data['status'], InvoiceStatus.PAID)

        # Points were 120 - 50 redeemed + 2 earned (200 // 100) = 72
        self.store_customer.refresh_from_db()
        self.assertEqual(self.store_customer.loyalty_points, 72)

    def test_invoice_cancellation_restores_stock_and_reverts_loyalty(self):
        """Verifies cancelling an invoice re-inwards inventory and reverts loyalty adjustments."""
        # 1. Create paid invoice
        payload = {
            "store_id": str(self.store.id),
            "customer_id": str(self.customer.id),
            "items": [
                {
                    "product_id": str(self.product_a.id),
                    "quantity": 4,
                    "unit_price": "250.00"
                }
            ],
            "loyalty_points_to_redeem": 20,
            "payments": [
                {"method": "CARD", "amount": "980.00"}
            ]
        }
        res = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        inv_id = res.data['id']

        # Stock should be 46
        self.inv_a.refresh_from_db()
        self.assertEqual(self.inv_a.stock_quantity, 46)

        # 2. Cancel invoice
        cancel_res = self.client.post(f'/api/invoices/{inv_id}/cancel/')
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_res.data['status'], InvoiceStatus.CANCELLED)

        # Stock should be restored back to 50
        self.inv_a.refresh_from_db()
        self.assertEqual(self.inv_a.stock_quantity, 50)

        # Verify restock movement logged
        restock_movement = StockMovement.objects.filter(
            reference_id=res.data['invoice_number'],
            movement_type=StockMovementType.RETURN_RESTOCK
        ).first()
        self.assertIsNotNone(restock_movement)
        self.assertEqual(restock_movement.quantity_delta, 4)

    def test_daily_summary_endpoint(self):
        """Verifies the /api/invoices/summary/ endpoint aggregates sales and tender metrics."""
        # Create an invoice
        self.client.post('/api/invoices/', {
            "store_id": str(self.store.id),
            "items": [{"product_id": str(self.product_a.id), "quantity": 1, "unit_price": "250.00"}],
            "payments": [{"method": "CASH", "amount": "250.00"}]
        }, format='json')

        response = self.client.get(f'/api/invoices/summary/?store_id={self.store.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_invoices'], 1)
        self.assertEqual(Decimal(str(response.data['total_sales'])), Decimal('250.00'))
        self.assertEqual(Decimal(str(response.data['tender_breakdown']['cash'])), Decimal('250.00'))

    def test_invoice_list_and_search(self):
        """Verifies listing and searching invoices by phone and invoice number."""
        res = self.client.post('/api/invoices/', {
            "store_id": str(self.store.id),
            "customer_phone": "9998887776",
            "customer_name": "Anita Verma",
            "items": [{"product_id": str(self.product_b.id), "quantity": 1, "unit_price": "28.00"}]
        }, format='json')
        inv_no = res.data['invoice_number']

        # Search by phone
        search_res = self.client.get('/api/invoices/?search=9998887776')
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        results_phone = search_res.data.get('results', search_res.data) if isinstance(search_res.data, dict) else search_res.data
        self.assertEqual(len(results_phone), 1)

        # Search by invoice number
        search_no = self.client.get(f'/api/invoices/?search={inv_no}')
        self.assertEqual(search_no.status_code, status.HTTP_200_OK)
        results_no = search_no.data.get('results', search_no.data) if isinstance(search_no.data, dict) else search_no.data
        self.assertEqual(len(results_no), 1)
