from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.inventory.serializers import InventorySerializer, StockMovementSerializer
from db.models import (
    Category,
    Inventory,
    Organization,
    Product,
    StockMovement,
    StockMovementType,
    Store,
    UnitOfMeasure,
    User,
    Vendor,
    VendorProduct,
)


class InventoryModelTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='FreshMart Org', subdomain='freshmart')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='FreshMart Downtown',
            is_active=True
        )
        self.category = Category.objects.create(
            name='Dairy & Eggs',
            slug='dairy-eggs',
            default_tax_slab=Decimal('5.00')
        )
        self.product = Product.objects.create(
            organization_id=self.org,
            category_id=self.category,
            name='Organic Whole Milk 1L',
            sku='DAIRY-MILK-001',
            barcode='8901234567890',
            base_mrp=Decimal('65.00'),
            cost_price=Decimal('50.00'),
            uom=UnitOfMeasure.LITRE
        )
        self.vendor = Vendor.objects.create(
            organization_id=self.org,
            name='Green Pastures Dairy Ltd',
            gst_number='07AAAAA0000A1Z5'
        )
        self.user = User.objects.create_user(
            email='manager@freshmart.com',
            password='TestPassword123!',
            first_name='Store',
            last_name='Manager'
        )

    def test_inventory_creation_and_defaults(self):
        """Test default values on Inventory creation."""
        inventory = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product,
            vendor_id=self.vendor
        )
        self.assertEqual(inventory.stock_quantity, 0)
        self.assertEqual(inventory.low_stock_threshold, 10)
        self.assertEqual(inventory.reorder_quantity, 50)
        self.assertIsNone(inventory.store_price)
        self.assertIsNone(inventory.batch_number)
        self.assertIsNone(inventory.last_restocked_at)
        self.assertEqual(
            str(inventory),
            f"{self.product.name} @ {self.store.name} (0 in stock)"
        )

    def test_inventory_unique_store_product_constraint(self):
        """Test that duplicate store + product inventory records are rejected."""
        Inventory.objects.create(
            store_id=self.store,
            product_id=self.product
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            Inventory.objects.create(
                store_id=self.store,
                product_id=self.product
            )

    def test_is_low_stock_property(self):
        """Test is_low_stock property behaves correctly based on low_stock_threshold."""
        inventory = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product,
            stock_quantity=10,
            low_stock_threshold=10
        )
        # At threshold -> low stock
        self.assertTrue(inventory.is_low_stock)

        # Below threshold -> low stock
        inventory.stock_quantity = 5
        self.assertTrue(inventory.is_low_stock)

        # Above threshold -> healthy stock
        inventory.stock_quantity = 11
        self.assertFalse(inventory.is_low_stock)

    def test_effective_price_calculation(self):
        """Test effective_price returns store_price override or falls back to base_mrp."""
        inventory = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product,
            store_price=None
        )
        # Fallback to product MRP
        self.assertEqual(inventory.effective_price, Decimal('65.00'))

        # Override store price
        inventory.store_price = Decimal('59.99')
        inventory.save()
        self.assertEqual(inventory.effective_price, Decimal('59.99'))


class StockMovementAndAdjustmentTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Supermarket Ltd', subdomain='supermarket')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Supermarket Main',
            is_active=True
        )
        self.product = Product.objects.create(
            organization_id=self.org,
            name='Brown Bread 400g',
            sku='BAKERY-BREAD-001',
            base_mrp=Decimal('40.00'),
            cost_price=Decimal('28.00'),
            uom=UnitOfMeasure.PACKET
        )
        self.inventory = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product,
            stock_quantity=0,
            low_stock_threshold=15
        )
        self.user = User.objects.create_user(
            email='cashier@supermarket.com',
            password='TestPassword123!',
            first_name='John',
            last_name='Cashier'
        )

    def test_adjust_stock_purchase_receipt_grn(self):
        """Test receiving stock from a purchase receipt (GRN) updates stock and logs movement."""
        movement = self.inventory.adjust_stock(
            quantity_delta=100,
            movement_type=StockMovementType.PURCHASE_RECEIPT,
            reason='PO-2026-0045 Received',
            user=self.user,
            reference_id='GRN-8891',
            notes='All cartons in pristine condition'
        )

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, 100)
        self.assertIsNotNone(self.inventory.last_restocked_at)
        self.assertEqual(self.inventory.updated_by, self.user)

        # Audit ledger assertion
        self.assertEqual(movement.inventory_id, self.inventory)
        self.assertEqual(movement.store_id, self.store)
        self.assertEqual(movement.product_id, self.product)
        self.assertEqual(movement.movement_type, StockMovementType.PURCHASE_RECEIPT)
        self.assertEqual(movement.quantity_delta, 100)
        self.assertEqual(movement.quantity_before, 0)
        self.assertEqual(movement.quantity_after, 100)
        self.assertEqual(movement.reference_id, 'GRN-8891')
        self.assertEqual(movement.created_by, self.user)
        self.assertEqual(movement.reason, 'PO-2026-0045 Received')

    def test_adjust_stock_pos_sale(self):
        """Test deducting stock during POS checkout."""
        # Initial stock setup
        self.inventory.adjust_stock(
            quantity_delta=50,
            movement_type=StockMovementType.INITIAL_STOCK
        )

        # POS checkout of 3 loaves
        movement = self.inventory.adjust_stock(
            quantity_delta=-3,
            movement_type=StockMovementType.POS_SALE,
            reference_id='INV-2026-10023',
            user=self.user
        )

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, 47)
        self.assertEqual(movement.quantity_delta, -3)
        self.assertEqual(movement.quantity_before, 50)
        self.assertEqual(movement.quantity_after, 47)
        self.assertEqual(movement.movement_type, StockMovementType.POS_SALE)

    def test_insufficient_stock_raises_validation_error(self):
        """Test that negative stock is prevented unless explicitly permitted."""
        self.inventory.adjust_stock(
            quantity_delta=10,
            movement_type=StockMovementType.INITIAL_STOCK
        )

        initial_movements_count = StockMovement.objects.count()

        # Try to deduct 15 units when only 10 available
        with self.assertRaises(ValidationError) as ctx:
            self.inventory.adjust_stock(
                quantity_delta=-15,
                movement_type=StockMovementType.POS_SALE
            )

        self.assertIn("Insufficient stock", str(ctx.exception))
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, 10)
        self.assertEqual(StockMovement.objects.count(), initial_movements_count)

    def test_allow_negative_stock_when_flag_enabled(self):
        """Test that stock can go negative when allow_negative=True."""
        self.inventory.adjust_stock(
            quantity_delta=5,
            movement_type=StockMovementType.INITIAL_STOCK
        )

        movement = self.inventory.adjust_stock(
            quantity_delta=-8,
            movement_type=StockMovementType.POS_SALE,
            allow_negative=True
        )

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, -3)
        self.assertEqual(movement.quantity_after, -3)

    def test_damage_and_waste_movement(self):
        """Test reporting damaged or expired inventory items."""
        self.inventory.adjust_stock(
            quantity_delta=20,
            movement_type=StockMovementType.INITIAL_STOCK
        )

        movement = self.inventory.adjust_stock(
            quantity_delta=-2,
            movement_type=StockMovementType.DAMAGE_WASTE,
            reason='Mould discovered on crust',
            notes='Disposed per food safety SOP',
            user=self.user
        )

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, 18)
        self.assertEqual(movement.movement_type, StockMovementType.DAMAGE_WASTE)
        self.assertEqual(movement.reason, 'Mould discovered on crust')

    def test_audit_physical_count_adjustment(self):
        """Test reconciliation during physical store audit count."""
        self.inventory.adjust_stock(
            quantity_delta=20,
            movement_type=StockMovementType.INITIAL_STOCK
        )

        # Auditor found 22 physical loaves (+2 adjustment)
        movement = self.inventory.adjust_stock(
            quantity_delta=2,
            movement_type=StockMovementType.AUDIT_ADJUSTMENT,
            reason='Physical cycle count reconciliation',
            reference_id='AUDIT-OCT-2026',
            user=self.user
        )

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, 22)
        self.assertEqual(movement.quantity_delta, 2)
        self.assertEqual(movement.quantity_before, 20)
        self.assertEqual(movement.quantity_after, 22)

    def test_stock_movement_string_representation(self):
        """Test human-readable string representation of StockMovement."""
        m_pos = StockMovement.objects.create(
            inventory_id=self.inventory,
            store_id=self.store,
            product_id=self.product,
            movement_type=StockMovementType.PURCHASE_RECEIPT,
            quantity_delta=25,
            quantity_before=0,
            quantity_after=25
        )
        self.assertIn('+25', str(m_pos))

        m_neg = StockMovement.objects.create(
            inventory_id=self.inventory,
            store_id=self.store,
            product_id=self.product,
            movement_type=StockMovementType.POS_SALE,
            quantity_delta=-5,
            quantity_before=25,
            quantity_after=20
        )
        self.assertIn('-5', str(m_neg))


class InventorySerializerTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Supermarket Ltd', subdomain='supermarket-ser')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Central Branch',
            is_active=True
        )
        self.product = Product.objects.create(
            organization_id=self.org,
            name='Orange Juice 1L',
            sku='BEV-OJ-001',
            base_mrp=Decimal('120.00'),
            cost_price=Decimal('85.00'),
            uom=UnitOfMeasure.LITRE
        )
        self.inventory = Inventory.objects.create(
            store_id=self.store,
            product_id=self.product,
            stock_quantity=8,
            low_stock_threshold=10,
            store_price=Decimal('115.00'),
            batch_number='LOT-2026-X1'
        )

    def test_inventory_serializer_computed_fields(self):
        """Test InventorySerializer serializes computed properties (is_low_stock, effective_price)."""
        serializer = InventorySerializer(instance=self.inventory)
        data = serializer.data

        self.assertTrue(data['is_low_stock'])
        self.assertEqual(Decimal(str(data['effective_price'])), Decimal('115.00'))
        self.assertEqual(data['batch_number'], 'LOT-2026-X1')
        self.assertEqual(data['product']['name'], 'Orange Juice 1L')
        self.assertEqual(data['store']['name'], 'Central Branch')

    def test_stock_movement_serializer(self):
        """Test StockMovementSerializer serialization."""
        movement = self.inventory.adjust_stock(
            quantity_delta=20,
            movement_type=StockMovementType.PURCHASE_RECEIPT,
            reference_id='GRN-1234'
        )
        serializer = StockMovementSerializer(instance=movement)
        data = serializer.data

        self.assertEqual(data['quantity_delta'], 20)
        self.assertEqual(data['movement_type'], StockMovementType.PURCHASE_RECEIPT)
        self.assertEqual(data['reference_id'], 'GRN-1234')
        self.assertEqual(data['product']['name'], 'Orange Juice 1L')


class InventoryAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='MegaStore Org', subdomain='megastore')
        self.store_a = Store.objects.create(
            organization_id=self.org,
            name='Store Alpha',
            is_active=True
        )
        self.store_b = Store.objects.create(
            organization_id=self.org,
            name='Store Beta',
            is_active=True
        )
        self.product_1 = Product.objects.create(
            organization_id=self.org,
            name='Basmati Rice 5kg',
            sku='RICE-BASMATI-5K',
            barcode='8901111222333',
            base_mrp=Decimal('450.00'),
            cost_price=Decimal('350.00'),
            uom=UnitOfMeasure.KG
        )
        self.product_2 = Product.objects.create(
            organization_id=self.org,
            name='Sunflower Oil 1L',
            sku='OIL-SUNFLOWER-1L',
            barcode='8904444555666',
            base_mrp=Decimal('180.00'),
            cost_price=Decimal('140.00'),
            uom=UnitOfMeasure.LITRE
        )
        self.inv_a1 = Inventory.objects.create(
            store_id=self.store_a,
            product_id=self.product_1,
            stock_quantity=20,
            low_stock_threshold=10,
            store_price=Decimal('440.00')
        )
        self.inv_a2 = Inventory.objects.create(
            store_id=self.store_a,
            product_id=self.product_2,
            stock_quantity=5,  # Low stock
            low_stock_threshold=15
        )
        self.inv_b1 = Inventory.objects.create(
            store_id=self.store_b,
            product_id=self.product_1,
            stock_quantity=50
        )
        self.user = User.objects.create_user(
            email='staff@megastore.com',
            password='Password123!',
            first_name='Alex',
            last_name='Staff'
        )
        self.client.force_authenticate(user=self.user)

    def test_inventory_list_unauthenticated(self):
        """Test unauthenticated requests are rejected with 401."""
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/inventory/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inventory_list_store_filter(self):
        """Test listing inventory scoped to a specific store."""
        response = self.client.get(f'/api/inventory/?store_id={self.store_a.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Results should only have items belonging to store_a
        items = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(items), 2)
        store_ids = {str(item['store_id']) for item in items}
        self.assertEqual(store_ids, {str(self.store_a.id)})

    def test_inventory_list_search_by_sku_and_name(self):
        """Test searching inventory by product SKU or name."""
        response = self.client.get(f'/api/inventory/?store_id={self.store_a.id}&search=RICE')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['product']['sku'], 'RICE-BASMATI-5K')

    def test_inventory_list_low_stock_filter(self):
        """Test filtering inventory for low-stock alert items."""
        response = self.client.get(f'/api/inventory/?store_id={self.store_a.id}&is_low_stock=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['product']['sku'], 'OIL-SUNFLOWER-1L')
        self.assertTrue(items[0]['is_low_stock'])

    def test_adjust_stock_action_positive_addition(self):
        """Test POST /api/inventory/{id}/adjust_stock/ successfully adds stock."""
        payload = {
            'quantity_delta': 15,
            'movement_type': StockMovementType.AUDIT_ADJUSTMENT,
            'reason': 'Found unopened pack behind rack',
            'reference_id': 'AUDIT-001'
        }
        response = self.client.post(f'/api/inventory/{self.inv_a1.id}/adjust_stock/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['inventory']['stock_quantity'], 35)
        self.assertEqual(response.data['movement']['quantity_delta'], 15)
        self.assertEqual(response.data['movement']['quantity_before'], 20)
        self.assertEqual(response.data['movement']['quantity_after'], 35)

    def test_adjust_stock_action_insufficient_stock(self):
        """Test POST /api/inventory/{id}/adjust_stock/ fails when stock becomes negative."""
        payload = {
            'quantity_delta': -25,  # Current is 20
            'movement_type': StockMovementType.POS_SALE,
            'reason': 'Customer purchase'
        }
        response = self.client.post(f'/api/inventory/{self.inv_a1.id}/adjust_stock/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Insufficient stock', response.data.get('error', ''))

    def test_adjust_stock_action_zero_delta_rejected(self):
        """Test POST /api/inventory/{id}/adjust_stock/ rejects zero delta."""
        payload = {
            'quantity_delta': 0,
            'movement_type': StockMovementType.AUDIT_ADJUSTMENT
        }
        response = self.client.post(f'/api/inventory/{self.inv_a1.id}/adjust_stock/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_receive_goods_grn_action(self):
        """Test POST /api/inventory/receive_goods/ in bulk inwarding."""
        product_new = Product.objects.create(
            organization_id=self.org,
            name='Green Tea 250g',
            sku='TEA-GREEN-250',
            base_mrp=Decimal('90.00')
        )
        payload = {
            'store_id': str(self.store_a.id),
            'reference_id': 'PO-88219-GRN',
            'notes': 'Delivered via express logistics',
            'items': [
                {
                    'product_id': str(self.product_1.id),
                    'quantity': 30,
                    'batch_number': 'LOT-RICE-2026'
                },
                {
                    'product_id': str(product_new.id),
                    'quantity': 45,
                    'store_price': '85.00',
                    'batch_number': 'LOT-TEA-001'
                }
            ]
        }
        response = self.client.post('/api/inventory/receive_goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['items_count'], 2)

        # Verify database state
        self.inv_a1.refresh_from_db()
        self.assertEqual(self.inv_a1.stock_quantity, 50)  # 20 + 30
        self.assertEqual(self.inv_a1.batch_number, 'LOT-RICE-2026')

        new_inv = Inventory.objects.get(store_id=self.store_a, product_id=product_new)
        self.assertEqual(new_inv.stock_quantity, 45)
        self.assertEqual(new_inv.store_price, Decimal('85.00'))

    def test_inventory_summary_action(self):
        """Test GET /api/inventory/summary/ returns store-level statistics."""
        response = self.client.get(f'/api/inventory/summary/?store_id={self.store_a.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['total_products'], 2)
        self.assertEqual(data['total_units_in_stock'], 25)  # 20 + 5
        self.assertEqual(data['low_stock_count'], 1)  # inv_a2 has 5 <= 15
        self.assertEqual(data['out_of_stock_count'], 0)
        self.assertGreater(Decimal(str(data['total_inventory_value'])), Decimal('0.00'))

    def test_stock_movements_query_and_filters(self):
        """Test GET /api/inventory/movements/ listing and filtering."""
        # Perform adjustment to generate movement
        self.inv_a1.adjust_stock(
            quantity_delta=10,
            movement_type=StockMovementType.PURCHASE_RECEIPT,
            reference_id='GRN-AUDIT-QUERY',
            user=self.user
        )
        response = self.client.get(
            f'/api/inventory/movements/?store_id={self.store_a.id}&movement_type=PURCHASE_RECEIPT'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertGreaterEqual(len(items), 1)
        self.assertEqual(items[0]['reference_id'], 'GRN-AUDIT-QUERY')

    def test_receive_goods_with_vendor_and_auto_pricing(self):
        """Test GRN inwarding with vendor selection auto-resolves negotiated cost price and records vendor on movement."""
        vendor = Vendor.objects.create(
            organization_id=self.org,
            name='Agro Foods Wholesale',
            gst_number='07AAAAA1111A1Z1',
        )
        product_mapped = Product.objects.create(
            organization_id=self.org,
            name='Wheat Flour 10kg',
            sku='FLOUR-WHEAT-10K',
            barcode='8909999888777',
            base_mrp=Decimal('450.00'),
            cost_price=Decimal('380.00'),
            uom=UnitOfMeasure.KG,
        )
        VendorProduct.objects.create(
            vendor_id=vendor,
            product_id=product_mapped,
            vendor_sku='AGRO-WF-10',
            negotiated_cost_price=Decimal('360.00'),
            minimum_order_quantity=20,
            lead_time_days=2,
            is_active=True,
        )

        payload = {
            'store_id': str(self.store_a.id),
            'vendor_id': str(vendor.id),
            'reference_id': 'GRN-AGRO-2026-001',
            'notes': 'Consignment verified by receiving dock',
            'items': [
                {
                    'product_id': str(product_mapped.id),
                    'quantity': 25,
                    'batch_number': 'LOT-WF-2026A',
                    # Notice: store_price is omitted, should auto-resolve to 360.00
                }
            ],
        }

        response = self.client.post('/api/inventory/receive_goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['items_count'], 1)
        self.assertEqual(response.data['vendor_id'], vendor.id)

        # Verify inventory store_price was auto-populated with negotiated cost price
        inv = Inventory.objects.get(store_id=self.store_a, product_id=product_mapped)
        self.assertEqual(inv.stock_quantity, 25)
        self.assertEqual(inv.store_price, Decimal('360.00'))
        self.assertEqual(inv.vendor_id, vendor)
        self.assertEqual(inv.batch_number, 'LOT-WF-2026A')

        # Verify stock movement audit ledger
        movement = StockMovement.objects.get(inventory_id=inv, movement_type=StockMovementType.PURCHASE_RECEIPT)
        self.assertEqual(movement.vendor_id, vendor)
        self.assertIn('Agro Foods Wholesale', movement.reason)
        self.assertEqual(movement.reference_id, 'GRN-AGRO-2026-001')

    def test_receive_goods_cross_tenant_vendor_rejected(self):
        """Test GRN inwarding rejects a vendor belonging to another organization."""
        other_org = Organization.objects.create(name='Other Org Ltd', subdomain='otherorg')
        rogue_vendor = Vendor.objects.create(
            organization_id=other_org,
            name='Rogue Cross-Tenant Vendor',
            gst_number='07BBBBB2222B2Z2',
        )

        payload = {
            'store_id': str(self.store_a.id),
            'vendor_id': str(rogue_vendor.id),
            'reference_id': 'PO-INVALID',
            'items': [
                {
                    'product_id': str(self.product_1.id),
                    'quantity': 10,
                }
            ],
        }

        response = self.client.post('/api/inventory/receive_goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('does not belong to the same organization', response.data['error'])

    def test_receive_goods_cross_tenant_product_rejected(self):
        """Test GRN inwarding rejects a product belonging to another organization."""
        other_org = Organization.objects.create(name='Competitor Retail', subdomain='competitor')
        alien_product = Product.objects.create(
            organization_id=other_org,
            name='Alien Widget',
            sku='ALIEN-001',
            barcode='8900000000000',
            base_mrp=Decimal('100.00'),
            uom=UnitOfMeasure.PCS,
        )

        payload = {
            'store_id': str(self.store_a.id),
            'reference_id': 'PO-ALIEN',
            'items': [
                {
                    'product_id': str(alien_product.id),
                    'quantity': 5,
                }
            ],
        }

        response = self.client.post('/api/inventory/receive_goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stock_movements_filter_by_vendor(self):
        """Test GET /api/inventory/movements/?vendor_id={id} filters audit trail by vendor."""
        vendor_x = Vendor.objects.create(
            organization_id=self.org,
            name='Vendor X Logistics',
            gst_number='07CCCCC3333C3Z3',
        )
        # Create GRN movement with vendor_x
        self.inv_a1.adjust_stock(
            quantity_delta=15,
            movement_type=StockMovementType.PURCHASE_RECEIPT,
            reference_id='GRN-VENDOR-X',
            user=self.user,
            vendor=vendor_x,
        )

        response = self.client.get(f'/api/inventory/movements/?vendor_id={vendor_x.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['reference_id'], 'GRN-VENDOR-X')
        self.assertEqual(items[0]['vendor']['name'], 'Vendor X Logistics')


