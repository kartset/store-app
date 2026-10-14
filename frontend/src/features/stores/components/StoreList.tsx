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
  IconBuildingStore,
  IconSearch,
  IconPlus,
  IconCheck,
  IconMapPin,
  IconReceiptTax,
  IconDeviceDesktop,
  IconDotsVertical,
} from '@tabler/icons-react';
import { useStores } from '../api';
import { useState, useMemo } from 'react';

export function StoreList() {
  const { data: stores, isLoading, error } = useStores();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStores = useMemo(() => {
    if (!stores) return [];
    if (!searchQuery.trim()) return stores;
    const q = searchQuery.toLowerCase();
    return stores.filter(
      (store) =>
        store.name?.toLowerCase().includes(q) ||
        store.gst_number?.toLowerCase().includes(q) ||
        store.address?.toLowerCase().includes(q)
    );
  }, [stores, searchQuery]);

  if (isLoading) {
    return (
      <Center h={320}>
        <Group gap="md">
          <Loader size="md" color="brand" />
          <Text size="sm" c="dimmed" fw={600}>
            Loading retail store network...
          </Text>
        </Group>
      </Center>
    );
  }

  if (error) {
    return (
      <Card p="xl" radius="lg" style={{ backgroundColor: 'var(--status-danger-bg)' }}>
        <Text c="red" fw={600}>
          Failed to load stores from API. Please verify network access.
        </Text>
      </Card>
    );
  }

  const totalCount = stores?.length || 0;
  const activeCount = stores?.filter((s) => s.is_active !== false).length || 0;
  const gstRegisteredCount = stores?.filter((s) => Boolean(s.gst_number)).length || 0;

  return (
    <Box>
      {/* Page Header */}
      <Group justify="space-between" align="flex-end" mb="xl">
        <div>
          <Badge variant="light" color="brand" size="sm" radius="sm" mb={6}>
            Retail Terminals
          </Badge>
          <Title order={1} fw={800} style={{ letterSpacing: '-0.02em' }}>
            Stores &amp; Registers
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Monitor multi-location retail stores, tax compliance, and register terminal assignments.
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
            Add Store
          </Button>
        </Group>
      </Group>

      {/* KPI Metric Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
        <Card p="lg" radius="lg" withBorder className="interactive-card">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Stores
            </Text>
            <ThemeIcon size={32} radius="md" color="brand" variant="light">
              <IconBuildingStore size={18} />
            </ThemeIcon>
          </Group>
          <Group align="flex-baseline" gap="xs">
            <Text fw={800} size="1.75rem" lh={1}>
              {totalCount}
            </Text>
            <Badge size="xs" color="brand" variant="light">
              Branches
            </Badge>
          </Group>
        </Card>

        <Card p="lg" radius="lg" withBorder className="interactive-card">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active POS Terminals
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
              Online
            </Text>
          </Group>
        </Card>

        <Card p="lg" radius="lg" withBorder className="interactive-card">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tax &amp; GST Registered
            </Text>
            <ThemeIcon size={32} radius="md" color="indigo" variant="light">
              <IconReceiptTax size={18} />
            </ThemeIcon>
          </Group>
          <Group align="flex-baseline" gap="xs">
            <Text fw={800} size="1.75rem" lh={1}>
              {gstRegisteredCount}
            </Text>
            <Text size="xs" c="dimmed">
              Compliant
            </Text>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Main Table Card */}
      <Card p="md" radius="lg" withBorder>
        {/* Search & Actions Toolbar */}
        <Group justify="space-between" mb="md" px="xs">
          <TextInput
            placeholder="Search stores by name, GST number, or address..."
            leftSection={<IconSearch size={16} stroke={1.5} color="var(--text-muted)" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            w={380}
            radius="md"
          />

          <Text size="xs" fw={600} c="dimmed">
            Showing {filteredStores.length} of {totalCount} branches
          </Text>
        </Group>

        {filteredStores.length === 0 ? (
          <Box p="xl" ta="center">
            <ThemeIcon size={48} radius="xl" color="gray" variant="light" mb="md">
              <IconBuildingStore size={24} />
            </ThemeIcon>
            <Text fw={700} size="md">
              No store branches found
            </Text>
            <Text size="xs" c="dimmed" mt={4} maw={360} mx="auto">
              No store locations match your search criteria. Add your first retail store using the button above.
            </Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'var(--bg-surface-subtle)' }}>
                  <Table.Th>Store Name</Table.Th>
                  <Table.Th>GST / Tax Identifier</Table.Th>
                  <Table.Th>Store Address</Table.Th>
                  <Table.Th>Terminal Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredStores.map((store) => {
                  const initial = store.name?.[0]?.toUpperCase() || 'S';
                  return (
                    <Table.Tr key={store.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <ThemeIcon size={34} radius="md" color="brand" variant="light">
                            <Text fw={700} size="sm">
                              {initial}
                            </Text>
                          </ThemeIcon>
                          <div>
                            <Group gap={6} align="center">
                              <Text fw={700} size="sm">
                                {store.name}
                              </Text>
                              {store.organization?.name && (
                                <Badge size="xs" variant="light" color="indigo" radius="sm">
                                  {store.organization.name}
                                </Badge>
                              )}
                            </Group>
                            <Text size="11px" c="dimmed">
                              ID: {String(store.id).slice(0, 8)}...
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>

                      <Table.Td>
                        {store.gst_number ? (
                          <Badge variant="outline" color="gray" size="sm" radius="sm">
                            {store.gst_number}
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Not Registered
                          </Text>
                        )}
                      </Table.Td>

                      <Table.Td>
                        {store.address ? (
                          <Group gap={4}>
                            <IconMapPin size={14} color="var(--text-muted)" />
                            <Text size="xs" c="var(--text-secondary)" maw={240} truncate="end">
                              {store.address}
                            </Text>
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">
                            No physical address
                          </Text>
                        )}
                      </Table.Td>

                      <Table.Td>
                        {store.is_active !== false ? (
                          <Badge
                            variant="light"
                            color="emerald"
                            size="sm"
                            leftSection={<span className="pulse-dot" />}
                          >
                            Active POS
                          </Badge>
                        ) : (
                          <Badge variant="light" color="gray" size="sm">
                            Deactivated
                          </Badge>
                        )}
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'right' }}>
                        <Group gap="xs" justify="flex-end">
                          <Tooltip label="Launch Register Terminal">
                            <ActionIcon variant="light" color="brand" radius="md">
                              <IconDeviceDesktop size={16} />
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
