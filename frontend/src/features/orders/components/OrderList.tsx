import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBoxSeam,
  IconCheck,
  IconClock,
  IconCoins,
  IconEye,
  IconFileInvoice,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconShoppingCart,
  IconTruckDelivery,
} from '@tabler/icons-react';
import {
  useOrders,
  useOrderStats,
  useConfirmOrder,
  usePackOrder,
  useReadyOrder,
} from '../api';
import { useStores } from '../../stores/api';
import { useInvoice } from '../../invoice/api';
import { ThermalReceiptModal } from '../../invoice/components/ThermalReceiptModal';
import { OrderDetailsDrawer } from './OrderDetailsDrawer';
import { ConvertToInvoiceModal } from './ConvertToInvoiceModal';
import { CreateOrderModal } from './CreateOrderModal';
import type { FulfillmentType, Order, OrderStatus } from '../types';

export function OrderList() {
  // Store Context
  const currentStoreStorage = useMemo(() => {
    try {
      const stored = localStorage.getItem('current_store');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    currentStoreStorage?.id || ''
  );
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modals and Drawers
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<Order | null>(null);
  const [drawerOpened, setDrawerOpened] = useState(false);

  const [selectedOrderForConvert, setSelectedOrderForConvert] = useState<Order | null>(null);
  const [convertModalOpened, setConvertModalOpened] = useState(false);

  const [createModalOpened, setCreateModalOpened] = useState(false);

  // Thermal Slip Modal
  const [receiptInvoiceId, setReceiptInvoiceId] = useState<string | null>(null);
  const [receiptModalOpened, setReceiptModalOpened] = useState(false);
  const { data: receiptInvoice } = useInvoice(receiptInvoiceId || undefined);

  // Stores
  const { data: stores = [] } = useStores();

  // Queries
  const filterParams = useMemo(() => {
    const params: any = {};
    if (selectedStoreId) params.store_id = selectedStoreId;
    if (activeTab !== 'ALL') params.status = activeTab;
    if (fulfillmentFilter !== 'ALL') params.fulfillment_type = fulfillmentFilter;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [selectedStoreId, activeTab, fulfillmentFilter, search]);

  const { data: orders = [], isLoading, refetch } = useOrders(filterParams);
  const { data: stats } = useOrderStats(selectedStoreId || undefined);

  // Quick Action Mutations
  const confirmMutation = useConfirmOrder();
  const packMutation = usePackOrder();
  const readyMutation = useReadyOrder();

  const handleOpenDetails = (order: Order) => {
    setSelectedOrderForDrawer(order);
    setDrawerOpened(true);
  };

  const handleOpenConvert = (order: Order) => {
    setSelectedOrderForConvert(order);
    setConvertModalOpened(true);
  };

  const handleConvertSuccess = (result: { order: Order; invoice: any; message: string }) => {
    if (result.invoice) {
      setReceiptInvoiceId(result.invoice.id);
      setReceiptModalOpened(true);
    }
    refetch();
  };

  const handleViewReceipt = (invoiceId: string) => {
    setReceiptInvoiceId(invoiceId);
    setReceiptModalOpened(true);
  };

  const storeOptions = useMemo(() => {
    return stores.map((s: any) => ({
      value: s.id,
      label: s.name,
    }));
  }, [stores]);

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge color="yellow" variant="light" size="sm">
            Pending
          </Badge>
        );
      case 'CONFIRMED':
        return (
          <Badge color="cyan" variant="light" size="sm">
            Confirmed
          </Badge>
        );
      case 'PACKED':
        return (
          <Badge color="indigo" variant="light" size="sm">
            Packed
          </Badge>
        );
      case 'READY_FOR_PICKUP':
        return (
          <Badge color="blue" variant="filled" size="sm">
            Ready for Pickup
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge color="teal" variant="filled" size="sm">
            Completed
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge color="gray" variant="outline" size="sm">
            Cancelled
          </Badge>
        );
      default:
        return <Badge size="sm">{status}</Badge>;
    }
  };

  const renderFulfillmentBadge = (type: FulfillmentType) => {
    switch (type) {
      case 'STORE_PICKUP':
        return (
          <Badge color="cyan" variant="outline" size="xs">
            Store Pickup
          </Badge>
        );
      case 'HOME_DELIVERY':
        return (
          <Badge color="grape" variant="outline" size="xs">
            Home Delivery
          </Badge>
        );
      case 'COUNTER_HOLD':
        return (
          <Badge color="orange" variant="outline" size="xs">
            Counter Hold
          </Badge>
        );
      default:
        return <Badge size="xs">{type}</Badge>;
    }
  };

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        {/* Page Header */}
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Box>
            <Group gap="xs">
              <ThemeIcon size={38} radius="md" color="brand" variant="light">
                <IconShoppingCart size={22} />
              </ThemeIcon>
              <Box>
                <Title order={2} fw={800}>
                  Orders & Omnichannel Fulfillment
                </Title>
                <Text size="sm" c="dimmed">
                  Manage click & collect, home deliveries, counter holds, and instant invoice conversions.
                </Text>
              </Box>
            </Group>
          </Box>

          <Group gap="sm">
            {storeOptions.length > 0 && (
              <Select
                placeholder="Select Store..."
                data={storeOptions}
                value={selectedStoreId}
                onChange={(val) => setSelectedStoreId(val || '')}
                size="sm"
                style={{ width: 220 }}
                clearable
              />
            )}
            <Button
              color="brand"
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpened(true)}
            >
              New Order
            </Button>
          </Group>
        </Group>

        {/* KPI Metrics */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          <Card p="sm" radius="md" withBorder>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={600}>
                TOTAL ORDERS
              </Text>
              <ThemeIcon size={24} radius="sm" color="blue" variant="light">
                <IconPackage size={14} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={800}>
              {stats?.total_orders ?? '—'}
            </Text>
          </Card>

          <Card p="sm" radius="md" withBorder>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={600}>
                PENDING
              </Text>
              <ThemeIcon size={24} radius="sm" color="yellow" variant="light">
                <IconClock size={14} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={800} c="yellow.8">
              {stats?.pending ?? '—'}
            </Text>
          </Card>

          <Card p="sm" radius="md" withBorder>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={600}>
                IN FULFILLMENT
              </Text>
              <ThemeIcon size={24} radius="sm" color="indigo" variant="light">
                <IconBoxSeam size={14} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={800} c="indigo">
              {(stats?.confirmed || 0) + (stats?.packed || 0)}
            </Text>
          </Card>

          <Card p="sm" radius="md" withBorder>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={600}>
                READY / DISPATCH
              </Text>
              <ThemeIcon size={24} radius="sm" color="cyan" variant="light">
                <IconTruckDelivery size={14} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={800} c="cyan.8">
              {stats?.ready_for_pickup ?? '—'}
            </Text>
          </Card>

          <Card p="sm" radius="md" withBorder>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={600}>
                COMPLETED
              </Text>
              <ThemeIcon size={24} radius="sm" color="teal" variant="light">
                <IconCheck size={14} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={800} c="teal.8">
              {stats?.completed ?? '—'}
            </Text>
          </Card>

          <Card p="sm" radius="md" withBorder>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={600}>
                TODAY'S REVENUE
              </Text>
              <ThemeIcon size={24} radius="sm" color="teal" variant="light">
                <IconCoins size={14} />
              </ThemeIcon>
            </Group>
            <Text size="lg" fw={800} c="teal">
              ₹{Number(stats?.today_revenue || 0).toFixed(2)}
            </Text>
          </Card>
        </SimpleGrid>

        {/* Filter Controls & Tabs */}
        <Paper p="sm" radius="md" withBorder bg="var(--bg-surface)">
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap">
              <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'ALL')}>
                <Tabs.List>
                  <Tabs.Tab value="ALL">All Orders</Tabs.Tab>
                  <Tabs.Tab
                    value="PENDING"
                    rightSection={
                      stats?.pending ? (
                        <Badge size="xs" color="yellow" variant="filled">
                          {stats.pending}
                        </Badge>
                      ) : null
                    }
                  >
                    Pending
                  </Tabs.Tab>
                  <Tabs.Tab value="CONFIRMED">Confirmed</Tabs.Tab>
                  <Tabs.Tab value="PACKED">Packed</Tabs.Tab>
                  <Tabs.Tab
                    value="READY_FOR_PICKUP"
                    rightSection={
                      stats?.ready_for_pickup ? (
                        <Badge size="xs" color="blue" variant="filled">
                          {stats.ready_for_pickup}
                        </Badge>
                      ) : null
                    }
                  >
                    Ready for Pickup
                  </Tabs.Tab>
                  <Tabs.Tab value="COMPLETED">Completed</Tabs.Tab>
                  <Tabs.Tab value="CANCELLED">Cancelled</Tabs.Tab>
                </Tabs.List>
              </Tabs>

              <Group gap="xs">
                <Select
                  placeholder="Fulfillment Type"
                  data={[
                    { value: 'ALL', label: 'All Types' },
                    { value: 'STORE_PICKUP', label: 'Store Pickup' },
                    { value: 'HOME_DELIVERY', label: 'Home Delivery' },
                    { value: 'COUNTER_HOLD', label: 'Counter Hold' },
                  ]}
                  value={fulfillmentFilter}
                  onChange={(val) => setFulfillmentFilter(val || 'ALL')}
                  size="xs"
                  style={{ width: 160 }}
                />

                <TextInput
                  placeholder="Search order #, customer, phone..."
                  leftSection={<IconSearch size={14} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  size="xs"
                  style={{ width: 240 }}
                />
              </Group>
            </Group>
          </Stack>
        </Paper>

        {/* Orders Table */}
        <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <Box py="xl" style={{ textAlign: 'center' }}>
              <Loader color="brand" size="md" />
              <Text size="sm" c="dimmed" mt="xs">
                Loading orders...
              </Text>
            </Box>
          ) : orders.length === 0 ? (
            <Box py="xl" style={{ textAlign: 'center' }}>
              <ThemeIcon size={48} radius="xl" color="gray" variant="light" mb="sm">
                <IconPackage size={24} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                No orders found
              </Text>
              <Text size="xs" c="dimmed" mb="md">
                Try adjusting your search criteria or create a new order.
              </Text>
              <Button
                color="brand"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setCreateModalOpened(true)}
              >
                Create Order
              </Button>
            </Box>
          ) : (
            <Table striped highlightOnHover verticalSpacing="sm" style={{ fontSize: '13px' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Order Number</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Fulfillment</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Payment</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                  <Table.Th>Placed On</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orders.map((order) => (
                  <Table.Tr key={order.id}>
                    {/* Order Number */}
                    <Table.Td>
                      <Text
                        fw={700}
                        size="xs"
                        style={{ cursor: 'pointer', color: 'var(--brand-primary, #2b6cb0)' }}
                        onClick={() => handleOpenDetails(order)}
                      >
                        {order.order_number}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {order.items?.length || order.items_count || 0} item(s)
                      </Text>
                    </Table.Td>

                    {/* Customer */}
                    <Table.Td>
                      <Text fw={600} size="xs">
                        {order.customer_name_snapshot || 'Walk-in'}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {order.customer_phone_snapshot || 'No phone'}
                        {order.delivery_city ? ` • ${order.delivery_city}` : ''}
                      </Text>
                    </Table.Td>

                    {/* Fulfillment */}
                    <Table.Td>{renderFulfillmentBadge(order.fulfillment_type)}</Table.Td>

                    {/* Status */}
                    <Table.Td>{renderStatusBadge(order.status)}</Table.Td>

                    {/* Payment Status */}
                    <Table.Td>
                      <Badge
                        size="xs"
                        variant="dot"
                        color={
                          order.payment_status === 'PAID'
                            ? 'teal'
                            : order.payment_status === 'PARTIALLY_PAID'
                            ? 'orange'
                            : 'red'
                        }
                      >
                        {order.payment_status}
                      </Badge>
                    </Table.Td>

                    {/* Amount */}
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{Number(order.grand_total).toFixed(2)}
                    </Table.Td>

                    {/* Placed On */}
                    <Table.Td>
                      <Text size="xs">
                        {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </Table.Td>

                    {/* Actions */}
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap={4} justify="center">
                        <Tooltip label="View Details">
                          <ActionIcon
                            variant="light"
                            color="gray"
                            size="sm"
                            onClick={() => handleOpenDetails(order)}
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>

                        {/* Quick state advancement buttons */}
                        {order.status === 'PENDING' && (
                          <Tooltip label="Confirm Order">
                            <Button
                              size="compact-xs"
                              color="brand"
                              loading={confirmMutation.isPending}
                              onClick={() => confirmMutation.mutate(order.id)}
                            >
                              Confirm
                            </Button>
                          </Tooltip>
                        )}

                        {order.status === 'CONFIRMED' && (
                          <Tooltip label="Pack Order">
                            <Button
                              size="compact-xs"
                              color="indigo"
                              loading={packMutation.isPending}
                              onClick={() => packMutation.mutate(order.id)}
                            >
                              Pack
                            </Button>
                          </Tooltip>
                        )}

                        {order.status === 'PACKED' && (
                          <Tooltip label="Mark Ready for Pickup">
                            <Button
                              size="compact-xs"
                              color="teal"
                              loading={readyMutation.isPending}
                              onClick={() => readyMutation.mutate(order.id)}
                            >
                              Ready
                            </Button>
                          </Tooltip>
                        )}

                        {['CONFIRMED', 'PACKED', 'READY_FOR_PICKUP'].includes(order.status) && (
                          <Tooltip label="Convert to Invoice">
                            <ActionIcon
                              variant="filled"
                              color="violet"
                              size="sm"
                              onClick={() => handleOpenConvert(order)}
                            >
                              <IconFileInvoice size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}

                        {order.status === 'COMPLETED' && order.invoice_id && (
                          <Tooltip label="Thermal Receipt">
                            <ActionIcon
                              variant="light"
                              color="teal"
                              size="sm"
                              onClick={() => handleViewReceipt(order.invoice_id!)}
                            >
                              <IconReceipt size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      {/* Drawers & Modals */}
      <OrderDetailsDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        order={selectedOrderForDrawer}
        onOpenConvertModal={(ord) => {
          setDrawerOpened(false);
          handleOpenConvert(ord);
        }}
        onViewInvoice={handleViewReceipt}
      />

      <ConvertToInvoiceModal
        opened={convertModalOpened}
        onClose={() => setConvertModalOpened(false)}
        order={selectedOrderForConvert}
        onSuccess={handleConvertSuccess}
      />

      <CreateOrderModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        storeId={selectedStoreId}
        onSuccess={(ord) => {
          refetch();
          handleOpenDetails(ord);
        }}
      />

      {/* Thermal Receipt Slip Modal */}
      <ThermalReceiptModal
        opened={receiptModalOpened}
        onClose={() => setReceiptModalOpened(false)}
        invoice={receiptInvoice || null}
      />
    </Container>
  );
}
