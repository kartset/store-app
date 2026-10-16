from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Brand,
    CatalogueItem,
    Category,
    Organization,
    OrganizationCategory,
    OrganizationStaff,
    Product,
    Store,
    StoreCategory,
    StoreStaff,
    Subcategory,
    UnitOfMeasure,
    User,
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

    def test_organization_staff_roles_and_uniqueness(self):
        """Test OrganizationStaff creation, roles, and uniqueness per (user, organization)."""
        u1 = User.objects.create_user(email='orgadmin@supermart.com', password='password123')
        org_staff = OrganizationStaff.objects.create(
            user_id=u1,
            organization_id=self.org_1,
            role='ORG_ADMIN',
            is_active=True
        )
        self.assertEqual(org_staff.role, 'ORG_ADMIN')
        self.assertTrue(org_staff.is_active)
        self.assertIn('orgadmin@supermart.com', str(org_staff))
        self.assertIn('Supermart Org', str(org_staff))

        # Duplicate membership in the same organization raises IntegrityError
        with self.assertRaises(IntegrityError), transaction.atomic():
            OrganizationStaff.objects.create(
                user_id=u1,
                organization_id=self.org_1,
                role='CATALOG_MANAGER'
            )

        # Same user can be staff/admin in a different organization
        staff_org_2 = OrganizationStaff.objects.create(
            user_id=u1,
            organization_id=self.org_2,
            role='AUDITOR'
        )
        self.assertEqual(staff_org_2.organization_id, self.org_2)

    def test_organization_subcategory_hierarchy_and_uniqueness(self):
        """Test Subcategory model creation, scoping by (organization, category), and uniqueness."""
        cat_clothes = Category.objects.create(name='Clothes', slug='clothes')
        cat_electronics = Category.objects.create(name='Electronics', slug='electronics')

        # Org 1 defines subcategories under Clothes
        sub_bottoms = Subcategory.objects.create(
            organization_id=self.org_1,
            category_id=cat_clothes,
            name='Bottomwear',
            slug='bottomwear'
        )
        sub_tops = Subcategory.objects.create(
            organization_id=self.org_1,
            category_id=cat_clothes,
            name='Topwear',
            slug='topwear'
        )
        self.assertEqual(str(sub_bottoms), 'Clothes > Bottomwear (Supermart Org)')
        self.assertEqual(sub_tops.slug, 'topwear')

        # Duplicate subcategory name under the same org and category raises IntegrityError
        with self.assertRaises(IntegrityError), transaction.atomic():
            Subcategory.objects.create(
                organization_id=self.org_1,
                category_id=cat_clothes,
                name='Bottomwear'
            )

        # Org 2 can use the same subcategory name under the same platform category independently
        sub_org2 = Subcategory.objects.create(
            organization_id=self.org_2,
            category_id=cat_clothes,
            name='Bottomwear'
        )
        self.assertEqual(sub_org2.organization_id, self.org_2)

        # Same org can define the same subcategory name under a DIFFERENT category
        sub_diff_cat = Subcategory.objects.create(
            organization_id=self.org_1,
            category_id=cat_electronics,
            name='Bottomwear'
        )
        self.assertEqual(sub_diff_cat.category_id, cat_electronics)

    def test_product_subcategory_linkage_and_set_null_on_delete(self):
        """Products can be tagged with an org subcategory; deleting subcategory sets field to NULL."""
        cat_clothes = Category.objects.create(name='Fashion', slug='fashion')
        sub_jeans = Subcategory.objects.create(
            organization_id=self.org_1,
            category_id=cat_clothes,
            name='Jeans',
            slug='jeans'
        )

        prod = Product.objects.create(
            organization_id=self.org_1,
            category_id=cat_clothes,
            subcategory_id=sub_jeans,
            name='Slim Fit Denim 32',
            sku='SKU-JEANS-01',
            barcode='8901122334455',
            base_mrp=Decimal('1499.00')
        )
        self.assertEqual(prod.subcategory_id, sub_jeans)
        self.assertIn(prod, sub_jeans.products.all())

        # Subcategory deletion sets subcategory_id to NULL without deleting the product
        sub_jeans.delete()
        prod.refresh_from_db()
        self.assertIsNone(prod.subcategory_id)
        self.assertEqual(prod.name, 'Slim Fit Denim 32')


class MasterCatalogAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='catalogadmin@example.com', password='password123')
        self.client.force_authenticate(user=self.user)

        self.org_1 = Organization.objects.create(name='Fresh Market', subdomain='fresh')
        self.org_2 = Organization.objects.create(name='Global Grocers', subdomain='grocers')

        self.store = Store.objects.create(organization_id=self.org_1, name='Downtown Mart', is_active=True)

        self.cat_root = Category.objects.create(
            name='Groceries',
            slug='groceries-api',
            default_hsn_code='1001',
            default_tax_slab=Decimal('5.00')
        )
        self.cat_child = Category.objects.create(
            parent_id=self.cat_root,
            name='Beverages',
            slug='beverages-api',
            default_hsn_code='2202',
            default_tax_slab=Decimal('12.00')
        )
        self.brand_amul = Brand.objects.create(organization_id=self.org_1, name='Amul')

        # Grant self.user ORG_ADMIN role in org_1
        self.org_staff = OrganizationStaff.objects.create(
            user_id=self.user,
            organization_id=self.org_1,
            role='ORG_ADMIN',
            is_active=True,
        )

    def test_category_api_list_and_filters(self):
        # 1. List all categories
        response = self.client.get('/api/products/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)

        # 2. Filter root categories
        response_root = self.client.get('/api/products/categories/?parent=null')
        self.assertEqual(response_root.status_code, status.HTTP_200_OK)
        root_ids = [c['id'] for c in response_root.data]
        self.assertIn(str(self.cat_root.id), root_ids)
        self.assertNotIn(str(self.cat_child.id), root_ids)

        # 3. Filter children by parent
        response_child = self.client.get(f'/api/products/categories/?parent={self.cat_root.id}')
        self.assertEqual(response_child.status_code, status.HTTP_200_OK)
        child_ids = [c['id'] for c in response_child.data]
        self.assertIn(str(self.cat_child.id), child_ids)

        # 4. Search categories
        response_search = self.client.get('/api/products/categories/?search=Beverages')
        self.assertEqual(response_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_search.data), 1)
        self.assertEqual(response_search.data[0]['name'], 'Beverages')

    def test_category_tree_endpoint(self):
        response = self.client.get('/api/products/categories/tree/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        root = next((c for c in response.data if c['id'] == str(self.cat_root.id)), None)
        self.assertIsNotNone(root)
        self.assertEqual(len(root['subcategories']), 1)
        self.assertEqual(root['subcategories'][0]['id'], str(self.cat_child.id))

    def test_category_crud(self):
        # Create category
        payload = {
            'name': 'Personal Care',
            'slug': 'personal-care',
            'default_hsn_code': '3304',
            'default_tax_slab': '18.00',
        }
        create_resp = self.client.post('/api/products/categories/', payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        cat_id = create_resp.data['id']

        # Delete category (soft delete)
        del_resp = self.client.delete(f'/api/products/categories/{cat_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=cat_id, is_deleted=False).exists())

    def test_organization_category_bulk_adopt(self):
        cat_snack = Category.objects.create(name='Snacks', slug='snacks-bulk')
        payload = {
            'organization_id': str(self.org_1.id),
            'category_ids': [str(self.cat_root.id), str(cat_snack.id)],
        }
        response = self.client.post('/api/products/organization-categories/bulk-adopt/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 2)

        # Query adopted categories
        get_resp = self.client.get(f'/api/products/organization-categories/?organization_id={self.org_1.id}')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(get_resp.data), 2)

    def test_store_category_bulk_map(self):
        payload = {
            'store_id': str(self.store.id),
            'category_ids': [str(self.cat_root.id)],
        }
        response = self.client.post('/api/products/store-categories/bulk-map/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 1)

        # Query mapped categories
        get_resp = self.client.get(f'/api/products/store-categories/?store_id={self.store.id}')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(get_resp.data), 1)

    def test_brand_api_crud_and_duplicate_validation(self):
        # Create Brand
        payload = {
            'organization_id': str(self.org_1.id),
            'name': 'Nestle',
            'slug': 'nestle',
        }
        create_resp = self.client.post('/api/products/brands/', payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)

        # Duplicate brand name within same org fails validation with 400
        dup_resp = self.client.post('/api/products/brands/', payload, format='json')
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('non_field_errors' in dup_resp.data or 'name' in dup_resp.data)

        # Filter brands by org and search
        search_resp = self.client.get(f'/api/products/brands/?organization_id={self.org_1.id}&search=nestle')
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(search_resp.data), 1)

    def test_product_api_create_and_validation(self):
        payload = {
            'organization_id': str(self.org_1.id),
            'category_id': str(self.cat_child.id),
            'brand_id': str(self.brand_amul.id),
            'name': 'Amul Butter 500g',
            'sku': 'SKU-AMUL-BUTTER-500',
            'barcode': '8901262010099',
            'internal_barcode': 'SC-554433',
            'cost_price': '220.00',
            'base_mrp': '275.00',
            'tax_slab': '12.00',
            'uom': 'G',
            'is_perishable': True,
        }
        response = self.client.post('/api/products/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['sku'], 'SKU-AMUL-BUTTER-500')
        self.assertEqual(response.data['category']['name'], 'Beverages')
        self.assertEqual(response.data['brand']['name'], 'Amul')

        # 1. Duplicate SKU check returns 400
        dup_sku_payload = {**payload, 'name': 'Butter Variant', 'barcode': '8901262010000', 'internal_barcode': 'SC-0000'}
        sku_resp = self.client.post('/api/products/', dup_sku_payload, format='json')
        self.assertEqual(sku_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('non_field_errors' in sku_resp.data or 'sku' in sku_resp.data)

        # 2. Duplicate barcode check returns 400
        dup_bar_payload = {**payload, 'sku': 'SKU-NEW-1', 'internal_barcode': 'SC-1111'}
        bar_resp = self.client.post('/api/products/', dup_bar_payload, format='json')
        self.assertEqual(bar_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('non_field_errors' in bar_resp.data or 'barcode' in bar_resp.data)

        # 3. Duplicate internal_barcode check returns 400
        dup_int_payload = {**payload, 'sku': 'SKU-NEW-2', 'barcode': '8901262010088'}
        int_resp = self.client.post('/api/products/', dup_int_payload, format='json')
        self.assertEqual(int_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('non_field_errors' in int_resp.data or 'internal_barcode' in int_resp.data)

    def test_product_api_filters_and_search(self):
        p1 = Product.objects.create(
            organization_id=self.org_1,
            category_id=self.cat_child,
            brand_id=self.brand_amul,
            name='Amul Lassi 250ml',
            sku='SKU-LASSI-250',
            barcode='8901262010111',
            internal_barcode='SC-998877',
            cost_price=Decimal('20.00'),
            base_mrp=Decimal('25.00'),
            is_active=True
        )
        Product.objects.create(
            organization_id=self.org_1,
            name='Organic Tomatoes 1kg',
            sku='SKU-TOMATO-1KG',
            barcode='8901262010222',
            internal_barcode='SC-998866',
            cost_price=Decimal('30.00'),
            base_mrp=Decimal('40.00'),
            is_active=False
        )

        # Filter by org
        resp_org = self.client.get(f'/api/products/?organization_id={self.org_1.id}')
        self.assertEqual(resp_org.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_org.data), 2)

        # Filter by category
        resp_cat = self.client.get(f'/api/products/?category_id={self.cat_child.id}')
        self.assertEqual(resp_cat.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_cat.data), 1)
        self.assertEqual(resp_cat.data[0]['id'], str(p1.id))

        # Filter by active
        resp_active = self.client.get('/api/products/?is_active=true')
        self.assertEqual(resp_active.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_active.data), 1)
        self.assertEqual(resp_active.data[0]['id'], str(p1.id))

        # Search by barcode
        resp_search = self.client.get('/api/products/?search=SC-998877')
        self.assertEqual(resp_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_search.data), 1)
        self.assertEqual(resp_search.data[0]['id'], str(p1.id))

    def test_barcode_lookup_view_speed_and_resolution(self):
        p = Product.objects.create(
            organization_id=self.org_1,
            category_id=self.cat_child,
            brand_id=self.brand_amul,
            name='Amul Taaza Milk 500ml',
            sku='SKU-MILK-500',
            barcode='8901262010555',
            internal_barcode='SC-SCAN-555',
            hsn_code='0401',
            tax_slab=Decimal('5.00'),
            cost_price=Decimal('28.00'),
            base_mrp=Decimal('33.00'),
            uom=UnitOfMeasure.ML,
            is_active=True
        )

        # 1. Resolve by Global Manufacturer Barcode
        resp_bar = self.client.get(f'/api/products/barcode/8901262010555/?organization_id={self.org_1.id}')
        self.assertEqual(resp_bar.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_bar.data['id'], str(p.id))
        self.assertEqual(resp_bar.data['name'], 'Amul Taaza Milk 500ml')
        self.assertEqual(resp_bar.data['base_mrp'], '33.00')

        # 2. Resolve by Internal Sticker Barcode
        resp_int = self.client.get(f'/api/products/barcode/SC-SCAN-555/?organization_id={self.org_1.id}')
        self.assertEqual(resp_int.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_int.data['id'], str(p.id))

        # 3. Resolve by Item SKU (case-insensitive)
        resp_sku = self.client.get(f'/api/products/barcode/sku-milk-500/?organization_id={self.org_1.id}')
        self.assertEqual(resp_sku.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_sku.data['id'], str(p.id))

        # 4. Unknown code returns 404
        resp_404 = self.client.get(f'/api/products/barcode/NONEXISTENT-CODE/?organization_id={self.org_1.id}')
        self.assertEqual(resp_404.status_code, status.HTTP_404_NOT_FOUND)

    def test_store_staff_cannot_create_update_or_delete_products_or_subcategories(self):
        """
        Store staff (e.g. Cashier) cannot add, edit, or delete products or subcategories (403 Forbidden).
        They can only read catalog items and barcode lookups.
        """
        cashier = User.objects.create_user(email='cashier1@fresh.com', password='password123')
        StoreStaff.objects.create(
            user_id=cashier,
            store_id=self.store,
            role='CASHIER',
        )

        cashier_client = APIClient()
        cashier_client.force_authenticate(user=cashier)

        # 1. Store Staff CAN read products
        read_resp = cashier_client.get(f'/api/products/?organization_id={self.org_1.id}')
        self.assertEqual(read_resp.status_code, status.HTTP_200_OK)

        # 2. Store Staff CAN read subcategories
        sub_read_resp = cashier_client.get(f'/api/products/subcategories/?organization_id={self.org_1.id}')
        self.assertEqual(sub_read_resp.status_code, status.HTTP_200_OK)

        # 3. Store Staff CAN lookup barcodes
        p = Product.objects.create(
            organization_id=self.org_1,
            name='Test Biscuit',
            sku='SKU-BISC-01',
            barcode='8901239999999',
            base_mrp=Decimal('10.00'),
        )
        bar_resp = cashier_client.get(f'/api/products/barcode/8901239999999/?organization_id={self.org_1.id}')
        self.assertEqual(bar_resp.status_code, status.HTTP_200_OK)

        # 4. Store Staff CANNOT create product (403 Forbidden)
        create_prod_resp = cashier_client.post(
            '/api/products/',
            {
                'organization_id': str(self.org_1.id),
                'name': 'Unauthorized Product',
                'sku': 'SKU-UNAUTH-01',
                'base_mrp': '99.00',
            },
            format='json',
        )
        self.assertEqual(create_prod_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Only Organization Admins can create', str(create_prod_resp.data))

        # 5. Store Staff CANNOT edit product (403 Forbidden)
        edit_prod_resp = cashier_client.patch(
            f'/api/products/{p.id}/',
            {'name': 'Modified By Cashier'},
            format='json',
        )
        self.assertEqual(edit_prod_resp.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Store Staff CANNOT delete product (403 Forbidden)
        del_prod_resp = cashier_client.delete(f'/api/products/{p.id}/')
        self.assertEqual(del_prod_resp.status_code, status.HTTP_403_FORBIDDEN)

        # 7. Store Staff CANNOT create subcategories (403 Forbidden)
        sub_create_resp = cashier_client.post(
            '/api/products/subcategories/',
            {
                'organization_id': str(self.org_1.id),
                'category_id': str(self.cat_child.id),
                'name': 'Forbidden Subcategory',
            },
            format='json',
        )
        self.assertEqual(sub_create_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_subcategory_api_crud_and_validation(self):
        """Org Admin can create, list, filter, update, and soft delete subcategories."""
        # 1. Create subcategory under Beverages
        create_payload = {
            'organization_id': str(self.org_1.id),
            'category_id': str(self.cat_child.id),
            'name': 'Fruit Juices',
            'slug': 'fruit-juices',
            'description': 'Packaged fresh juices',
            'display_order': 1,
        }
        resp = self.client.post('/api/products/subcategories/', create_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        sub_id = resp.data['id']
        self.assertEqual(resp.data['name'], 'Fruit Juices')
        self.assertEqual(resp.data['category']['name'], 'Beverages')

        # 2. Duplicate subcategory in same org and category fails with 400
        dup_resp = self.client.post('/api/products/subcategories/', create_payload, format='json')
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('non_field_errors' in dup_resp.data or 'name' in dup_resp.data)

        # 3. Filter by category
        filter_resp = self.client.get(
            f'/api/products/subcategories/?organization_id={self.org_1.id}&category_id={self.cat_child.id}'
        )
        self.assertEqual(filter_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filter_resp.data), 1)

        # 4. Update subcategory
        patch_resp = self.client.patch(
            f'/api/products/subcategories/{sub_id}/',
            {'name': '100% Fruit Juices & Nectars'},
            format='json',
        )
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['name'], '100% Fruit Juices & Nectars')

        # 5. Soft delete subcategory
        del_resp = self.client.delete(f'/api/products/subcategories/{sub_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Subcategory.objects.filter(id=sub_id, is_deleted=False).exists())

    def test_product_api_with_subcategory_linkage_and_cross_org_validation(self):
        """Products can link to subcategories; validating cross-org and mismatched category rejections."""
        sub_bev = Subcategory.objects.create(
            organization_id=self.org_1,
            category_id=self.cat_child,
            name='Energy Drinks',
            slug='energy-drinks',
        )

        # 1. Successfully create product with valid subcategory
        prod_payload = {
            'organization_id': str(self.org_1.id),
            'category_id': str(self.cat_child.id),
            'subcategory_id': str(sub_bev.id),
            'brand_id': str(self.brand_amul.id),
            'name': 'Stamina Energy Drink 250ml',
            'sku': 'SKU-ENERGY-250',
            'cost_price': '35.00',
            'base_mrp': '50.00',
            'uom': 'ML',
            'is_active': True,
        }
        res = self.client.post('/api/products/', prod_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['subcategory']['id'], str(sub_bev.id))
        self.assertEqual(res.data['subcategory']['name'], 'Energy Drinks')

        # 2. Reject subcategory belonging to a different category
        cat_snacks = Category.objects.create(name='Snacks', slug='snacks')
        sub_chips = Subcategory.objects.create(
            organization_id=self.org_1,
            category_id=cat_snacks,
            name='Potato Chips',
            slug='chips',
        )
        mismatch_cat_payload = {
            'organization_id': str(self.org_1.id),
            'category_id': str(self.cat_child.id),  # Beverages
            'subcategory_id': str(sub_chips.id),     # Belongs to Snacks
            'name': 'Mismatched Product',
            'sku': 'SKU-MISMATCH-CAT',
            'base_mrp': '20.00',
        }
        mismatch_res = self.client.post('/api/products/', mismatch_cat_payload, format='json')
        self.assertEqual(mismatch_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('subcategory_id', mismatch_res.data)

        # 3. Reject subcategory belonging to a different organization
        sub_other_org = Subcategory.objects.create(
            organization_id=self.org_2,
            category_id=self.cat_child,
            name='Foreign Subcategory',
        )
        foreign_org_payload = {
            'organization_id': str(self.org_1.id),
            'category_id': str(self.cat_child.id),
            'subcategory_id': str(sub_other_org.id),
            'name': 'Foreign Product',
            'sku': 'SKU-FOREIGN-SUB',
            'base_mrp': '40.00',
        }
        foreign_res = self.client.post('/api/products/', foreign_org_payload, format='json')
        self.assertEqual(foreign_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('subcategory_id', foreign_res.data)

    def test_product_auto_links_global_catalogue_by_barcode(self):
        """When a product is created with a manufacturer barcode matching a global catalogue item, it auto-links."""
        cat_item = CatalogueItem.objects.create(
            name='Global Master Soap 100g',
            sku='GLOBAL-SOAP-100G',
            barcode='8901234999888',
            brand_name='Pears',
            category_name='Soaps',
            tax_slab=Decimal('18.00'),
            uom=UnitOfMeasure.PCS,
            suggested_mrp=Decimal('65.00'),
        )

        prod_payload = {
            'organization_id': str(self.org_1.id),
            'name': 'Custom Named Soap 100g',
            'sku': 'SKU-LOCAL-SOAP',
            'barcode': '8901234999888',
            'base_mrp': '60.00',
        }
        res = self.client.post('/api/products/', prod_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['catalogue_item_id'], cat_item.id)

        # Check DB
        product = Product.objects.get(id=res.data['id'])
        self.assertEqual(product.catalogue_item_id, cat_item)


