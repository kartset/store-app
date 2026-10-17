from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Category,
    CreditNote,
    CreditNoteStatus,
    Customer,
    CustomerType,
    Inventory,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InvoiceType,
    Order,
    OrderStatus,
    Organization,
    Payment,
    PaymentMethod,
    Product,
    Store,
)


class AnalyticsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='Analytics Retail Corp', subdomain='analytics')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Indiranagar Megastore',
            gst_number='29AAAAA1111A1Z5',
            is_active=True
        )
        self.store2 = Store.objects.create(
            organization_id=self.org,
            name='Koramangala Branch',
            gst_number='29BBBBB2222B1Z5',
            is_active=True
        )

        self.category_beverages = Category.objects.create(name='Beverages', slug='beverages')
        self.category_electronics = Category.objects.create(name='Electronics', slug='electronics')

        self.customer = Customer.objects.create(
            name='Siddharth Roy',
            mobile_number='9876500001',
            email='siddharth@example.com',
            customer_type=CustomerType.RETAIL
        )

        # Products
        self.product1 = Product.objects.create(
            organization_id=self.org,
            category_id=self.category_beverages,
            name='Artisan Coffee Beans 500g',
            sku='ACB-500',
            barcode='890111100001',
            base_mrp=Decimal('600.00'),
            tax_slab=Decimal('5.00')
        )
        self.product2 = Product.objects.create(
            organization_id=self.org,
            category_id=self.category_electronics,
            name='Wireless Headset Pro',
            sku='WHP-100',
            barcode='890111100002',
            base_mrp=Decimal('2000.00'),
            tax_slab=Decimal('18.00')
        )

        # Inventories
        self.inv1 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product1,
            stock_quantity=5,  # Low stock (threshold default is 10)
            low_stock_threshold=10,
            reorder_quantity=50,
            store_price=Decimal('600.00')
        )
        self.inv2 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product2,
            stock_quantity=0,  # Out of stock
            low_stock_threshold=5,
            reorder_quantity=20,
            store_price=Decimal('2000.00')
        )

        # Invoices
        self.invoice1 = Invoice.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            type=InvoiceType.POS,
            status=InvoiceStatus.PAID,
            subtotal=Decimal('1200.00'),
            total_discount=Decimal('100.00'),
            total_gst=Decimal('55.00'),
            grand_total=Decimal('1100.00'),
            customer_name_snapshot='Siddharth Roy',
            customer_phone_snapshot='9876500001'
        )
        self.inv_item1 = InvoiceItem.objects.create(
            invoice_id=self.invoice1,
            product_id=self.product1,
            product_name_snapshot='Artisan Coffee Beans 500g',
            sku_snapshot='ACB-500',
            quantity=2,
            unit_price=Decimal('600.00'),
            discount=Decimal('100.00'),
            line_total=Decimal('1100.00')
        )
        Payment.objects.create(
            invoice_id=self.invoice1,
            method=PaymentMethod.UPI,
            amount=Decimal('1100.00'),
            status='SUCCESS'
        )

        self.invoice2 = Invoice.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            type=InvoiceType.POS,
            status=InvoiceStatus.PAID,
            subtotal=Decimal('2000.00'),
            total_discount=Decimal('0.00'),
            total_gst=Decimal('360.00'),
            grand_total=Decimal('2000.00'),
            customer_name_snapshot='Siddharth Roy',
            customer_phone_snapshot='9876500001'
        )
        self.inv_item2 = InvoiceItem.objects.create(
            invoice_id=self.invoice2,
            product_id=self.product2,
            product_name_snapshot='Wireless Headset Pro',
            sku_snapshot='WHP-100',
            quantity=1,
            unit_price=Decimal('2000.00'),
            discount=Decimal('0.00'),
            line_total=Decimal('2000.00')
        )
        Payment.objects.create(
            invoice_id=self.invoice2,
            method=PaymentMethod.CASH,
            amount=Decimal('2000.00'),
            status='SUCCESS'
        )

        # Credit Note (Refund) on Invoice 1
        self.credit_note = CreditNote.objects.create(
            store_id=self.store,
            invoice_id=self.invoice1,
            customer_id=self.customer,
            status=CreditNoteStatus.COMPLETED,
            subtotal=Decimal('500.00'),
            total_gst=Decimal('50.00'),
            total_refund_amount=Decimal('550.00'),
        )

        # Order
        self.order = Order.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            status=OrderStatus.PENDING,
            grand_total=Decimal('800.00')
        )

    def test_analytics_overview(self):
        """Verifies executive overview totals, deductions, AOV, and growth metrics."""
        res = self.client.get(f'/api/analytics/overview/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        # Gross sales: 1100 + 2000 = 3100.00
        self.assertEqual(Decimal(data['gross_sales']), Decimal('3100.00'))
        # Returns: 550.00
        self.assertEqual(Decimal(data['returns_total']), Decimal('550.00'))
        # Net sales: 3100 - 550 = 2550.00
        self.assertEqual(Decimal(data['net_sales']), Decimal('2550.00'))
        self.assertEqual(data['total_invoices'], 2)
        self.assertEqual(data['total_orders'], 1)
        # AOV: 2550 / 2 = 1275.00
        self.assertEqual(Decimal(data['average_order_value']), Decimal('1275.00'))
        self.assertEqual(Decimal(data['total_discount']), Decimal('100.00'))

    def test_sales_trend(self):
        """Verifies sales trend time series bucketed by day."""
        res = self.client.get(f'/api/analytics/sales-trend/?store_id={self.store.id}&interval=day')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(data['interval'], 'day')
        self.assertTrue(len(data['data']) >= 1)
        point = data['data'][0]
        self.assertIn('gross_sales', point)
        self.assertIn('net_sales', point)
        self.assertIn('invoices', point)

    def test_top_products(self):
        """Verifies top products leaderboard sorted by revenue."""
        res = self.client.get(f'/api/analytics/top-products/?store_id={self.store.id}&limit=5')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        products = data['products']
        self.assertEqual(len(products), 2)
        # Wireless Headset Pro (2000) should be rank 1
        self.assertEqual(products[0]['rank'], 1)
        self.assertEqual(products[0]['name'], 'Wireless Headset Pro')
        self.assertEqual(Decimal(products[0]['revenue']), Decimal('2000.00'))

        # Coffee Beans (1100) should be rank 2
        self.assertEqual(products[1]['rank'], 2)
        self.assertEqual(products[1]['name'], 'Artisan Coffee Beans 500g')
        self.assertEqual(Decimal(products[1]['revenue']), Decimal('1100.00'))

    def test_category_breakdown(self):
        """Verifies revenue share by category."""
        res = self.client.get(f'/api/analytics/category-breakdown/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        categories = data['categories']
        self.assertEqual(len(categories), 2)
        cat_names = [c['category_name'] for c in categories]
        self.assertIn('Electronics', cat_names)
        self.assertIn('Beverages', cat_names)

    def test_hourly_footfall(self):
        """Verifies 24-hour footfall distribution and peak hour detection."""
        res = self.client.get(f'/api/analytics/hourly-footfall/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(len(data['hourly_distribution']), 24)
        self.assertIsNotNone(data['peak_hour'])
        self.assertTrue(data['max_transactions'] >= 1)

    def test_payment_methods_breakdown(self):
        """Verifies payment tender counts and amounts."""
        res = self.client.get(f'/api/analytics/payment-methods/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        methods = data['methods']
        self.assertEqual(len(methods), 2)
        method_types = [m['method'] for m in methods]
        self.assertIn(PaymentMethod.CASH, method_types)
        self.assertIn(PaymentMethod.UPI, method_types)

    def test_inventory_health(self):
        """Verifies stock health counts, valuation, and low stock warnings."""
        res = self.client.get(f'/api/analytics/inventory-health/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(data['total_skus'], 2)
        self.assertEqual(data['total_units'], 5)  # 5 + 0
        self.assertEqual(data['low_stock_count'], 1)  # Coffee beans (5 <= 10)
        self.assertEqual(data['out_of_stock_count'], 1)  # Headset (0)
        self.assertEqual(data['healthy_stock_count'], 0)
        # Valuation: 5 * 600 = 3000.00
        self.assertEqual(Decimal(data['valuation_retail']), Decimal('3000.00'))
        self.assertEqual(len(data['critical_items']), 1)
