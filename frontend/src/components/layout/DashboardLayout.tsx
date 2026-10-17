import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Title,
  Button,
  Box,
  Text,
  Avatar,
  Badge,
  ThemeIcon,
  Stack,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconPackage,
  IconLogout,
  IconSparkles,
  IconCategory,
  IconBuildingWarehouse,
  IconTruckDelivery,
  IconUsers,
  IconReceipt,
  IconCashRegister,
  IconCoins,
  IconShoppingCart,
  IconChartBar,
  IconDatabaseImport,
} from '@tabler/icons-react';

import { useMemo } from 'react';

export function DashboardLayout() {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve authenticated user and active store from localStorage
  const user = useMemo(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const currentStore = useMemo(() => {
    try {
      const stored = localStorage.getItem('current_store');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('current_store');
    navigate('/login');
  };

  const userInitials = useMemo(() => {
    if (!user) return 'ST';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || 'ST';
  }, [user]);

  const isOrgAdmin = useMemo(() => {
    if (!user) return false;
    if (user.is_org_admin || user.role === 'ORG_ADMIN' || user.role === 'SUPER_ADMIN') return true;
    if (currentStore?.role === 'ORG_ADMIN') return true;
    if (user.organizations?.some((org: any) => org.role === 'ORG_ADMIN')) return true;
    return false;
  }, [user, currentStore]);

  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{
        width: 270,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="xl"
      styles={{
        main: {
          backgroundColor: 'var(--bg-page)',
          minHeight: 'calc(100vh - 68px)',
        },
      }}
    >
      {/* Top Header */}
      <AppShell.Header
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
          zIndex: 100,
        }}
      >
        <Group h="100%" px="xl" justify="space-between">
          {/* Brand mark & Mobile Toggle */}
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="xs" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <ThemeIcon
                size={36}
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                }}
              >
                <IconBuildingStore size={20} color="#fff" />
              </ThemeIcon>
              <div>
                <Title order={3} fw={800} style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  Store<span style={{ color: 'var(--brand-primary)' }}>Craft</span>
                </Title>
                <Text size="10px" c="dimmed" fw={600} style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Retail Ops
                </Text>
              </div>
            </Group>
          </Group>

          {/* Active Store Indicator & User Profile */}
          <Group gap="md">
            {/* Enterprise Role Badge */}
            {isOrgAdmin ? (
              <Badge
                variant="gradient"
                gradient={{ from: 'indigo', to: 'violet', deg: 45 }}
                size="md"
                radius="sm"
                style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Org Admin
              </Badge>
            ) : (
              <Badge
                variant="light"
                color="teal"
                size="md"
                radius="sm"
                style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Store Staff
              </Badge>
            )}

            {currentStore && (
              <Badge
                variant="light"
                color="brand"
                size="lg"
                radius="md"
                leftSection={<span className="pulse-dot" />}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Text component="span" fw={700} size="xs" c="var(--brand-primary)">
                  {currentStore.name}
                </Text>
                {currentStore.role && (
                  <Text component="span" size="10px" fw={600} c="dimmed" ml={6}>
                    ({currentStore.role})
                  </Text>
                )}
              </Badge>
            )}

            <Button
              size="xs"
              variant={location.pathname === '/pos' ? 'filled' : 'light'}
              color="brand"
              leftSection={<IconCashRegister size={15} />}
              onClick={() => navigate('/pos')}
              style={{ fontWeight: 700 }}
            >
              Counter POS
            </Button>

            {/* User Profile Pill */}
            <Group gap="xs" style={{ paddingLeft: '8px', borderLeft: '1px solid var(--border-subtle)' }}>
              <Avatar
                radius="xl"
                size={34}
                color="brand"
                style={{
                  fontWeight: 700,
                  fontSize: '12px',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                {userInitials}
              </Avatar>
              <Box visibleFrom="xs">
                <Text size="xs" fw={700} lh={1.2}>
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email || 'Store Staff'}
                </Text>
                <Text size="10px" c="dimmed" lh={1.2}>
                  {isOrgAdmin ? 'Organization Administrator' : (user?.email || 'Verified Staff')}
                </Text>
              </Box>
            </Group>

            {/* Logout Button */}
            <Button
              variant="subtle"
              color="red"
              size="sm"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
              style={{ fontWeight: 600 }}
            >
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Modern Sidebar Navigation */}
      <AppShell.Navbar
        p="md"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <Box style={{ flex: 1 }}>
          <Text size="11px" fw={700} c="dimmed" px="xs" mb="xs" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Domain Navigation
          </Text>

          <Stack gap={4}>
            <NavLink
              label="Organizations"
              description="Tenants & franchises"
              leftSection={
                <ThemeIcon size={28} radius="md" color={location.pathname === '/organizations' ? 'brand' : 'gray'} variant={location.pathname === '/organizations' ? 'filled' : 'light'}>
                  <IconBuildingSkyscraper size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/organizations')}
              active={location.pathname === '/organizations'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Stores"
              description="Retail branches & registers"
              leftSection={
                <ThemeIcon size={28} radius="md" color={location.pathname === '/stores' ? 'brand' : 'gray'} variant={location.pathname === '/stores' ? 'filled' : 'light'}>
                  <IconBuildingStore size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/stores')}
              active={location.pathname === '/stores'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Products"
              description="Master catalog & barcodes"
              leftSection={
                <ThemeIcon size={28} radius="md" color={location.pathname === '/products' ? 'brand' : 'gray'} variant={location.pathname === '/products' ? 'filled' : 'light'}>
                  <IconPackage size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/products')}
              active={location.pathname === '/products'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Inventory"
              description="Store stock & inwarding"
              leftSection={
                <ThemeIcon size={28} radius="md" color={location.pathname === '/inventory' ? 'brand' : 'gray'} variant={location.pathname === '/inventory' ? 'filled' : 'light'}>
                  <IconBuildingWarehouse size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/inventory')}
              active={location.pathname === '/inventory'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Vendors"
              description="Suppliers & procurement"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/vendors' ? 'brand' : 'gray'}
                  variant={location.pathname === '/vendors' ? 'filled' : 'light'}
                >
                  <IconTruckDelivery size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/vendors')}
              active={location.pathname === '/vendors'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Customers"
              description="Directory & loyalty profiles"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/customers' ? 'brand' : 'gray'}
                  variant={location.pathname === '/customers' ? 'filled' : 'light'}
                >
                  <IconUsers size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/customers')}
              active={location.pathname === '/customers'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="POS Counter Terminal"
              description="Fast billing & barcode checkout"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/pos' ? 'brand' : 'gray'}
                  variant={location.pathname === '/pos' ? 'filled' : 'light'}
                >
                  <IconCashRegister size={16} />
                </ThemeIcon>
              }
              rightSection={
                <Badge size="xs" color="brand" variant="filled">
                  LIVE
                </Badge>
              }
              onClick={() => navigate('/pos')}
              active={location.pathname === '/pos'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Invoices"
              description="Receipts & tax bills"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/invoices' ? 'brand' : 'gray'}
                  variant={location.pathname === '/invoices' ? 'filled' : 'light'}
                >
                  <IconReceipt size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/invoices')}
              active={location.pathname === '/invoices'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Orders & Delivery"
              description="Click & collect, shipping & hold"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/orders' ? 'brand' : 'gray'}
                  variant={location.pathname === '/orders' ? 'filled' : 'light'}
                >
                  <IconShoppingCart size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/orders')}
              active={location.pathname === '/orders'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Cash Register"
              description="Shifts & Z-Reports"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/register' ? 'brand' : 'gray'}
                  variant={location.pathname === '/register' ? 'filled' : 'light'}
                >
                  <IconCoins size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/register')}
              active={location.pathname === '/register'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Analytics & BI"
              description="Real-time sales, trends & velocity"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/analytics' ? 'brand' : 'gray'}
                  variant={location.pathname === '/analytics' ? 'filled' : 'light'}
                >
                  <IconChartBar size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/analytics')}
              active={location.pathname === '/analytics'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />

            <NavLink
              label="Data Exchange"
              description="Bulk import, dry-runs & exports"
              leftSection={
                <ThemeIcon
                  size={28}
                  radius="md"
                  color={location.pathname === '/data-exchange' ? 'brand' : 'gray'}
                  variant={location.pathname === '/data-exchange' ? 'filled' : 'light'}
                >
                  <IconDatabaseImport size={16} />
                </ThemeIcon>
              }
              onClick={() => navigate('/data-exchange')}
              active={location.pathname === '/data-exchange'}
              style={{
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            />


            {isOrgAdmin && (
              <NavLink
                label="Subcategories"
                description="Custom taxonomy & groups"
                leftSection={
                  <ThemeIcon
                    size={28}
                    radius="md"
                    color={location.pathname === '/subcategories' ? 'brand' : 'gray'}
                    variant={location.pathname === '/subcategories' ? 'filled' : 'light'}
                  >
                    <IconCategory size={16} />
                  </ThemeIcon>
                }
                onClick={() => navigate('/subcategories')}
                active={location.pathname === '/subcategories'}
                style={{
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              />
            )}
          </Stack>
        </Box>

        {/* Sidebar Footer Info */}
        <Box
          p="sm"
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Group gap="xs" mb={4}>
            <IconSparkles size={14} color="var(--brand-primary)" />
            <Text size="xs" fw={700}>
              System Status
            </Text>
          </Group>
          <Text size="11px" c="dimmed">
            All stores synchronized with PostgreSQL linear ledger.
          </Text>
        </Box>
      </AppShell.Navbar>

      {/* Main Content Area */}
      <AppShell.Main>
        <Box maw={1280} mx="auto">
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
