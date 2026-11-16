from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from db.models import Organization, OrganizationStaff, Store, StoreStaff, User


class StaffManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = 'StrongP@ssw0rd123!'

        # Organization A
        self.org_a = Organization.objects.create(name='Org Alpha', subdomain='alpha')
        self.store_a1 = Store.objects.create(organization_id=self.org_a, name='Store Alpha 1', is_active=True)
        self.store_a2 = Store.objects.create(organization_id=self.org_a, name='Store Alpha 2', is_active=True)

        # Org Admin for Org A
        self.admin_a = User.objects.create_user(
            email='admin@alpha.com',
            password=self.password,
            first_name='Alpha',
            last_name='Admin',
            is_active=True,
        )
        self.admin_a_staff = OrganizationStaff.objects.create(
            user_id=self.admin_a,
            organization_id=self.org_a,
            role='ORG_ADMIN',
            is_active=True,
        )

        # Cashier for Org A Store 1
        self.cashier_a = User.objects.create_user(
            email='cashier@alpha.com',
            password=self.password,
            first_name='Bob',
            last_name='Cashier',
            is_active=True,
        )
        self.cashier_a_staff = StoreStaff.objects.create(
            user_id=self.cashier_a,
            store_id=self.store_a1,
            role='CASHIER',
            is_active=True,
        )

        # Organization B (Tenant Isolation verification)
        self.org_b = Organization.objects.create(name='Org Beta', subdomain='beta')
        self.store_b = Store.objects.create(organization_id=self.org_b, name='Store Beta', is_active=True)
        self.admin_b = User.objects.create_user(
            email='admin@beta.com',
            password=self.password,
            first_name='Beta',
            last_name='Admin',
            is_active=True,
        )
        OrganizationStaff.objects.create(
            user_id=self.admin_b,
            organization_id=self.org_b,
            role='ORG_ADMIN',
            is_active=True,
        )

        self.list_url = reverse('staff_list')
        self.onboard_url = reverse('staff_onboard')
        self.check_email_url = reverse('staff_check_email')

    def test_non_org_admin_forbidden(self):
        # Authenticate as cashier
        self.client.force_authenticate(user=self.cashier_a)
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res_onboard = self.client.post(self.onboard_url, {
            'email': 'newbie@alpha.com',
            'first_name': 'New',
            'password': 'Password123!',
            'scope': 'store',
            'store_id': str(self.store_a1.id),
            'role': 'CASHIER'
        })
        self.assertEqual(res_onboard.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_staff_scoping_and_tenancy(self):
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data['results']
        emails = [item['user']['email'] for item in results]
        self.assertIn('admin@alpha.com', emails)
        self.assertIn('cashier@alpha.com', emails)
        self.assertNotIn('admin@beta.com', emails)

    def test_filter_staff_by_store_and_org(self):
        self.client.force_authenticate(user=self.admin_a)

        # Filter by store_a1
        res = self.client.get(f"{self.list_url}?store_id={self.store_a1.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['user']['email'], 'cashier@alpha.com')
        self.assertEqual(results[0]['store']['id'], str(self.store_a1.id))

        # Filter by org only
        res_org = self.client.get(f"{self.list_url}?store_id=org")
        self.assertEqual(res_org.status_code, status.HTTP_200_OK)
        results_org = res_org.data['results']
        self.assertEqual(len(results_org), 1)
        self.assertEqual(results_org[0]['user']['email'], 'admin@alpha.com')
        self.assertIsNone(results_org[0]['store'])

    def test_onboard_new_store_staff(self):
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post(self.onboard_url, {
            'email': 'alice.manager@alpha.com',
            'first_name': 'Alice',
            'last_name': 'Wonder',
            'password': 'SecureP@ssword123',
            'scope': 'store',
            'store_id': str(self.store_a2.id),
            'role': 'MANAGER',
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['user']['email'], 'alice.manager@alpha.com')
        self.assertEqual(res.data['role'], 'MANAGER')
        self.assertEqual(res.data['store']['id'], str(self.store_a2.id))

        user = User.objects.get(email='alice.manager@alpha.com')
        self.assertTrue(user.check_password('SecureP@ssword123'))
        self.assertTrue(user.must_change_password)

    def test_onboard_new_org_staff(self):
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post(self.onboard_url, {
            'email': 'catalog@alpha.com',
            'first_name': 'Charlie',
            'last_name': 'Catalog',
            'password': 'CatalogP@ss123!',
            'scope': 'organization',
            'role': 'CATALOG_MANAGER',
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['role'], 'CATALOG_MANAGER')
        self.assertIsNone(res.data['store'])

        org_staff = OrganizationStaff.objects.get(user_id__email='catalog@alpha.com')
        self.assertEqual(org_staff.organization_id, self.org_a)
        self.assertEqual(org_staff.role, 'CATALOG_MANAGER')

    def test_onboard_user_other_org_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        # Attempt to onboard user who is in Org B
        res = self.client.post(self.onboard_url, {
            'email': 'admin@beta.com',
            'first_name': 'Fake',
            'password': 'Password123!',
            'scope': 'store',
            'store_id': str(self.store_a1.id),
            'role': 'CASHIER',
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', res.data)
        self.assertIn('another organization', str(res.data['email']))

    def test_onboard_same_org_conflict_and_reassignment(self):
        self.client.force_authenticate(user=self.admin_a)

        # 1. Without reassign_if_exists -> returns 409 Conflict with requires_confirmation
        res = self.client.post(self.onboard_url, {
            'email': 'cashier@alpha.com',
            'first_name': 'Bob',
            'scope': 'store',
            'store_id': str(self.store_a2.id),
            'role': 'MANAGER',
            'reassign_if_exists': False,
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(res.data['requires_confirmation'])
        self.assertEqual(res.data['action'], 'reassign')

        # 2. With reassign_if_exists=True -> successfully reassigns
        res_reassign = self.client.post(self.onboard_url, {
            'email': 'cashier@alpha.com',
            'first_name': 'Bob',
            'scope': 'store',
            'store_id': str(self.store_a2.id),
            'role': 'MANAGER',
            'reassign_if_exists': True,
        }, format='json')

        self.assertEqual(res_reassign.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_reassign.data['role'], 'MANAGER')
        self.assertEqual(res_reassign.data['store']['id'], str(self.store_a2.id))

        # Enforce worker cannot belong to multiple stores: store_a1 assignment should now be deleted/inactive
        old_staff = StoreStaff.objects.get(id=self.cashier_a_staff.id)
        self.assertTrue(old_staff.is_deleted)
        self.assertFalse(old_staff.is_active)

    def test_onboard_deactivated_requires_confirmation_reactivate(self):
        self.client.force_authenticate(user=self.admin_a)

        # Deactivate cashier
        self.cashier_a.is_active = False
        self.cashier_a.save()
        self.cashier_a_staff.is_active = False
        self.cashier_a_staff.save()

        # Attempt onboard without reactivate flag
        res = self.client.post(self.onboard_url, {
            'email': 'cashier@alpha.com',
            'first_name': 'Bob',
            'scope': 'store',
            'store_id': str(self.store_a1.id),
            'role': 'CASHIER',
            'reactivate_if_deactivated': False,
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(res.data['requires_confirmation'])
        self.assertEqual(res.data['action'], 'reactivate')

        # Now confirm reactivation
        res_reactivate = self.client.post(self.onboard_url, {
            'email': 'cashier@alpha.com',
            'first_name': 'Bob',
            'scope': 'store',
            'store_id': str(self.store_a1.id),
            'role': 'CASHIER',
            'reactivate_if_deactivated': True,
        }, format='json')

        self.assertEqual(res_reactivate.status_code, status.HTTP_201_CREATED)
        self.cashier_a.refresh_from_db()
        self.assertTrue(self.cashier_a.is_active)

    def test_check_email_endpoint(self):
        self.client.force_authenticate(user=self.admin_a)

        # New email
        res_new = self.client.get(f"{self.check_email_url}?email=brandnew@alpha.com")
        self.assertEqual(res_new.status_code, status.HTTP_200_OK)
        self.assertEqual(res_new.data['status'], 'new')

        # Same org email
        res_same = self.client.get(f"{self.check_email_url}?email=cashier@alpha.com")
        self.assertEqual(res_same.status_code, status.HTTP_200_OK)
        self.assertEqual(res_same.data['status'], 'same_org')
        self.assertEqual(res_same.data['current_role'], 'CASHIER')

        # Other org email
        res_other = self.client.get(f"{self.check_email_url}?email=admin@beta.com")
        self.assertEqual(res_other.status_code, status.HTTP_200_OK)
        self.assertEqual(res_other.data['status'], 'other_org')

    def test_patch_staff_role_store_and_status(self):
        self.client.force_authenticate(user=self.admin_a)
        detail_url = reverse('staff_detail', kwargs={'staff_id': self.cashier_a_staff.id})

        # Promote to Manager and move to Store A2
        res = self.client.patch(detail_url, {
            'role': 'MANAGER',
            'store_id': str(self.store_a2.id),
            'is_active': True,
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], 'MANAGER')
        self.assertEqual(res.data['store']['id'], str(self.store_a2.id))

    def test_cannot_deactivate_or_remove_only_org_admin(self):
        self.client.force_authenticate(user=self.admin_a)
        admin_detail_url = reverse('staff_detail', kwargs={'staff_id': self.admin_a_staff.id})

        # Cannot downgrade role
        res_role = self.client.patch(admin_detail_url, {'role': 'AUDITOR'}, format='json')
        self.assertEqual(res_role.status_code, status.HTTP_400_BAD_REQUEST)

        # Cannot deactivate
        res_deactivate = self.client.patch(admin_detail_url, {'is_active': False}, format='json')
        self.assertEqual(res_deactivate.status_code, status.HTTP_400_BAD_REQUEST)

        # Cannot delete
        res_delete = self.client.delete(admin_detail_url)
        self.assertEqual(res_delete.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_staff_soft_deletes_and_deactivates_user(self):
        self.client.force_authenticate(user=self.admin_a)
        cashier_detail_url = reverse('staff_detail', kwargs={'staff_id': self.cashier_a_staff.id})

        res = self.client.delete(cashier_detail_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.cashier_a_staff.refresh_from_db()
        self.assertTrue(self.cashier_a_staff.is_deleted)
        self.assertFalse(self.cashier_a_staff.is_active)

        self.cashier_a.refresh_from_db()
        self.assertFalse(self.cashier_a.is_active)
