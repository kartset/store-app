from rest_framework import status
from rest_framework.test import APITestCase

from db.models import Organization, OrganizationStaff, Store, StoreStaff, User


class StoreScopingAndRBACркаTests(APITestCase):
    def setUp(self):
        # Create Organizations
        self.org1 = Organization.objects.create(name="Acme Retail", subdomain="acme")
        self.org2 = Organization.objects.create(name="Globex Corp", subdomain="globex")

        # Create Users
        self.org_admin1 = User.objects.create_user(
            email="admin1@acme.com", password="Password123!", first_name="Admin", last_name="One"
        )
        self.store_staff1 = User.objects.create_user(
            email="staff1@acme.com", password="Password123!", first_name="Staff", last_name="One"
        )
        self.org_admin2 = User.objects.create_user(
            email="admin2@globex.com", password="Password123!", first_name="Admin", last_name="Two"
        )

        # Assign Org Admin roles
        OrganizationStaff.objects.create(
            user_id=self.org_admin1,
            organization_id=self.org1,
            role="ORG_ADMIN",
            is_active=True,
        )
        OrganizationStaff.objects.create(
            user_id=self.org_admin2,
            organization_id=self.org2,
            role="ORG_ADMIN",
            is_active=True,
        )

        # Create Stores
        self.store1_org1 = Store.objects.create(
            organization_id=self.org1,
            name="Acme Flagship",
            gst_number="29ABCDE1234F1Z5",
            address="123 Main St, Bangalore",
        )
        self.store2_org1 = Store.objects.create(
            organization_id=self.org1,
            name="Acme Mall Branch",
            gst_number="29ABCDE1234F1Z6",
            address="456 High St, Bangalore",
        )
        self.store1_org2 = Store.objects.create(
            organization_id=self.org2,
            name="Globex Central",
            gst_number="27ABCDE5678F1Z9",
            address="789 Central Ave, Mumbai",
        )

        # Assign store_staff1 to only store1_org1
        StoreStaff.objects.create(
            user_id=self.store_staff1,
            store_id=self.store1_org1,
            role="CASHIER",
        )

    def test_org_admin_sees_only_own_organization_stores(self):
        """Org Admin 1 must see all stores under Org 1, and zero stores from Org 2."""
        self.client.force_authenticate(user=self.org_admin1)
        res = self.client.get("/api/stores/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        store_ids = [s["id"] for s in res.data]
        self.assertIn(str(self.store1_org1.id), store_ids)
        self.assertIn(str(self.store2_org1.id), store_ids)
        self.assertNotIn(str(self.store1_org2.id), store_ids)
        self.assertEqual(len(store_ids), 2)

    def test_org_admin_create_store_auto_assigns_org(self):
        """Org Admin creating a store without organization_id gets auto-assigned to their org."""
        self.client.force_authenticate(user=self.org_admin1)
        payload = {
            "name": "Acme Express Downtown",
            "gst_number": "29ABCDE1234F1Z7",
            "address": "99 Metro Station, Bangalore",
        }
        res = self.client.post("/api/stores/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Acme Express Downtown")
        self.assertEqual(str(res.data["organization_id"]), str(self.org1.id))

        # Verify in DB
        created_store = Store.objects.get(name="Acme Express Downtown")
        self.assertEqual(created_store.organization_id, self.org1)

    def test_org_admin_cannot_create_store_for_other_org(self):
        """Org Admin 1 cannot create a store for Org 2."""
        self.client.force_authenticate(user=self.org_admin1)
        payload = {
            "name": "Infiltrator Store",
            "organization_id": str(self.org2.id),
        }
        res = self.client.post("/api/stores/", payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_store_staff_sees_only_assigned_store(self):
        """Store staff assigned to store1_org1 sees only store1_org1, not store2_org1."""
        self.client.force_authenticate(user=self.store_staff1)
        res = self.client.get("/api/stores/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        store_ids = [s["id"] for s in res.data]
        self.assertEqual(store_ids, [str(self.store1_org1.id)])

    def test_store_staff_cannot_create_store(self):
        """Store staff must receive 403 Forbidden when attempting to create a store."""
        self.client.force_authenticate(user=self.store_staff1)
        payload = {
            "name": "Unauthorized Store",
        }
        res = self.client.post("/api/stores/", payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_store_staff_cannot_update_or_delete_store(self):
        """Store staff cannot modify or delete store branches."""
        self.client.force_authenticate(user=self.store_staff1)
        res_put = self.client.put(f"/api/stores/{self.store1_org1.id}/", {"name": "Hacked Store"})
        self.assertEqual(res_put.status_code, status.HTTP_403_FORBIDDEN)

        res_del = self.client.delete(f"/api/stores/{self.store1_org1.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)
