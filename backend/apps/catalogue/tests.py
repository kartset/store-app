from decimal import Decimal

from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    CatalogueItem,
    Category,
    Inventory,
    Organization,
    OrganizationStaff,
    Product,
    StockMovement,
    StockMovementType,
    Store,
    UnitOfMeasure,
    User,
)


class CatalogueItemModelTests(TestCase):
    def test_create_catalogue_item(self):
        """Test creating a CatalogueItem with full retail metadata."""
        item = CatalogueItem.objects.create(
            name='Coca Cola 500ml Pet Bottle',
            sku='BEV-COKE-500ML',
            barcode='5449000000996',
            brand_name='Coca-Cola',
            category_name='Beverages / Cold Drinks',
            hsn_code='220210',
            tax_slab=Decimal('28.00'),
            uom=UnitOfMeasure.PCS,
            suggested_mrp=Decimal('40.00'),
            description='Refreshing carbonated soft drink 500ml bottle.'
        )
        self.assertIsNotNone(item.id)
        self.assertEqual(item.name, 'Coca Cola 500ml Pet Bottle')
        self.assertEqual(item.barcode, '5449000000996')
        self.assertEqual(item.tax_slab, Decimal('28.00'))
        self.assertEqual(item.uom, UnitOfMeasure.PCS)
        self.assertTrue(item.is_active)
        self.assertEqual(str(item), 'Coca Cola 500ml Pet Bottle (BEV-COKE-500ML)')

    def test_soft_delete_and_restore(self):
        """Test soft delete sets is_deleted flag and restore recovers it."""
        item = CatalogueItem.objects.create(
            name='Lay\'s Classic Salted 50g',
            sku='SNK-LAYS-50G',
            barcode='8901491101837'
        )
        item.soft_delete()
        item.refresh_from_db()
        self.assertTrue(item.is_deleted)
        self.assertIsNotNone(item.deleted_at)

        item.restore()
        item.refresh_from_db()
        self.assertFalse(item.is_deleted)
        self.assertIsNone(item.deleted_at)

    def test_duplicate_sku_raises_integrity_error(self):
        """Test unique constraint on canonical SKU."""
        CatalogueItem.objects.create(name='Item 1', sku='GLOBAL-SKU-100')
        with self.assertRaises(IntegrityError):
            CatalogueItem.objects.create(name='Item 2', sku='GLOBAL-SKU-100')

    def test_duplicate_barcode_raises_integrity_error(self):
        """Test unique constraint on universal barcode."""
        CatalogueItem.objects.create(name='Item 1', sku='SKU-001', barcode='1112223334445')
        with self.assertRaises(IntegrityError):
            CatalogueItem.objects.create(name='Item 2', sku='SKU-002', barcode='1112223334445')


class CatalogueItemAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create organization & stores
        self.org = Organization.objects.create(name='Apex Retailers', subdomain='apex')
        self.other_org = Organization.objects.create(name='Delta Mart', subdomain='delta')

        self.store = Store.objects.create(
            organization_id=self.org,
            name='Apex Flagship Store',
            is_active=True
        )

        # Create platform category
        self.category = Category.objects.create(
            name='Snacks & Confectionery',
            slug='snacks-confectionery',
            default_tax_slab=Decimal('12.00')
        )

        # Users
        self.admin_user = User.objects.create_user(
            email='admin@apex.com',
            password='Password123!',
            first_name='Karan',
            last_name='Admin'
        )
        self.staff_user = User.objects.create_user(
            email='staff@apex.com',
            password='Password123!',
            first_name='Rohan',
            last_name='Cashier'
        )
        self.superuser = User.objects.create_user(
            email='super@platform.com',
            password='Password123!',
            first_name='Super',
            last_name='User'
        )


        # Assign Org Admin role
        OrganizationStaff.objects.create(
            organization_id=self.org,
            user_id=self.admin_user,
            role='ORG_ADMIN',
            is_active=True
        )

        # Global Catalogue Items
        self.item_coke = CatalogueItem.objects.create(
            name='Coca Cola 750ml',
            sku='BEV-COKE-750',
            barcode='5449000000750',
            brand_name='Coca-Cola',
            category_name='Beverages',
            hsn_code='220210',
            tax_slab=Decimal('28.00'),
            uom=UnitOfMeasure.PCS,
            suggested_mrp=Decimal('45.00')
        )
        self.item_lays = CatalogueItem.objects.create(
            name='Lays India Magic Masala 52g',
            sku='SNK-LAYS-MASALA',
            barcode='8901491101850',
            brand_name='Frito-Lay',
            category_name='Snacks',
            hsn_code='190590',
            tax_slab=Decimal('12.00'),
            uom=UnitOfMeasure.PACKET,
            suggested_mrp=Decimal('20.00')
        )
        self.item_dairy_milk = CatalogueItem.objects.create(
            name='Cadbury Dairy Milk Silk 60g',
            sku='CHO-CADBURY-SILK',
            barcode='7622201444111',
            brand_name='Cadbury',
            category_name='Chocolates',
            hsn_code='180632',
            tax_slab=Decimal('18.00'),
            uom=UnitOfMeasure.PCS,
            suggested_mrp=Decimal('85.00')
        )

        self.client.force_authenticate(user=self.admin_user)

    def test_list_catalogue_items_unauthenticated(self):
        """Unauthenticated requests are rejected with 401."""
        self.client.force_authenticate(user=None)
        res = self.client.get('/api/catalogue/items/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_catalogue_items_authenticated(self):
        """Authenticated users can browse global catalogue items."""
        res = self.client.get('/api/catalogue/items/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 3)

    def test_search_catalogue_items_by_name(self):
        """Search query filters products by name across the catalogue."""
        res = self.client.get('/api/catalogue/items/?search=coke')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Coca Cola 750ml')

    def test_search_catalogue_items_by_barcode(self):
        """Barcode filter returns the matching item."""
        res = self.client.get('/api/catalogue/items/?barcode=8901491101850')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['sku'], 'SNK-LAYS-MASALA')

    def test_filter_by_tax_slab_and_uom(self):
        """Filter by tax slab and UOM attributes."""
        res = self.client.get('/api/catalogue/items/?tax_slab=28.00&uom=PCS')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['sku'], 'BEV-COKE-750')

    def test_lookup_by_barcode_success(self):
        """Fast POS / scanner lookup by barcode returns 200."""
        res = self.client.get('/api/catalogue/items/lookup/?barcode=7622201444111')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['name'], 'Cadbury Dairy Milk Silk 60g')
        self.assertEqual(res.data['sku'], 'CHO-CADBURY-SILK')

    def test_lookup_by_sku_success(self):
        """Fast lookup by canonical SKU returns 200."""
        res = self.client.get('/api/catalogue/items/lookup/?sku=BEV-COKE-750')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['barcode'], '5449000000750')

    def test_lookup_not_found(self):
        """Barcode lookup for nonexistent item returns 404."""
        res = self.client.get('/api/catalogue/items/lookup/?barcode=0000000000000')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_lookup_missing_parameters(self):
        """Lookup without barcode or sku returns 400 Bad Request."""
        res = self.client.get('/api/catalogue/items/lookup/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_adopt_catalogue_item_non_admin_forbidden(self):
        """Non-admin store staff cannot adopt global catalogue items into the organization."""
        self.client.force_authenticate(user=self.staff_user)
        payload = {
            'organization_id': str(self.org.id),
            'cost_price': '30.00',
            'base_mrp': '45.00'
        }
        res = self.client.post(f'/api/catalogue/items/{self.item_coke.id}/adopt/', payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_adopt_catalogue_item_success(self):
        """Org Admin can adopt a Global Catalogue Item into the Organization Product Master."""
        payload = {
            'organization_id': str(self.org.id),
            'cost_price': '32.50',
            'base_mrp': '45.00',
            'category_id': str(self.category.id),
            'low_stock_threshold': 15
        }
        res = self.client.post(f'/api/catalogue/items/{self.item_coke.id}/adopt/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data['product']

        # Verify product created
        self.assertEqual(data['name'], 'Coca Cola 750ml')
        self.assertEqual(data['barcode'], '5449000000750')
        self.assertEqual(data['sku'], 'BEV-COKE-750')
        self.assertEqual(str(data['catalogue_item_id']), str(self.item_coke.id))
        self.assertEqual(Decimal(str(data['cost_price'])), Decimal('32.50'))
        self.assertEqual(Decimal(str(data['base_mrp'])), Decimal('45.00'))
        self.assertEqual(Decimal(str(data['tax_slab'])), Decimal('28.00'))
        self.assertEqual(data['low_stock_threshold'], 15)


        # Database verification
        product = Product.objects.get(id=data['id'])
        self.assertEqual(product.organization_id, self.org)
        self.assertEqual(product.catalogue_item_id, self.item_coke)

    def test_adopt_catalogue_item_with_store_inventory(self):
        """Adopting with store_id and initial_stock creates Inventory & StockMovement automatically."""
        payload = {
            'organization_id': str(self.org.id),
            'cost_price': '14.00',
            'base_mrp': '20.00',
            'store_id': str(self.store.id),
            'initial_stock': 100,
            'store_price': '19.50'
        }
        res = self.client.post(f'/api/catalogue/items/{self.item_lays.id}/adopt/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        product_id = res.data['product']['id']

        # Check Inventory created
        inv = Inventory.objects.get(store_id=self.store, product_id_id=product_id)
        self.assertEqual(inv.stock_quantity, 100)
        self.assertEqual(inv.store_price, Decimal('19.50'))

        # Check StockMovement audit ledger entry
        movement = StockMovement.objects.get(inventory_id=inv)
        self.assertEqual(movement.movement_type, StockMovementType.INITIAL_STOCK)
        self.assertEqual(movement.quantity_delta, 100)
        self.assertEqual(movement.quantity_after, 100)

    def test_adopt_catalogue_item_already_adopted_conflict(self):
        """Attempting to adopt an already adopted item returns 409 Conflict."""
        payload = {
            'organization_id': str(self.org.id),
            'cost_price': '50.00'
        }
        # First adoption
        res1 = self.client.post(f'/api/catalogue/items/{self.item_dairy_milk.id}/adopt/', payload)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second adoption attempt
        res2 = self.client.post(f'/api/catalogue/items/{self.item_dairy_milk.id}/adopt/', payload)
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("already been adopted", res2.data['detail'])

    def test_adopt_catalogue_item_sku_conflict_auto_resolved(self):
        """If the default SKU already exists in org on an unrelated product, auto-suffixed unique SKU is used."""
        # Create unrelated product in org with same SKU
        Product.objects.create(
            organization_id=self.org,
            name='Different Item Same SKU',
            sku='BEV-COKE-750'
        )

        payload = {
            'organization_id': str(self.org.id),
            'base_mrp': '45.00'
        }
        res = self.client.post(f'/api/catalogue/items/{self.item_coke.id}/adopt/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # Verify SKU has suffix
        new_sku = res.data['product']['sku']
        self.assertTrue(new_sku.startswith('BEV-COKE-750-'))

    def test_bulk_adopt_success(self):
        """Bulk adoption imports multiple catalogue items at once."""
        payload = {
            'organization_id': str(self.org.id),
            'catalogue_item_ids': [
                str(self.item_coke.id),
                str(self.item_lays.id),
                str(self.item_dairy_milk.id)
            ],
            'category_id': str(self.category.id)
        }
        res = self.client.post('/api/catalogue/items/bulk_adopt/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['adopted_count'], 3)
        self.assertEqual(res.data['skipped_count'], 0)
        self.assertEqual(len(res.data['products']), 3)

        # Verify in DB
        products = Product.objects.filter(organization_id=self.org)
        self.assertEqual(products.count(), 3)

    def test_bulk_adopt_skips_already_adopted(self):
        """Bulk adoption skips already adopted items gracefully."""
        # Pre-adopt one item
        Product.objects.create(
            organization_id=self.org,
            catalogue_item_id=self.item_coke,
            name=self.item_coke.name,
            sku=self.item_coke.sku
        )

        payload = {
            'organization_id': str(self.org.id),
            'catalogue_item_ids': [
                str(self.item_coke.id),
                str(self.item_lays.id)
            ]
        }
        res = self.client.post('/api/catalogue/items/bulk_adopt/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['adopted_count'], 1)
        self.assertEqual(res.data['skipped_count'], 1)
        self.assertIn("already adopted", res.data['skipped'][0])
