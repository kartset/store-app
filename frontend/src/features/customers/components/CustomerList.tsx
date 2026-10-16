import {
  Table,
  Title,
  Card,
  Text,
  Loader,
  Center,
  Badge,
  Group,
  Stack,
  TextInput,
  Button,
  SimpleGrid,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Select,
  Menu,
  Modal,
  CopyButton,
  Pagination,
  Avatar,
} from '@mantine/core';
import {
  IconUsers,
  IconSearch,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconEye,
  IconCheck,
  IconCopy,
  IconPhone,
  IconMail,
  IconReceiptTax,
  IconAlertCircle,
  IconBuildingSkyscraper,
  IconSparkles,
  IconUserCheck,
  IconMapPin,
  IconX,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useCustomers, useDeleteCustomer } from '../api';
import { CustomerDrawer } from './CustomerDrawer';
import type { Customer, CustomerType } from '../types';

export function CustomerList() {
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Drawer State
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Delete Confirmation Modal State
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: customers, isLoading, error } = useCustomers({
    search: searchTerm || undefined,
    customer_type: (typeFilter as CustomerType) || undefined,
    is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
  });

  const deleteCustomerMutation = useDeleteCustomer();

  // Metrics Calculations
  const metrics = useMemo(() => {
    const list = customers || [];
    const total = list.length;
    const active = list.filter((c) => c.is_active).length;
    const b2b = list.filter((c) => c.customer_type === 'B2B').length;
    const totalLoyalty = list.reduce((acc, c) => acc + (c.total_loyalty_points || 0), 0);

    return { total, active, b2b, totalLoyalty };
  }, [customers]);

  // Paginated records
  const paginatedCustomers = useMemo(() => {
    if (!customers) return [];
    const start = (currentPage - 1) * pageSize;
    return customers.slice(start, start + pageSize);
  }, [customers, currentPage]);

  const totalPages = Math.ceil((customers?.length || 0) / pageSize) || 1;

  // Open create drawer
  const handleOpenCreate = () => {
    setSelectedCustomer(null);
    setIsReadOnly(false);
    setDrawerOpened(true);
  };

  // Open edit drawer
  const handleOpenEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsReadOnly(false);
    setDrawerOpened(true);
  };

  // Open view profile drawer
  const handleOpenView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsReadOnly(true);
    setDrawerOpened(true);
  };

  // Trigger delete modal
  const handlePromptDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteModalOpened(true);
  };

  // Execute soft delete
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      await deleteCustomerMutation.mutateAsync(customerToDelete.id);
      setDeleteModalOpened(false);
      setCustomerToDelete(null);
    } catch (err) {
      console.error('Failed to delete customer:', err);
    }
  };

  return (
    <Stack gap="xl">
      {/* Page Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ letterSpacing: '-0.02em', fontWeight: 800 }}>
            Customer Directory
          </Title>
          <Text c="dimmed" size="sm" mt={2}>
            Manage retail consumers, wholesale B2B accounts, and loyalty rewards
          </Text>
        </div>

        <Button
          color="brand"
          leftSection={<IconPlus size={18} />}
          onClick={handleOpenCreate}
          size="md"
          radius="md"
          style={{ boxShadow: 'var(--shadow-sm)', fontWeight: 600 }}
        >
          Add Customer
        </Button>
      </Group>

      {/* Metrics Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Total Customers
              </Text>
              <Text size="xl" fw={800} mt={4}>
                {metrics.total}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                All registered accounts
              </Text>
            </div>
            <ThemeIcon size={46} radius="md" color="blue" variant="light">
              <IconUsers size={24} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Active Accounts
              </Text>
              <Text size="xl" fw={800} mt={4} c="green.7">
                {metrics.active}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                Eligible for POS checkout
              </Text>
            </div>
            <ThemeIcon size={46} radius="md" color="green" variant="light">
              <IconUserCheck size={24} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Wholesale (B2B)
              </Text>
              <Text size="xl" fw={800} mt={4} c="indigo.7">
                {metrics.b2b}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                GST compliant businesses
              </Text>
            </div>
            <ThemeIcon size={46} radius="md" color="indigo" variant="light">
              <IconBuildingSkyscraper size={24} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Loyalty Points
              </Text>
              <Text size="xl" fw={800} mt={4} c="yellow.8">
                {metrics.totalLoyalty.toLocaleString()}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                Total earned across stores
              </Text>
            </div>
            <ThemeIcon size={46} radius="md" color="yellow" variant="light">
              <IconSparkles size={24} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filter and Search Bar */}
      <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <Group justify="space-between" wrap="wrap" gap="md">
          <TextInput
            placeholder="Search by name, phone, email, GSTIN, city..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            rightSection={
              searchTerm ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                >
                  <IconX size={12} />
                </ActionIcon>
              ) : null
            }
            style={{ flex: 1, minWidth: 260 }}
          />

          <Group gap="sm">
            <Select
              placeholder="Customer Type"
              data={[
                { value: '', label: 'All Customer Types' },
                { value: 'RETAIL', label: 'Retail Consumer (B2C)' },
                { value: 'B2B', label: 'Wholesale (B2B)' },
              ]}
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val || '');
                setCurrentPage(1);
              }}
              style={{ width: 190 }}
              clearable
            />

            <Select
              placeholder="Status"
              data={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active Only' },
                { value: 'inactive', label: 'Inactive Only' },
              ]}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val || '');
                setCurrentPage(1);
              }}
              style={{ width: 150 }}
              clearable
            />

            {(searchTerm || typeFilter || statusFilter) && (
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('');
                  setStatusFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      {/* Main Customers Table Card */}
      <Card withBorder padding={0} radius="md" style={{ backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
        {isLoading ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <Loader color="brand" size="md" />
              <Text size="sm" c="dimmed">
                Loading customer directory...
              </Text>
            </Stack>
          </Center>
        ) : error ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <ThemeIcon size={44} radius="xl" color="red" variant="light">
                <IconAlertCircle size={24} />
              </ThemeIcon>
              <Text size="md" fw={600} c="red">
                Failed to load customers
              </Text>
              <Text size="xs" c="dimmed">
                Please check network connection or verify API status
              </Text>
            </Stack>
          </Center>
        ) : paginatedCustomers.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                <IconUsers size={24} />
              </ThemeIcon>
              <Text size="md" fw={600}>
                No customers found
              </Text>
              <Text size="xs" c="dimmed" maw={320} ta="center">
                {searchTerm || typeFilter || statusFilter
                  ? 'No customers match your active filter criteria. Try adjusting filters.'
                  : 'Get started by creating your first customer profile for counter checkout.'}
              </Text>
              {!searchTerm && !typeFilter && !statusFilter && (
                <Button
                  size="xs"
                  variant="light"
                  color="brand"
                  leftSection={<IconPlus size={14} />}
                  onClick={handleOpenCreate}
                  mt="xs"
                >
                  Add First Customer
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <div>
            <Table.ScrollContainer minWidth={900}>
              <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <Table.Tr>
                    <Table.Th style={{ width: '26%' }}>Customer</Table.Th>
                    <Table.Th style={{ width: '22%' }}>Contact</Table.Th>
                    <Table.Th style={{ width: '16%' }}>Type & GSTIN</Table.Th>
                    <Table.Th style={{ width: '14%' }}>Location</Table.Th>
                    <Table.Th style={{ width: '10%' }}>Loyalty</Table.Th>
                    <Table.Th style={{ width: '8%' }}>Status</Table.Th>
                    <Table.Th style={{ width: '4%', textAlign: 'right' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedCustomers.map((customer) => {
                    const initials = customer.name
                      ? customer.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : customer.mobile_number.slice(-2);

                    return (
                      <Table.Tr key={customer.id}>
                        {/* Customer Info */}
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <Avatar
                              radius="xl"
                              size="md"
                              color={customer.customer_type === 'B2B' ? 'indigo' : 'cyan'}
                            >
                              {initials}
                            </Avatar>
                            <div style={{ minWidth: 0 }}>
                              <Text
                                size="sm"
                                fw={600}
                                truncate
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleOpenView(customer)}
                              >
                                {customer.name || 'Unnamed Customer'}
                              </Text>
                              <Text size="xs" c="dimmed">
                                ID: {customer.id.slice(0, 8)}
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>

                        {/* Contact Info */}
                        <Table.Td>
                          <Stack gap={2}>
                            <Group gap={6} wrap="nowrap">
                              <IconPhone size={14} color="var(--mantine-color-dimmed)" />
                              <Text size="sm" fw={600}>
                                {customer.mobile_number}
                              </Text>
                              <CopyButton value={customer.mobile_number}>
                                {({ copied, copy }) => (
                                  <Tooltip label={copied ? 'Copied' : 'Copy phone'}>
                                    <ActionIcon
                                      size="xs"
                                      variant="subtle"
                                      color={copied ? 'teal' : 'gray'}
                                      onClick={copy}
                                    >
                                      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </CopyButton>
                            </Group>
                            {customer.email && (
                              <Group gap={6} wrap="nowrap">
                                <IconMail size={13} color="var(--mantine-color-dimmed)" />
                                <Text size="xs" c="dimmed" truncate maw={180}>
                                  {customer.email}
                                </Text>
                              </Group>
                            )}
                          </Stack>
                        </Table.Td>

                        {/* Type & Tax */}
                        <Table.Td>
                          <Stack gap={4} align="flex-start">
                            <Badge
                              color={customer.customer_type === 'B2B' ? 'indigo' : 'cyan'}
                              variant="light"
                              size="sm"
                            >
                              {customer.customer_type === 'B2B' ? 'Wholesale (B2B)' : 'Retail Consumer'}
                            </Badge>
                            {customer.gstin && (
                              <Group gap={4}>
                                <IconReceiptTax size={13} color="var(--mantine-color-indigo-6)" />
                                <Text size="11px" fw={600} c="indigo">
                                  {customer.gstin}
                                </Text>
                              </Group>
                            )}
                          </Stack>
                        </Table.Td>

                        {/* Location */}
                        <Table.Td>
                          {customer.city || customer.state ? (
                            <Group gap={4} wrap="nowrap">
                              <IconMapPin size={14} color="var(--mantine-color-dimmed)" />
                              <Text size="xs" truncate maw={140}>
                                {[customer.city, customer.state].filter(Boolean).join(', ')}
                              </Text>
                            </Group>
                          ) : (
                            <Text size="xs" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>

                        {/* Loyalty Points */}
                        <Table.Td>
                          <Group gap={4}>
                            <ThemeIcon size={20} radius="xl" color="yellow" variant="light">
                              <IconSparkles size={12} />
                            </ThemeIcon>
                            <Text size="sm" fw={700}>
                              {customer.total_loyalty_points || 0}
                            </Text>
                          </Group>
                        </Table.Td>

                        {/* Active Status */}
                        <Table.Td>
                          <Badge
                            color={customer.is_active ? 'green' : 'gray'}
                            variant="dot"
                            size="sm"
                          >
                            {customer.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </Table.Td>

                        {/* Row Actions */}
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Menu position="bottom-end" shadow="md" width={160}>
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" size="sm">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconEye size={14} />}
                                onClick={() => handleOpenView(customer)}
                              >
                                View Details
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconEdit size={14} />}
                                onClick={() => handleOpenEdit(customer)}
                              >
                                Edit Profile
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => handlePromptDelete(customer)}
                              >
                                Delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Group justify="space-between" p="md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <Text size="xs" c="dimmed">
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, customers?.length || 0)} of {customers?.length || 0}{' '}
                  customers
                </Text>
                <Pagination
                  value={currentPage}
                  onChange={setCurrentPage}
                  total={totalPages}
                  size="sm"
                  radius="md"
                />
              </Group>
            )}
          </div>
        )}
      </Card>

      {/* Customer Create/Edit Drawer */}
      <CustomerDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        customer={selectedCustomer}
        isReadOnly={isReadOnly}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="red" variant="light">
              <IconTrash size={16} />
            </ThemeIcon>
            <Text fw={700} size="md">
              Delete Customer
            </Text>
          </Group>
        }
        centered
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete customer{' '}
            <Text span fw={700}>
              {customerToDelete?.name || customerToDelete?.mobile_number}
            </Text>
            ?
          </Text>
          <Text size="xs" c="dimmed">
            This will soft-delete the customer from the directory. Past sales invoices and historical records will remain intact.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setDeleteModalOpened(false)}
              disabled={deleteCustomerMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleConfirmDelete}
              loading={deleteCustomerMutation.isPending}
              leftSection={<IconTrash size={16} />}
            >
              Confirm Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
