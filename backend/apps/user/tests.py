from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from db.models import Customer, Organization, OrganizationStaff, Store, StoreStaff, User


class AppLoginStoreGateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse('token_obtain_pair')
        self.password = 'SecurePass123!'

        # Setup standard organization and active store
        self.org = Organization.objects.create(name='Test Org', subdomain='testorg')
        self.store = Store.objects.create(
            organization_id=self.org,
            name='Main Retail Store',
            is_active=True,
        )

        # 1. Staff user associated with active store
        self.staff_user = User.objects.create_user(
            email='cashier@store.com',
            password=self.password,
            first_name='John',
            last_name='Doe',
            is_active=True,
        )
        self.staff_role = StoreStaff.objects.create(
            user_id=self.staff_user,
            store_id=self.store,
            role='CASHIER',
        )

        # 2. Pure Customer user (has db.User and Customer profile, but NO StoreStaff)
        self.customer_user = User.objects.create_user(
            email='shopper@customer.com',
            password=self.password,
            first_name='Alice',
            last_name='Smith',
            is_active=True,
        )
        self.customer = Customer.objects.create(
            user_id=self.customer_user,
            mobile_number='+1234567890',
            name='Alice Smith',
            email=self.customer_user.email,
        )

        # 3. Unassigned user (no staff role, no customer profile)
        self.unassigned_user = User.objects.create_user(
            email='unassigned@example.com',
            password=self.password,
            first_name='Bob',
            last_name='Unassigned',
            is_active=True,
        )

    def test_staff_user_with_active_store_can_login(self):
        """Staff user associated with an active store should log in successfully."""
        response = self.client.post(
            self.login_url,
            {'email': self.staff_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], self.staff_user.email)
        self.assertEqual(len(response.data['user']['stores']), 1)
        self.assertEqual(response.data['user']['stores'][0]['id'], str(self.store.id))
        self.assertEqual(response.data['user']['stores'][0]['role'], 'CASHIER')
        self.assertEqual(response.data['user']['current_store']['id'], str(self.store.id))

    def test_customer_cannot_login(self):
        """A customer with a db.User account must be blocked from logging into the store app."""
        response = self.client.post(
            self.login_url,
            {'email': self.customer_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('User is not associated with any active store', str(response.data))

    def test_unassigned_user_cannot_login(self):
        """A user with no store staff assignment must be blocked from logging in."""
        response = self.client.post(
            self.login_url,
            {'email': self.unassigned_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('User is not associated with any active store', str(response.data))

    def test_inactive_store_blocks_staff_login(self):
        """If the store is inactive, the staff member should not be able to log in."""
        self.store.is_active = False
        self.store.save()

        response = self.client.post(
            self.login_url,
            {'email': self.staff_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('User is not associated with any active store', str(response.data))

    def test_soft_deleted_staff_role_blocks_login(self):
        """If the StoreStaff assignment is soft-deleted, login should be denied."""
        self.staff_role.is_deleted = True
        self.staff_role.save()

        response = self.client.post(
            self.login_url,
            {'email': self.staff_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('User is not associated with any active store', str(response.data))

    def test_soft_deleted_store_blocks_login(self):
        """If the Store is soft-deleted, login should be denied."""
        self.store.is_deleted = True
        self.store.save()

        response = self.client.post(
            self.login_url,
            {'email': self.staff_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('User is not associated with any active store', str(response.data))

    def test_inactive_user_cannot_login(self):
        """An inactive user should be blocked from logging in regardless of store association."""
        self.staff_user.is_active = False
        self.staff_user.save()

        response = self.client.post(
            self.login_url,
            {'email': self.staff_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_password_fails(self):
        """Incorrect password returns 401."""
        response = self.client.post(
            self.login_url,
            {'email': self.staff_user.email, 'password': 'WrongPassword123'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_target_store_id_validation(self):
        """Passing matching store_id succeeds, passing non-associated store_id fails."""
        # Success with matching store
        res_ok = self.client.post(
            self.login_url,
            {
                'email': self.staff_user.email,
                'password': self.password,
                'store_id': str(self.store.id),
            },
            format='json',
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data['user']['current_store']['id'], str(self.store.id))

        # Failure with another unassigned store
        other_store = Store.objects.create(organization_id=self.org, name='Other Store')
        res_fail = self.client.post(
            self.login_url,
            {
                'email': self.staff_user.email,
                'password': self.password,
                'store_id': str(other_store.id),
            },
            format='json',
        )
        self.assertEqual(res_fail.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('User is not associated with the requested store', str(res_fail.data))

    def test_org_admin_without_store_staff_can_login(self):
        """Org Admin without any physical StoreStaff assignment can authenticate successfully."""
        org_admin_user = User.objects.create_user(
            email='hqadmin@testorg.com',
            password=self.password,
            first_name='Executive',
            last_name='Admin',
            is_active=True,
        )
        OrganizationStaff.objects.create(
            user_id=org_admin_user,
            organization_id=self.org,
            role='ORG_ADMIN',
            is_active=True,
        )

        res = self.client.post(
            self.login_url,
            {'email': org_admin_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertTrue(res.data['user']['is_org_admin'])
        self.assertEqual(len(res.data['user']['organizations']), 1)
        self.assertEqual(res.data['user']['organizations'][0]['role'], 'ORG_ADMIN')
        # Org store auto-selected as default store context with ORG_ADMIN role
        self.assertEqual(res.data['user']['current_store']['id'], str(self.store.id))
        self.assertEqual(res.data['user']['current_store']['role'], 'ORG_ADMIN')

    def test_org_admin_can_target_store_in_own_org(self):
        """Org Admin can switch/target any store under their organization."""
        second_store = Store.objects.create(organization_id=self.org, name='Second Store', is_active=True)
        org_admin_user = User.objects.create_user(
            email='hqadmin2@testorg.com',
            password=self.password,
            first_name='Super',
            last_name='Admin',
            is_active=True,
        )
        OrganizationStaff.objects.create(
            user_id=org_admin_user,
            organization_id=self.org,
            role='ORG_ADMIN',
            is_active=True,
        )

        res = self.client.post(
            self.login_url,
            {
                'email': org_admin_user.email,
                'password': self.password,
                'store_id': str(second_store.id),
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['user']['current_store']['id'], str(second_store.id))
        self.assertEqual(res.data['user']['current_store']['role'], 'ORG_ADMIN')

    def test_org_admin_cannot_target_store_in_other_org(self):
        """Org Admin cannot target a store belonging to another organization."""
        other_org = Organization.objects.create(name='Other Org', subdomain='other')
        other_org_store = Store.objects.create(organization_id=other_org, name='Foreign Store', is_active=True)

        org_admin_user = User.objects.create_user(
            email='hqadmin3@testorg.com',
            password=self.password,
            first_name='HQ',
            last_name='User',
            is_active=True,
        )
        OrganizationStaff.objects.create(
            user_id=org_admin_user,
            organization_id=self.org,
            role='ORG_ADMIN',
            is_active=True,
        )

        res = self.client.post(
            self.login_url,
            {
                'email': org_admin_user.email,
                'password': self.password,
                'store_id': str(other_org_store.id),
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('User is not associated with the requested store', str(res.data))


class GoogleAuthAndOnboardingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.google_auth_url = reverse('google_auth')
        self.onboard_url = reverse('onboard_organization')

    def test_google_auth_unregistered_user(self):
        """Unregistered Google user gets registered=False and profile details."""
        res = self.client.post(
            self.google_auth_url,
            {'id_token': 'mock:newowner@retail.com:Jane:Doe'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['registered'])
        self.assertEqual(res.data['email'], 'newowner@retail.com')
        self.assertEqual(res.data['first_name'], 'Jane')
        self.assertEqual(res.data['last_name'], 'Doe')

    def test_organization_onboarding_success(self):
        """New organization owner successfully onboards and receives JWT tokens."""
        res = self.client.post(
            self.onboard_url,
            {
                'id_token': 'mock:founder@apexretail.com:Alex:Rivera',
                'organization_name': 'Apex Retailers',
                'subdomain': 'apex-retail',
                'store_name': 'Apex Flagship Store',
                'store_address': '123 Market St, San Francisco, CA',
                'gst_number': 'GST-APEX-9988',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertIn('user', res.data)
        self.assertEqual(res.data['user']['email'], 'founder@apexretail.com')
        self.assertTrue(res.data['user']['is_org_admin'])

        # Verify DB records
        user = User.objects.get(email='founder@apexretail.com')
        self.assertEqual(user.first_name, 'Alex')
        self.assertEqual(user.last_name, 'Rivera')

        org = Organization.objects.get(subdomain='apex-retail')
        self.assertEqual(org.name, 'Apex Retailers')

        store = Store.objects.get(organization_id=org)
        self.assertEqual(store.name, 'Apex Flagship Store')
        self.assertEqual(store.address, '123 Market St, San Francisco, CA')

        org_staff = OrganizationStaff.objects.get(user_id=user, organization_id=org)
        self.assertEqual(org_staff.role, 'ORG_ADMIN')

        store_staff = StoreStaff.objects.get(user_id=user, store_id=store)
        self.assertEqual(store_staff.role, 'ADMIN')

        # Current store in payload should be this flagship store
        self.assertEqual(res.data['user']['current_store']['id'], str(store.id))
        self.assertEqual(res.data['user']['current_store']['name'], 'Apex Flagship Store')

    def test_onboarding_auto_generates_subdomain_and_handles_collision(self):
        """When subdomain is blank, it auto-slugifies org name and increments on collision."""
        Organization.objects.create(name='Global Shop', subdomain='global-shop')

        res = self.client.post(
            self.onboard_url,
            {
                'id_token': 'mock:owner2@globalshop.com:Sam:Green',
                'organization_name': 'Global Shop',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['organization']['subdomain'], 'global-shop-1')

    def test_onboarding_rejects_duplicate_explicit_subdomain(self):
        """Explicitly provided duplicate subdomain returns 400 validation error."""
        Organization.objects.create(name='Existing Brand', subdomain='unique-slug')

        res = self.client.post(
            self.onboard_url,
            {
                'id_token': 'mock:duplicate@example.com:Dan:Smith',
                'organization_name': 'Another Brand',
                'subdomain': 'unique-slug',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Subdomain 'unique-slug' is already in use", str(res.data))

    def test_google_auth_registered_user_logs_in_directly(self):
        """An already onboarded user signing in with Google receives their full JWT auth payload."""
        # Onboard first
        self.client.post(
            self.onboard_url,
            {
                'id_token': 'mock:existing@brand.com:Elena:Rostova',
                'organization_name': 'Elena Boutique',
                'subdomain': 'elena-boutique',
            },
            format='json',
        )

        # Authenticate with Google
        res = self.client.post(
            self.google_auth_url,
            {'id_token': 'mock:existing@brand.com:Elena:Rostova'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['registered'])
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user']['email'], 'existing@brand.com')
        self.assertTrue(res.data['user']['is_org_admin'])

    def test_onboarding_with_password_allows_subsequent_email_login(self):
        """Owner who provides a password during onboarding can subsequently log in using email/password."""
        owner_email = 'founder.pwd@apex.com'
        owner_pass = 'StrongOwnerP@ss123'

        onboard_res = self.client.post(
            self.onboard_url,
            {
                'id_token': f'mock:{owner_email}:Leo:Vance',
                'organization_name': 'Vance Retail Group',
                'subdomain': 'vance-retail',
                'store_name': 'Vance Central',
                'password': owner_pass,
            },
            format='json',
        )
        self.assertEqual(onboard_res.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email=owner_email)
        self.assertTrue(user.check_password(owner_pass))

        # Test subsequent email + password login to /api/users/auth/login/
        login_url = reverse('token_obtain_pair')
        login_res = self.client.post(
            login_url,
            {
                'email': owner_email,
                'password': owner_pass,
            },
            format='json',
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_res.data)
        self.assertIn('refresh', login_res.data)
        self.assertEqual(login_res.data['user']['email'], owner_email)
        self.assertEqual(login_res.data['user']['current_store']['name'], 'Vance Central')
        self.assertTrue(login_res.data['user']['is_org_admin'])



