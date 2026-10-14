import {
  Table,
  Title,
  Card,
  Text,
  Loader,
  Center,
  Badge,
  Group,
  TextInput,
  Button,
  SimpleGrid,
  ThemeIcon,
  Box,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBuildingSkyscraper,
  IconSearch,
  IconPlus,
  IconWorld,
  IconCheck,
  IconDotsVertical,
  IconArrowUpRight,
} from '@tabler/icons-react';
import { useOrganizations } from '../api';
import { useState, useMemo } from 'react';

export function OrganizationList() {
  const { data: organizations, isLoading, error } = useOrganizations();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrgs = useMemo(() => {
    if (!organizations) return [];
    if (!searchQuery.trim()) return organizations;
    const q = searchQuery.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name?.toLowerCase().includes(q) ||
        org.subdomain?.toLowerCase().includes(q)
    );
  }, [organizations, searchQuery]);

  if (isLoading) {
    return (
      <Center h={320}>
        <Group gap="md">
          <Loader size="md" color="brand" />
          <Text size="sm" c="dimmed" fw={600}>
            Loading organization registry...
          </Text>
        </Group>
      </Center>
    );
  }

  if (error) {
    return (
      <Card p="xl" radius="lg" style={{ backgroundColor: 'var(--status-danger-bg)' }}>
        <Text c="red" fw={600}>
          Failed to load organizations from API. Please verify backend service connectivity.
        </Text>
      </Card>
    );
  }

  const totalCount = organizations?.length || 0;
  const activeCount = organizations?.filter((o) => o.is_active !== false).length || 0;

  return (
    <Box>
      {/* Page Header */}
      <Group justify="space-between" align="flex-end" mb="xl">
        <div>
          <Badge variant="light" color="brand" size="sm" radius="sm" mb={6}>
            Enterprise Tenants
          </Badge>
          <Title order={1} fw={800} style={{ letterSpacing: '-0.02em' }}>
            Organizations
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Configure multi-tenant store franchises, custom subdomains, and corporate entities.
          </Text>
        </div>

        <Group gap="sm">
          <Button
            leftSection={<IconPlus size={16} />}
            style={{
              background: 'var(--brand-gradient)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Create Organization
          </Button>
        </Group>
      </Group>

      {/* KPI Metric Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
        <Card p="lg" radius="lg" withBorder className="interactive-card">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Organizations
            </Text>
            <ThemeIcon size={32} radius="md" color="brand" variant="light">
              <IconBuildingSkyscraper size={18} />
            </ThemeIcon>
          </Group>
          <Group align="flex-baseline" gap="xs">
            <Text fw={800} size="1.75rem" lh={1}>
              {totalCount}
            </Text>
            <Badge size="xs" color="emerald" variant="light">
              Registered
            </Badge>
          </Group>
        </Card>

        <Card p="lg" radius="lg" withBorder className="interactive-card">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Tenants
            </Text>
            <ThemeIcon size={32} radius="md" color="emerald" variant="light">
              <IconCheck size={18} />
            </ThemeIcon>
          </Group>
          <Group align="flex-baseline" gap="xs">
            <Text fw={800} size="1.75rem" lh={1} c="emerald.7">
              {activeCount}
            </Text>
            <Text size="xs" c="dimmed">
              Operational
            </Text>
          </Group>
        </Card>

        <Card p="lg" radius="lg" withBorder className="interactive-card">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cloud Routing
            </Text>
            <ThemeIcon size={32} radius="md" color="indigo" variant="light">
              <IconWorld size={18} />
            </ThemeIcon>
          </Group>
          <Group align="flex-baseline" gap="xs">
            <Text fw={800} size="1.75rem" lh={1}>
              100%
            </Text>
            <Text size="xs" c="dimmed">
              Linear Multi-Tenant
            </Text>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Main Table Card */}
      <Card p="md" radius="lg" withBorder>
        {/* Search & Actions Toolbar */}
        <Group justify="space-between" mb="md" px="xs">
          <TextInput
            placeholder="Search organizations by name or subdomain..."
            leftSection={<IconSearch size={16} stroke={1.5} color="var(--text-muted)" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            w={380}
            radius="md"
          />

          <Text size="xs" fw={600} c="dimmed">
            Showing {filteredOrgs.length} of {totalCount} tenants
          </Text>
        </Group>

        {filteredOrgs.length === 0 ? (
          <Box p="xl" ta="center">
            <ThemeIcon size={48} radius="xl" color="gray" variant="light" mb="md">
              <IconBuildingSkyscraper size={24} />
            </ThemeIcon>
            <Text fw={700} size="md">
              No organizations found
            </Text>
            <Text size="xs" c="dimmed" mt={4} maw={360} mx="auto">
              No organization records match your filter criteria. Create your first tenant using the button above.
            </Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'var(--bg-surface-subtle)' }}>
                  <Table.Th>Organization Name</Table.Th>
                  <Table.Th>Subdomain Endpoint</Table.Th>
                  <Table.Th>Operating Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredOrgs.map((org) => {
                  const initial = org.name?.[0]?.toUpperCase() || 'O';
                  return (
                    <Table.Tr key={org.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <ThemeIcon size={34} radius="md" color="brand" variant="light">
                            <Text fw={700} size="sm">
                              {initial}
                            </Text>
                          </ThemeIcon>
                          <div>
                            <Text fw={700} size="sm">
                              {org.name}
                            </Text>
                            <Text size="11px" c="dimmed">
                              ID: {String(org.id).slice(0, 8)}...
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>

                      <Table.Td>
                        {org.subdomain ? (
                          <Badge variant="outline" color="indigo" size="sm" radius="sm">
                            {org.subdomain}.storeapp.com
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Default Domain
                          </Text>
                        )}
                      </Table.Td>

                      <Table.Td>
                        {org.is_active !== false ? (
                          <Badge
                            variant="light"
                            color="emerald"
                            size="sm"
                            leftSection={<span className="pulse-dot" />}
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="light" color="gray" size="sm">
                            Inactive
                          </Badge>
                        )}
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'right' }}>
                        <Group gap="xs" justify="flex-end">
                          <Tooltip label="View Stores">
                            <ActionIcon variant="subtle" color="brand" radius="md">
                              <IconArrowUpRight size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <ActionIcon variant="subtle" color="gray" radius="md">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Box>
  );
}
