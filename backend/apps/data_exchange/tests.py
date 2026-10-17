from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Category,
    Customer,
    CustomerType,
    Inventory,
    Invoice,
    Organization,
    Product,
    StockMovement,
    StockMovementType,
    Store,
    User,
)


class DataExchangeAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Organization & User
        self.org = Organization.objects.create(name='Exchange Enterprise', subdomain='exchange')
        self.user = User.objects.create_user(
            email='admin@exchange.com',
            password='Password123!',
            first_name='Admin',
            last_name='Exchange',
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        # Store
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Central Depot',
            gst_number='29AAAAA1111A1Z5',
            is_active=True
        )

        # Categories
        self.cat_beverages = Category.objects.create(name='Beverages', slug='beverages')
        self.cat_snacks = Category.objects.create(name='Snacks', slug='snacks')

    def test_product_bulk_import_dry_run(self):
        csv_content = """name,sku,barcode,category,cost_price,base_mrp,tax_slab,initial_stock
Artisan Roast Coffee,ARC-100,89011110001,beverages,300.00,450.00,5.00,20
Spicy Potato Crisps,SPC-200,89011110002,snacks,20.00,35.00,12.00,50
"""
        response = self.client.post(
            '/api/data-exchange/products/import/?dry_run=true',
            {'csv_content': csv_content},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertTrue(data['dry_run'])
        self.assertEqual(data['valid_rows'], 2)
        self.assertEqual(data['invalid_rows'], 0)
        self.assertEqual(len(data['preview']), 2)

        # Verify nothing was committed to DB
        self.assertFalse(Product.objects.filter(sku='ARC-100').exists())
        self.assertFalse(Product.objects.filter(sku='SPC-200').exists())

    def test_product_bulk_import_commit(self):
        csv_content = """name,sku,barcode,category,cost_price,base_mrp,tax_slab,initial_stock,batch_number
Artisan Roast Coffee,ARC-100,89011110001,beverages,300.00,450.00,5.00,25,BATCH-01
"""
        response = self.client.post(
            f'/api/data-exchange/products/import/?dry_run=false&store_id={self.store.id}',
            {'csv_content': csv_content},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['imported_count'], 1)
        self.assertEqual(response.data['inwarded_inventory_count'], 1)

        prod = Product.objects.get(sku='ARC-100')
        self.assertEqual(prod.name, 'Artisan Roast Coffee')
        self.assertEqual(prod.base_mrp, Decimal('450.00'))
        self.assertEqual(prod.category_id, self.cat_beverages)

        # Verify Inventory Inwarding
        inv = Inventory.objects.get(store_id=self.store, product_id=prod)
        self.assertEqual(inv.stock_quantity, 25)
        self.assertEqual(inv.batch_number, 'BATCH-01')

        # Verify Stock Movement audit log
        movement = StockMovement.objects.get(inventory_id=inv)
        self.assertEqual(movement.movement_type, StockMovementType.INITIAL_STOCK)
        self.assertEqual(movement.quantity_delta, 25)

    def test_product_bulk_import_duplicate_sku_in_file(self):
        csv_content = """name,sku,base_mrp
Product A,DUP-01,100.00
Product B,DUP-01,120.00
"""
        response = self.client.post(
            '/api/data-exchange/products/import/?dry_run=true',
            {'csv_content': csv_content},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['invalid_rows'], 1)
        self.assertIn('Duplicate SKU', response.data['errors'][0]['error'])

    def test_customer_bulk_import_commit(self):
        csv_content = """name,mobile_number,email,customer_type,loyalty_points
Priya Sharma,+91 98765 11111,priya@example.com,RETAIL,100
Wholesale Traders,098765 22222,info@wholesale.com,B2B,250
"""
        response = self.client.post(
            f'/api/data-exchange/customers/import/?dry_run=false&store_id={self.store.id}',
            {'csv_content': csv_content},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 2)

        c1 = Customer.objects.get(mobile_number='9876511111')
        self.assertEqual(c1.name, 'Priya Sharma')
        self.assertEqual(c1.customer_type, CustomerType.RETAIL)

        c2 = Customer.objects.get(mobile_number='9876522222')
        self.assertEqual(c2.name, 'Wholesale Traders')
        self.assertEqual(c2.customer_type, CustomerType.B2B)

    def test_sample_template_downloads(self):
        # Products template
        res_prod = self.client.get('/api/data-exchange/templates/products/')
        self.assertEqual(res_prod.status_code, status.HTTP_200_OK)
        self.assertEqual(res_prod['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('products_import_template.csv', res_prod['Content-Disposition'])
        self.assertIn('sku,barcode', res_prod.content.decode('utf-8'))

        # Customers template
        res_cust = self.client.get('/api/data-exchange/templates/customers/')
        self.assertEqual(res_cust.status_code, status.HTTP_200_OK)
        self.assertIn('mobile_number', res_cust.content.decode('utf-8'))

        # Invalid template
        res_inv = self.client.get('/api/data-exchange/templates/unknown/')
        self.assertEqual(res_inv.status_code, status.HTTP_400_BAD_REQUEST)

    def test_universal_export_products(self):
        Product.objects.create(
            organization_id=self.org,
            name='Test Export Widget',
            sku='TEW-001',
            cost_price=Decimal('50.00'),
            base_mrp=Decimal('99.00'),
            category_id=self.cat_snacks
        )

        response = self.client.get('/api/data-exchange/export/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv; charset=utf-8')
        content = response.content.decode('utf-8')
        self.assertIn('Product ID,Name,SKU', content)
        self.assertIn('Test Export Widget', content)
        self.assertIn('TEW-001', content)

    def test_universal_export_inventory(self):
        prod = Product.objects.create(
            organization_id=self.org,
            name='Inventory Widget',
            sku='INV-001',
            base_mrp=Decimal('150.00')
        )
        Inventory.objects.create(
            store_id=self.store,
            product_id=prod,
            stock_quantity=40,
            store_price=Decimal('150.00')
        )

        response = self.client.get(f'/api/data-exchange/export/inventory/?store_id={self.store.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode('utf-8')
        self.assertIn('Inventory ID,Store Name', content)
        self.assertIn('Inventory Widget', content)
        self.assertIn('Central Depot', content)

    def test_universal_export_invoices(self):
        Invoice.objects.create(
            store_id=self.store,
            invoice_number='INV-EXPORT-001',
            subtotal=Decimal('1000.00'),
            total_discount=Decimal('100.00'),
            cgst_amount=Decimal('45.00'),
            sgst_amount=Decimal('45.00'),
            igst_amount=Decimal('0.00'),
            total_gst=Decimal('90.00'),
            grand_total=Decimal('990.00'),
            status='PAID'
        )

        response = self.client.get(f'/api/data-exchange/export/invoices/?store_id={self.store.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode('utf-8')
        self.assertIn('Invoice Number,Store Name', content)
        self.assertIn('INV-EXPORT-001', content)
        self.assertIn('990.00', content)

    def test_universal_export_customers(self):
        Customer.objects.create(
            name='Export Customer',
            mobile_number='9999888877',
            customer_type=CustomerType.RETAIL
        )

        response = self.client.get('/api/data-exchange/export/customers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode('utf-8')
        self.assertIn('Export Customer', content)
        self.assertIn('9999888877', content)
