from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase

from db.models import Brand, Category, Organization, Product, UnitOfMeasure


class MasterCatalogModelTests(TestCase):
    def setUp(self):
        # Set up two separate organizations to test multi-tenant boundaries
        self.org_1 = Organization.objects.create(name='Supermart Org', subdomain='supermart')
        self.org_2 = Organization.objects.create(name='Metro Retail', subdomain='metro')

    def test_category_tree_hierarchy(self):
        """Test hierarchical category creation with parent-child nesting."""
        root_cat = Category.objects.create(
            organization_id=self.org_1,
            name='Food & Beverages',
            slug='food-beverages'
        )
        child_cat = Category.objects.create(
            organization_id=self.org_1,
            parent_id=root_cat,
            name='Dairy & Refrigerated',
            slug='dairy'
        )
        leaf_cat = Category.objects.create(
            organization_id=self.org_1,
            parent_id=child_cat,
            name='Fresh Milk',
            slug='milk'
        )

        self.assertEqual(str(root_cat), 'Food & Beverages')
        self.assertEqual(str(child_cat), 'Food & Beverages > Dairy & Refrigerated')
        self.assertEqual(str(leaf_cat), 'Dairy & Refrigerated > Fresh Milk')
        self.assertEqual(list(root_cat.subcategories.all()), [child_cat])
        self.assertEqual(list(child_cat.subcategories.all()), [leaf_cat])

    def test_category_slug_unique_per_organization(self):
        """Categories must have unique slugs within an organization, but can repeat across orgs."""
        Category.objects.create(organization_id=self.org_1, name='Beverages', slug='beverages')

        # Duplicate slug in same org must fail
        with self.assertRaises(IntegrityError), transaction.atomic():
            Category.objects.create(organization_id=self.org_1, name='Another Beverages', slug='beverages')

        # Same slug in different org must succeed
        cat_org_2 = Category.objects.create(organization_id=self.org_2, name='Beverages', slug='beverages')
        self.assertEqual(cat_org_2.organization_id, self.org_2)

    def test_brand_unique_per_organization(self):
        """Brands must have unique names within an organization, but can repeat across orgs."""
        Brand.objects.create(organization_id=self.org_1, name='Amul')

        with self.assertRaises(IntegrityError), transaction.atomic():
            Brand.objects.create(organization_id=self.org_1, name='Amul')

        brand_org_2 = Brand.objects.create(organization_id=self.org_2, name='Amul')
        self.assertEqual(brand_org_2.organization_id, self.org_2)

    def test_product_enriched_fields_and_dual_barcodes(self):
        """Test product creation with category, brand, cost, tax slab, uom, and dual barcodes."""
        category = Category.objects.create(organization_id=self.org_1, name='Dairy', slug='dairy')
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
