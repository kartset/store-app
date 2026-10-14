import { AppShell, Burger, Group, NavLink, Title, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { IconBuildingSkyscraper, IconBuildingStore, IconLogout } from '@tabler/icons-react';

export function DashboardLayout() {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('current_store');
    navigate('/login');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>Store Admin</Title>
          </Group>
          <Button variant="subtle" color="red" leftSection={<IconLogout size={16} />} onClick={handleLogout}>
            Logout
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <NavLink
          label="Organizations"
          leftSection={<IconBuildingSkyscraper size="1rem" stroke={1.5} />}
          onClick={() => navigate('/organizations')}
          active={location.pathname === '/organizations'}
        />
        <NavLink
          label="Stores"
          leftSection={<IconBuildingStore size="1rem" stroke={1.5} />}
          onClick={() => navigate('/stores')}
          active={location.pathname === '/stores'}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
