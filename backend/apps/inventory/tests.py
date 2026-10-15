from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

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
