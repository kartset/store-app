from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Customer,
    CustomerType,
    FulfillmentType,
    Inventory,
    InvoiceItem,
    InvoiceStatus,
    Order,
    OrderItem,
    OrderPaymentStatus,
    OrderStatus,
    Organization,
    PaymentMethod,
    Product,
    StockMovement,
    StockMovementType,
    Store,
    generate_order_number,
)


class OrderModelTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Acme Retail Corp', subdomain='acme')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Connaught Place Flagship',
            gst_number='07AAAAA0000A1Z5',
            is_active=True
        )

    def test_order_number_generation(self):
        """Verifies order numbers generate with store code and sequential increment."""
        ord_no_1 = generate_order_number(self.store)
        today_str = timezone.now().date().strftime("%Y%m%d")
        self.assertTrue(ord_no_1.startswith(f"ORD-CONN-{today_str}-"))
        self.assertTrue(ord_no_1.endswith("0001"))

        # Create an order with this number
        Order.objects.create(
            store_id=self.store,
            order_number=ord_no_1,
            grand_total=Decimal('500.00')
        )

        # Second order number should increment to 0002
        ord_no_2 = generate_order_number(self.store)
        self.assertTrue(ord_no_2.endswith("0002"))

    def test_order_auto_assigns_number_on_save(self):
        """Verifies order automatically generates and assigns order_number on save if omitted."""
        order = Order.objects.create(
            store_id=self.store,
            grand_total=Decimal('750.00')
        )
        self.assertIsNotNone(order.order_number)
        self.assertTrue(order.order_number.startswith("ORD-CONN-"))
        self.assertEqual(order.status, OrderStatus.PENDING)
        self.assertEqual(order.fulfillment_type, FulfillmentType.STORE_PICKUP)
        self.assertEqual(order.payment_status, OrderPaymentStatus.UNPAID)
        self.assertEqual(order.total_amount, Decimal('750.00'))


class OrderAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='OmniRetail Group', subdomain='omniretail')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Indiranagar Hub',
            gst_number='29AAAAA0000A1Z5',
            is_active=True
        )
        self.customer = Customer.objects.create(
            name='Priya Sharma',
            mobile_number='9876543210',
            email='priya@example.com',
            customer_type=CustomerType.RETAIL,
            address_line1='123 100ft Road, Indiranagar',
            city='Bengaluru',
            state='Karnataka',
            pincode='560038'
        )
        self.product1 = Product.objects.create(
            organization_id=self.org,
            name='Organic Almond Milk 1L',
            sku='OAM-1L',
            barcode='8901234567890',
            base_mrp=Decimal('300.00'),
            tax_slab=Decimal('5.00')
        )
        self.product2 = Product.objects.create(
            organization_id=self.org,
            name='Cold Brew Coffee 250ml',
            sku='CBC-250',
            barcode='8901234567891',
            base_mrp=Decimal('150.00'),
            tax_slab=Decimal('12.00')
        )
        self.inv1 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product1,
            stock_quantity=50,
            store_price=Decimal('280.00')
        )
        self.inv2 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product2,
            stock_quantity=30,
            store_price=Decimal('150.00')
        )

    def test_create_order_success(self):
        """Verifies creating an order with items, snapshots, and delivery details."""
        payload = {
            'store_id': str(self.store.id),
            'customer_id': str(self.customer.id),
            'fulfillment_type': FulfillmentType.HOME_DELIVERY,
            'payment_status': OrderPaymentStatus.UNPAID,
            'customer_name': 'Priya Sharma',
            'customer_phone': '9876543210',
            'delivery_address_line1': 'Flat 402, Green Glen Layout',
            'delivery_city': 'Bengaluru',
            'delivery_state': 'Karnataka',
            'delivery_pincode': '560103',
            'delivery_notes': 'Ring the bell twice',
            'items': [
                {
                    'product_id': str(self.product1.id),
                    'quantity': 2,
                    'discount': '10.00'
                },
                {
                    'product_id': str(self.product2.id),
                    'quantity': 1,
                    'discount': '0.00'
                }
            ]
        }

        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data

        self.assertTrue(data['order_number'].startswith('ORD-INDI-'))
        self.assertEqual(data['status'], OrderStatus.PENDING)
        self.assertEqual(data['fulfillment_type'], FulfillmentType.HOME_DELIVERY)
        self.assertEqual(data['customer_name_snapshot'], 'Priya Sharma')
        self.assertEqual(data['delivery_pincode'], '560103')
        self.assertEqual(data['items_count'], 2)

        # Totals verification:
        # Product 1: 280 * 2 = 560 - 10 = 550
        # Product 2: 150 * 1 = 150 - 0 = 150
        # Grand Total = 550 + 150 = 700.00
        self.assertEqual(Decimal(data['grand_total']), Decimal('700.00'))

        order = Order.objects.get(id=data['id'])
        self.assertEqual(order.items.count(), 2)
        item1 = order.items.get(product_id=self.product1)
        self.assertEqual(item1.product_name_snapshot, 'Organic Almond Milk 1L')
        self.assertEqual(item1.quantity, 2)
        self.assertEqual(item1.unit_price, Decimal('280.00'))
        self.assertEqual(item1.line_total, Decimal('550.00'))

    def test_list_orders_and_filtering(self):
        """Verifies filtering orders by store, customer, status, and search."""
        order1 = Order.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            status=OrderStatus.PENDING,
            customer_name_snapshot='Priya Sharma',
            customer_phone_snapshot='9876543210',
            grand_total=Decimal('400.00')
        )
        order2 = Order.objects.create(
            store_id=self.store,
            status=OrderStatus.CONFIRMED,
            customer_name_snapshot='Rahul Verma',
            customer_phone_snapshot='9998887776',
            grand_total=Decimal('600.00')
        )

        # Store filter
        res = self.client.get(f'/api/orders/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)

        # Status filter
        res = self.client.get('/api/orders/?status=PENDING')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], str(order1.id))

        # Search filter
        res = self.client.get('/api/orders/?search=Rahul')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], str(order2.id))

    def test_retrieve_order(self):
        """Verifies retrieving single order detail with nested items and store/customer."""
        order = Order.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            status=OrderStatus.PENDING,
            grand_total=Decimal('300.00')
        )
        OrderItem.objects.create(
            order_id=order,
            product_id=self.product1,
            product_name_snapshot=self.product1.name,
            sku_snapshot=self.product1.sku,
            quantity=1,
            unit_price=Decimal('300.00'),
            line_total=Decimal('300.00')
        )

        res = self.client.get(f'/api/orders/{order.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['order_number'], order.order_number)
        self.assertEqual(len(res.data['items']), 1)
        self.assertEqual(res.data['store']['name'], self.store.name)


class OrderFulfillmentTransitionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='Fulfillment Org', subdomain='fulfill')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Koramangala Express',
            gst_number='29BBBBB0000B1Z5',
            is_active=True
        )
        self.order = Order.objects.create(
            store_id=self.store,
            status=OrderStatus.PENDING,
            grand_total=Decimal('500.00')
        )

    def test_confirm_order(self):
        """Verifies PENDING -> CONFIRMED transition."""
        res = self.client.post(f'/api/orders/{self.order.id}/confirm/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], OrderStatus.CONFIRMED)
        self.assertIsNotNone(res.data['confirmed_at'])

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.CONFIRMED)

    def test_confirm_order_invalid_status(self):
        """Verifies non-PENDING order cannot be confirmed."""
        self.order.status = OrderStatus.CONFIRMED
        self.order.save()

        res = self.client.post(f'/api/orders/{self.order.id}/confirm/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pack_order(self):
        """Verifies CONFIRMED -> PACKED transition."""
        self.order.status = OrderStatus.CONFIRMED
        self.order.save()

        res = self.client.post(f'/api/orders/{self.order.id}/pack/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], OrderStatus.PACKED)
        self.assertIsNotNone(res.data['packed_at'])

    def test_pack_order_invalid_status(self):
        """Verifies non-CONFIRMED order cannot be packed."""
        res = self.client.post(f'/api/orders/{self.order.id}/pack/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ready_order(self):
        """Verifies PACKED -> READY_FOR_PICKUP transition."""
        self.order.status = OrderStatus.PACKED
        self.order.save()

        res = self.client.post(f'/api/orders/{self.order.id}/ready/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], OrderStatus.READY_FOR_PICKUP)
        self.assertIsNotNone(res.data['ready_at'])

    def test_cancel_order(self):
        """Verifies cancelling an order and storing reason."""
        res = self.client.post(
            f'/api/orders/{self.order.id}/cancel/',
            {'reason': 'Customer requested cancellation via phone'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], OrderStatus.CANCELLED)
        self.assertEqual(res.data['cancellation_reason'], 'Customer requested cancellation via phone')
        self.assertIsNotNone(res.data['cancelled_at'])

    def test_cancel_completed_order_fails(self):
        """Verifies already completed order cannot be cancelled."""
        self.order.status = OrderStatus.COMPLETED
        self.order.save()

        res = self.client.post(f'/api/orders/{self.order.id}/cancel/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class OrderConvertToInvoiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='Conversion Retail', subdomain='conversion')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='MG Road Flagship',
            gst_number='29CCCCC0000C1Z5',
            is_active=True
        )
        self.customer = Customer.objects.create(
            name='Karan Johar',
            mobile_number='9811122233',
            customer_type=CustomerType.RETAIL
        )
        self.product1 = Product.objects.create(
            organization_id=self.org,
            name='Wireless Earbuds Pro',
            sku='WEP-001',
            barcode='890999900001',
            base_mrp=Decimal('2000.00'),
            tax_slab=Decimal('18.00')
        )
        self.product2 = Product.objects.create(
            organization_id=self.org,
            name='Fast Charger 30W',
            sku='FC-30W',
            barcode='890999900002',
            base_mrp=Decimal('800.00'),
            tax_slab=Decimal('18.00')
        )
        self.inv1 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product1,
            stock_quantity=20,
            store_price=Decimal('2000.00')
        )
        self.inv2 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product2,
            stock_quantity=15,
            store_price=Decimal('800.00')
        )

        self.order = Order.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            status=OrderStatus.CONFIRMED,
            customer_name_snapshot='Karan Johar',
            customer_phone_snapshot='9811122233',
            subtotal=Decimal('2800.00'),
            grand_total=Decimal('2800.00')
        )
        OrderItem.objects.create(
            order_id=self.order,
            product_id=self.product1,
            product_name_snapshot=self.product1.name,
            sku_snapshot=self.product1.sku,
            barcode_snapshot=self.product1.barcode,
            quantity=1,
            unit_price=Decimal('2000.00'),
            tax_slab=Decimal('18.00'),
            line_total=Decimal('2000.00')
        )
        OrderItem.objects.create(
            order_id=self.order,
            product_id=self.product2,
            product_name_snapshot=self.product2.name,
            sku_snapshot=self.product2.sku,
            barcode_snapshot=self.product2.barcode,
            quantity=1,
            unit_price=Decimal('800.00'),
            tax_slab=Decimal('18.00'),
            line_total=Decimal('800.00')
        )

    def test_convert_to_invoice_success_with_payment(self):
        """
        Verifies atomic conversion:
        - Deducts stock quantity and creates StockMovement audit trail.
        - Creates Invoice and InvoiceItem records.
        - Records Payment and marks invoice and order as PAID and COMPLETED.
        - Links invoice_id to order.
        """
        payload = {
            'payment_method': PaymentMethod.UPI,
            'payment_amount': '2800.00',
            'notes': 'Online prepaid via UPI'
        }

        res = self.client.post(f'/api/orders/{self.order.id}/convert-to-invoice/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertIn('invoice', data)
        self.assertIn('order', data)

        inv_data = data['invoice']
        ord_data = data['order']

        self.assertEqual(ord_data['status'], OrderStatus.COMPLETED)
        self.assertEqual(ord_data['payment_status'], OrderPaymentStatus.PAID)
        self.assertEqual(str(ord_data['invoice_id']), str(inv_data['id']))
        self.assertEqual(inv_data['status'], InvoiceStatus.PAID)
        self.assertEqual(Decimal(inv_data['grand_total']), Decimal('2800.00'))

        # Verify inventory stock deduction
        self.inv1.refresh_from_db()
        self.inv2.refresh_from_db()
        self.assertEqual(self.inv1.stock_quantity, 19)  # 20 - 1
        self.assertEqual(self.inv2.stock_quantity, 14)  # 15 - 1

        # Verify StockMovement records
        movements = StockMovement.objects.filter(movement_type=StockMovementType.POS_SALE)
        self.assertEqual(movements.count(), 2)

        # Verify InvoiceItems created
        items = InvoiceItem.objects.filter(invoice_id=inv_data['id'])
        self.assertEqual(items.count(), 2)

    def test_convert_to_invoice_insufficient_stock_fails(self):
        """Verifies conversion is rejected if any product has insufficient stock."""
        self.inv1.stock_quantity = 0
        self.inv1.save()

        res = self.client.post(f'/api/orders/{self.order.id}/convert-to-invoice/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient stock", str(res.data))

        # Ensure order remains unconverted
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.CONFIRMED)
        self.assertIsNone(self.order.invoice_id)

    def test_convert_already_converted_order_fails(self):
        """Verifies converting an already completed order fails."""
        self.order.status = OrderStatus.COMPLETED
        self.order.save()

        res = self.client.post(f'/api/orders/{self.order.id}/convert-to-invoice/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_convert_cancelled_order_fails(self):
        """Verifies converting a cancelled order fails."""
        self.order.status = OrderStatus.CANCELLED
        self.order.save()

        res = self.client.post(f'/api/orders/{self.order.id}/convert-to-invoice/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class OrderStatsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='Stats Org', subdomain='stats')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Stats Store',
            gst_number='29DDDDD0000D1Z5',
            is_active=True
        )
        Order.objects.create(store_id=self.store, status=OrderStatus.PENDING, grand_total=Decimal('100.00'))
        Order.objects.create(store_id=self.store, status=OrderStatus.CONFIRMED, grand_total=Decimal('200.00'))
        Order.objects.create(store_id=self.store, status=OrderStatus.PACKED, grand_total=Decimal('300.00'))
        Order.objects.create(store_id=self.store, status=OrderStatus.COMPLETED, grand_total=Decimal('400.00'))

    def test_order_stats(self):
        """Verifies aggregation of counts and revenue in stats endpoint."""
        res = self.client.get(f'/api/orders/stats/?store_id={self.store.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(data['total_orders'], 4)
        self.assertEqual(data['pending'], 1)
        self.assertEqual(data['confirmed'], 1)
        self.assertEqual(data['packed'], 1)
        self.assertEqual(data['completed'], 1)
        self.assertEqual(Decimal(data['today_revenue']), Decimal('900.00'))
