from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase

from db.models import (
    Brand,
    Category,
    Organization,
    OrganizationCategory,
    Product,
    Store,
    StoreCategory,
    UnitOfMeasure,
)


class MasterCatalogModelTests(TestCase):
    def setUp(self):
        # Set up two separate organizations
        self.org_1 = Organization.objects.create(name='Supermart Org', subdomain='supermart')
        self.org_2 = Organization.objects.create(name='Metro Retail', subdomain='metro')

        # Set up stores under org_1
        self.store_grocery = Store.objects.create(organization_id=self.org_1, name='Supermart Fresh', is_active=True)
        self.store_appliance = Store.objects.create(organization_id=self.org_1, name='Supermart Digital', is_active=True)
        self.store_hyper = Store.objects.create(organization_id=self.org_1, name='Supermart Mega Mall', is_active=True)

    def test_global_category_tree_hierarchy(self):
        """Test hierarchical global category tree with parent-child nesting and default tax slabs."""
        root_cat = Category.objects.create(
            name='Food & Beverages',
            slug='food-beverages',
            default_hsn_code='2106',
            default_tax_slab=Decimal('5.00')
        )
        child_cat = Category.objects.create(
            parent_id=root_cat,
            name='Dairy & Refrigerated',
            slug='dairy',
            default_hsn_code='0401',
            default_tax_slab=Decimal('5.00')
        )
        leaf_cat = Category.objects.create(
            parent_id=child_cat,
            name='Fresh Milk',
            slug='fresh-milk',
            default_hsn_code='0401',
            default_tax_slab=Decimal('0.00')
        )

        self.assertEqual(str(root_cat), 'Food & Beverages')
        self.assertEqual(str(child_cat), 'Food & Beverages > Dairy & Refrigerated')
        self.assertEqual(str(leaf_cat), 'Dairy & Refrigerated > Fresh Milk')
        self.assertEqual(list(root_cat.subcategories.all()), [child_cat])
        self.assertEqual(list(child_cat.subcategories.all()), [leaf_cat])

    def test_global_category_slug_is_globally_unique(self):
        """Global category slugs must be unique across the platform."""
        Category.objects.create(name='Beverages', slug='beverages')

        with self.assertRaises(IntegrityError), transaction.atomic():
            Category.objects.create(name='Beverages Duplicate', slug='beverages')

    def test_organization_category_adoption(self):
        """Organization opts into specific categories they operate in."""
        cat_groceries = Category.objects.create(name='Groceries', slug='groceries')
        cat_appliances = Category.objects.create(name='Appliances', slug='appliances')
        cat_garments = Category.objects.create(name='Garments', slug='garments')

        # Org 1 adopts Groceries and Appliances, but NOT Garments
        OrganizationCategory.objects.create(organization_id=self.org_1, category_id=cat_groceries)
        OrganizationCategory.objects.create(organization_id=self.org_1, category_id=cat_appliances)

        # Duplicate adoption raises IntegrityError
        with self.assertRaises(IntegrityError), transaction.atomic():
            OrganizationCategory.objects.create(organization_id=self.org_1, category_id=cat_groceries)

        # Org 2 can adopt any category independently
        OrganizationCategory.objects.create(organization_id=self.org_2, category_id=cat_groceries)

        self.assertEqual(self.org_1.org_categories.count(), 2)
        self.assertEqual(self.org_2.org_categories.count(), 1)
        self.assertIn(cat_groceries, [oc.category_id for oc in self.org_1.org_categories.all()])
        self.assertIn(cat_appliances, [oc.category_id for oc in self.org_1.org_categories.all()])
        self.assertNotIn(cat_garments, [oc.category_id for oc in self.org_1.org_categories.all()])

    def test_store_category_mapping_and_overlap(self):
        """
        Stores map to single or multiple overlapping categories:
        - Store 1 operates 1 category (Groceries)
        - Store 2 operates 1 category (Appliances)
        - Store 3 operates overlapping categories (Groceries + Appliances + Garments)
        """
        cat_groceries = Category.objects.create(name='Groceries', slug='groceries-store')
        cat_appliances = Category.objects.create(name='Appliances', slug='appliances-store')
        cat_garments = Category.objects.create(name='Garments', slug='garments-store')

        # Store 1: Grocery only
        StoreCategory.objects.create(store_id=self.store_grocery, category_id=cat_groceries)

        # Store 2: Appliances only
        StoreCategory.objects.create(store_id=self.store_appliance, category_id=cat_appliances)

        # Store 3: Overlapping hypermarket (Groceries + Appliances + Garments)
        StoreCategory.objects.create(store_id=self.store_hyper, category_id=cat_groceries)
        StoreCategory.objects.create(store_id=self.store_hyper, category_id=cat_appliances)
        StoreCategory.objects.create(store_id=self.store_hyper, category_id=cat_garments)

        # Duplicate store-category mapping is prevented
        with self.assertRaises(IntegrityError), transaction.atomic():
            StoreCategory.objects.create(store_id=self.store_grocery, category_id=cat_groceries)

        self.assertEqual(self.store_grocery.store_categories.count(), 1)
        self.assertEqual(self.store_appliance.store_categories.count(), 1)
        self.assertEqual(self.store_hyper.store_categories.count(), 3)

    def test_brand_unique_per_organization(self):
        """Brands must have unique names within an organization, but can repeat across orgs."""
        Brand.objects.create(organization_id=self.org_1, name='Amul')

        with self.assertRaises(IntegrityError), transaction.atomic():
            Brand.objects.create(organization_id=self.org_1, name='Amul')

        brand_org_2 = Brand.objects.create(organization_id=self.org_2, name='Amul')
        self.assertEqual(brand_org_2.organization_id, self.org_2)

    def test_product_enriched_fields_and_dual_barcodes(self):
        """Test product creation with category, brand, cost, tax slab, uom, and dual barcodes."""
        category = Category.objects.create(name='Dairy Products', slug='dairy-products', default_tax_slab=Decimal('5.00'))
        brand = Brand.objects.create(organization_id=self.org_1, name='Amul')

        product = Product.objects.create(
            organization_id=self.org_1,
            category_id=category,
            brand_id=brand,
            name='Amul Taaza Toned Milk 1L',
            sku='SKU-AMUL-001',
            barcode='8901262010053',  # Global EAN-13
            internal_barcode='SC-10029384',  # In-store generated sticker
            hsn_code='0401',
            tax_slab=Decimal('5.00'),
            cost_price=Decimal('52.00'),
            base_mrp=Decimal('66.00'),
            uom=UnitOfMeasure.LITRE,
            is_perishable=True,
            has_expiry=True,
            low_stock_threshold=15
        )

        self.assertEqual(product.name, 'Amul Taaza Toned Milk 1L')
        self.assertEqual(product.tax_slab, Decimal('5.00'))
        self.assertEqual(product.uom, UnitOfMeasure.LITRE)
        self.assertEqual(product.category_id, category)
        self.assertEqual(product.brand_id, brand)
        self.assertTrue(product.is_perishable)

    def test_dual_barcode_uniqueness_constraints(self):
        """Test partial unique constraints for global manufacturer barcode and internal sticker."""
        Product.objects.create(
            organization_id=self.org_1,
            name='Product 1',
            sku='SKU-1',
            barcode='8901234567890',
            internal_barcode='SC-001'
        )

        # 1. Duplicate global manufacturer barcode within same org fails
        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.create(
                organization_id=self.org_1,
                name='Product 2',
                sku='SKU-2',
                barcode='8901234567890'
            )

        # 2. Duplicate internal barcode within same org fails
        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.create(
                organization_id=self.org_1,
                name='Product 3',
                sku='SKU-3',
                internal_barcode='SC-001'
            )

        # 3. Same global barcode in a DIFFERENT organization succeeds
        prod_org_2 = Product.objects.create(
            organization_id=self.org_2,
            name='Product 1 in Org 2',
            sku='SKU-1',
            barcode='8901234567890',
            internal_barcode='SC-001'
        )
        self.assertEqual(prod_org_2.organization_id, self.org_2)

    def test_blank_barcodes_do_not_collide(self):
        """Products without barcodes (blank/None) should not trigger uniqueness violations."""
        p1 = Product.objects.create(
            organization_id=self.org_1,
            name='Loose Apples 1kg',
            sku='SKU-APPLE-1',
            barcode=None,
            internal_barcode=None
        )
        p2 = Product.objects.create(
            organization_id=self.org_1,
            name='Loose Oranges 1kg',
            sku='SKU-ORANGE-1',
            barcode=None,
            internal_barcode=None
        )
        self.assertIsNotNone(p1.id)
        self.assertIsNotNone(p2.id)

    def test_soft_delete_preserves_audit_trail(self):
        """Soft deleting a product sets is_deleted flag and timestamp."""
        p = Product.objects.create(
            organization_id=self.org_1,
            name='Test Item',
            sku='SKU-TEST'
        )
        p.soft_delete()
        p.refresh_from_db()
        self.assertTrue(p.is_deleted)
        self.assertIsNotNone(p.deleted_at)
