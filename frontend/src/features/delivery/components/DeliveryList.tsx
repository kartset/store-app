import { useState, useMemo } from 'react';
import {
  Title,
  Text,
  Group,
  Button,
  Stack,
  Paper,
  Table,
  Badge,
  TextInput,
  Select,
  ActionIcon,
  Menu,
  Tabs,
  Modal,
  Textarea,
  Card,
  SimpleGrid,
  Tooltip,
  CopyButton,
  Loader,
} from '@mantine/core';
import {
  IconTruckDelivery,
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconSteeringWheel,
  IconShieldCheck,
  IconDotsVertical,
  IconX,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconCoins,
  IconCopy,
  IconCircleCheck,
} from '@tabler/icons-react';
import {
  useDeliveries,
  useDeliveryPipelineSummary,
  useDispatchDelivery,
  useUpdateDeliveryStatus,
} from '../api';
import { useStores } from '../../stores/api';
import { AssignDriverModal } from './AssignDriverModal';
import { VerifyOTPModal } from './VerifyOTPModal';
import { ThermalDispatchSlipModal } from './ThermalDispatchSlipModal';
import { CreateDeliveryModal } from './CreateDeliveryModal';
import type { Delivery, DeliveryStatus } from '../types';

export function DeliveryList() {
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [search, setSearch] = useState('');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('ALL');

  // Modals state
  const [createOpened, setCreateOpened] = useState(false);
  const [assignDelivery, setAssignDelivery] = useState<Delivery | null>(null);
  const [verifyDelivery, setVerifyDelivery] = useState<Delivery | null>(null);
  const [printDelivery, setPrintDelivery] = useState<Delivery | null>(null);

  // Status reason modal
  const [statusModalDelivery, setStatusModalDelivery] = useState<Delivery | null>(null);
  const [targetStatus, setTargetStatus] = useState<DeliveryStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const { data: stores = [] } = useStores();

  // Status parameter for backend
  const statusParam = useMemo(() => {
    if (activeTab === 'ALL') return undefined;
    if (activeTab === 'PENDING') return 'PENDING';
    if (activeTab === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
    if (activeTab === 'DELIVERED') return 'DELIVERED';
    return undefined; // We'll filter FAILED_RETURNED locally or by query
  }, [activeTab]);

  const {
    data: deliveries = [],
    isLoading,
    refetch,
    isRefetching,
  } = useDeliveries({
    store_id: selectedStore || undefined,
    status: statusParam,
    delivery_type: deliveryTypeFilter || undefined,
    search: search.trim() || undefined,
  });

  const { data: summary } = useDeliveryPipelineSummary(selectedStore || undefined);

  const dispatchMutation = useDispatchDelivery();
  const updateStatusMutation = useUpdateDeliveryStatus();

  // Tab filtering if FAILED_RETURNED
  const displayedDeliveries = useMemo(() => {
    if (activeTab === 'FAILED_RETURNED') {
      return deliveries.filter(
        (d) => d.status === 'FAILED' || d.status === 'RETURNED' || d.status === 'CANCELLED'
      );
    }
    return deliveries;
  }, [deliveries, activeTab]);

  const handleOpenStatusModal = (delivery: Delivery, status: DeliveryStatus) => {
    setStatusModalDelivery(delivery);
    setTargetStatus(status);
    setStatusReason('');
  };

  const handleConfirmStatusUpdate = () => {
    if (!statusModalDelivery || !targetStatus) return;

    updateStatusMutation.mutate(
      {
        id: statusModalDelivery.id,
        data: {
          status: targetStatus,
          reason: statusReason.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setStatusModalDelivery(null);
          setTargetStatus(null);
          setStatusReason('');
        },
      }
    );
  };

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge color="yellow" variant="light">Pending Assignment</Badge>;
      case 'ASSIGNED':
        return <Badge color="blue" variant="light">Driver Assigned</Badge>;
      case 'OUT_FOR_DELIVERY':
        return <Badge color="indigo" variant="filled">Out for Delivery</Badge>;
      case 'DELIVERED':
        return <Badge color="green" variant="filled">Delivered</Badge>;
      case 'FAILED':
        return <Badge color="red" variant="filled">Delivery Failed</Badge>;
      case 'RETURNED':
        return <Badge color="gray" variant="filled">Returned to Store</Badge>;
      case 'CANCELLED':
        return <Badge color="gray" variant="outline">Cancelled</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <Stack gap="lg">
      {/* Page Header */}
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={2} style={{ color: 'var(--text-primary)' }}>
            Delivery &amp; Dispatch Operations Hub
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Live last-mile delivery tracking, driver assignment, customer OTP handoff &amp; COD reconciliation
          </Text>
        </div>

        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            loading={isRefetching}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            color="brand"
            leftSection={<IconTruckDelivery size={16} />}
            onClick={() => setCreateOpened(true)}
          >
            Dispatch Package
          </Button>
        </Group>
      </Group>

      {/* KPI Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>TOTAL PIPELINE</Text>
            <IconTruckDelivery size={20} color="var(--brand-primary)" />
          </Group>
          <Text size="xl" fw={800} mt="xs">
            {summary?.total ?? 0}
          </Text>
          <Text size="xs" c="dimmed">All logged dispatches</Text>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>PENDING ASSIGNMENT</Text>
            <IconClock size={20} color="var(--mantine-color-yellow-6)" />
          </Group>
          <Text size="xl" fw={800} mt="xs" c="yellow.8">
            {summary?.pending ?? 0}
          </Text>
          <Text size="xs" c="dimmed">Needs fleet assignment</Text>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>OUT FOR DELIVERY</Text>
            <IconSteeringWheel size={20} color="var(--mantine-color-indigo-6)" />
          </Group>
          <Text size="xl" fw={800} mt="xs" c="indigo.8">
            {summary?.out_for_delivery ?? 0}
          </Text>
          <Text size="xs" c="dimmed">Live in transit with driver</Text>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>DELIVERED</Text>
            <IconCheck size={20} color="var(--mantine-color-green-6)" />
          </Group>
          <Text size="xl" fw={800} mt="xs" c="green.8">
            {summary?.delivered ?? 0}
          </Text>
          <Text size="xs" c="dimmed">OTP verified handovers</Text>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>COD COLLECTED</Text>
            <IconCoins size={20} color="var(--mantine-color-orange-6)" />
          </Group>
          <Text size="xl" fw={800} mt="xs" c="orange.8">
            ₹{Number(summary?.total_cod_collected || 0).toFixed(2)}
          </Text>
          <Text size="xs" c="dimmed">
            Due: ₹{Number(summary?.total_cod_due || 0).toFixed(2)}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Main Operations Board Paper */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <Stack gap="md">
          {/* Operations Pipeline Tabs */}
          <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'ALL')}>
            <Tabs.List>
              <Tabs.Tab value="ALL" leftSection={<IconTruckDelivery size={16} />}>
                All Shipments ({summary?.total ?? 0})
              </Tabs.Tab>
              <Tabs.Tab value="PENDING" leftSection={<IconClock size={16} />}>
                Pending Assignment ({summary?.pending ?? 0})
              </Tabs.Tab>
              <Tabs.Tab value="OUT_FOR_DELIVERY" leftSection={<IconSteeringWheel size={16} />}>
                Out for Delivery ({summary?.out_for_delivery ?? 0})
              </Tabs.Tab>
              <Tabs.Tab value="DELIVERED" leftSection={<IconCheck size={16} />}>
                Delivered ({summary?.delivered ?? 0})
              </Tabs.Tab>
              <Tabs.Tab value="FAILED_RETURNED" leftSection={<IconAlertTriangle size={16} />}>
                Failed / Returned ({(summary?.failed ?? 0) + (summary?.returned ?? 0) + (summary?.cancelled ?? 0)})
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {/* Search & Filter Bar */}
          <Group justify="space-between" wrap="wrap">
            <Group gap="sm" style={{ flexGrow: 1 }}>
              <TextInput
                placeholder="Search tracking ID, recipient, phone, or driver..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                style={{ minWidth: '280px', flexGrow: 1 }}
              />

              <Select
                placeholder="Store Filter"
                data={[
                  { value: '', label: 'All Stores' },
                  ...stores.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={selectedStore}
                onChange={(val) => setSelectedStore(val || '')}
                style={{ width: '180px' }}
                clearable
              />

              <Select
                placeholder="Logistics Channel"
                data={[
                  { value: '', label: 'All Logistics Channels' },
                  { value: 'INTERNAL', label: 'Store Fleet' },
                  { value: 'DUNZO', label: 'Dunzo' },
                  { value: 'SHADOWFAX', label: 'Shadowfax' },
                  { value: 'PORTER', label: 'Porter' },
                  { value: 'BLUEDART', label: 'Blue Dart' },
                  { value: 'DELHIVERY', label: 'Delhivery' },
                  { value: 'OTHER', label: 'Other Third Party' },
                ]}
                value={deliveryTypeFilter}
                onChange={(val) => setDeliveryTypeFilter(val || '')}
                style={{ width: '180px' }}
                clearable
              />
            </Group>
          </Group>

          {/* Deliveries Table */}
          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader color="brand" />
            </Group>
          ) : displayedDeliveries.length === 0 ? (
            <Paper p="xl" style={{ textAlign: 'center', backgroundColor: 'var(--bg-subtle)' }}>
              <IconTruckDelivery size={48} color="var(--mantine-color-gray-5)" style={{ margin: '0 auto' }} />
              <Title order={4} mt="sm">No deliveries found</Title>
              <Text size="sm" c="dimmed">
                No dispatch packages match your current filter criteria or pipeline tab.
              </Text>
            </Paper>
          ) : (
            <Table.ScrollContainer minWidth={950}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tracking ID &amp; Created</Table.Th>
                    <Table.Th>Recipient &amp; Destination</Table.Th>
                    <Table.Th>Order Ref</Table.Th>
                    <Table.Th>Logistics &amp; Driver</Table.Th>
                    <Table.Th>COD / Payment</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {displayedDeliveries.map((delivery) => (
                    <Table.Tr key={delivery.id}>
                      {/* Tracking ID */}
                      <Table.Td>
                        <Stack gap={2}>
                          <Group gap={6}>
                            <Text fw={700} size="sm">
                              {delivery.tracking_id}
                            </Text>
                            <CopyButton value={delivery.tracking_id} timeout={2000}>
                              {({ copied, copy }) => (
                                <Tooltip label={copied ? 'Copied' : 'Copy Tracking ID'}>
                                  <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" size="xs" onClick={copy}>
                                    {copied ? <IconCircleCheck size={12} /> : <IconCopy size={12} />}
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </CopyButton>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {new Date(delivery.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </Stack>
                      </Table.Td>

                      {/* Recipient */}
                      <Table.Td>
                        <Stack gap={1} style={{ maxWidth: '240px' }}>
                          <Text fw={600} size="sm">
                            {delivery.recipient_name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {delivery.recipient_phone}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {delivery.delivery_address}
                          </Text>
                        </Stack>
                      </Table.Td>

                      {/* Order Ref */}
                      <Table.Td>
                        {delivery.order ? (
                          <Stack gap={1}>
                            <Badge variant="outline" color="gray" size="sm">
                              {delivery.order.order_number}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              ₹{Number(delivery.order.grand_total).toFixed(2)}
                            </Text>
                          </Stack>
                        ) : (
                          <Text size="xs" c="dimmed">Direct Dispatch</Text>
                        )}
                      </Table.Td>

                      {/* Logistics & Driver */}
                      <Table.Td>
                        <Stack gap={1}>
                          <Group gap={4}>
                            <Badge size="xs" variant="light" color={delivery.delivery_type === 'INTERNAL' ? 'teal' : 'violet'}>
                              {delivery.delivery_type}
                            </Badge>
                            {delivery.delivery_partner && delivery.delivery_type !== 'INTERNAL' && (
                              <Text size="xs" fw={500}>
                                {delivery.delivery_partner}
                              </Text>
                            )}
                          </Group>
                          {delivery.driver_name ? (
                            <Text size="xs" fw={600}>
                              {delivery.driver_name} {delivery.vehicle_number ? `(${delivery.vehicle_number})` : ''}
                            </Text>
                          ) : (
                            <Text size="xs" c="dimmed" fs="italic">
                              Driver not assigned
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* COD / Payment */}
                      <Table.Td>
                        {delivery.is_cod ? (
                          <Stack gap={2}>
                            <Badge color="orange" size="sm" variant="filled">
                              COD: ₹{Number(delivery.cod_amount_due).toFixed(2)}
                            </Badge>
                            {delivery.cod_amount_collected ? (
                              <Text size="xs" c="green.7" fw={600}>
                                Paid ₹{Number(delivery.cod_amount_collected).toFixed(2)} ({delivery.cod_payment_method})
                              </Text>
                            ) : (
                              <Text size="xs" c="dimmed">Pending Collection</Text>
                            )}
                          </Stack>
                        ) : (
                          <Badge color="green" size="sm" variant="light">
                            Prepaid
                          </Badge>
                        )}
                      </Table.Td>

                      {/* Status Badge */}
                      <Table.Td>
                        {getStatusBadge(delivery.status)}
                        {delivery.failure_reason && (
                          <Text size="xs" c="red" lineClamp={1} mt={2}>
                            {delivery.failure_reason}
                          </Text>
                        )}
                      </Table.Td>

                      {/* Quick Actions */}
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Group gap={4} justify="flex-end">
                          {/* Assign Driver */}
                          {(delivery.status === 'PENDING' || delivery.status === 'ASSIGNED') && (
                            <Tooltip label="Assign / Reassign Driver">
                              <ActionIcon
                                variant="light"
                                color="brand"
                                size="sm"
                                onClick={() => setAssignDelivery(delivery)}
                              >
                                <IconSteeringWheel size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {/* Quick Dispatch */}
                          {delivery.status === 'ASSIGNED' && (
                            <Tooltip label="Dispatch (Mark Out for Delivery)">
                              <ActionIcon
                                variant="filled"
                                color="indigo"
                                size="sm"
                                loading={dispatchMutation.isPending}
                                onClick={() => dispatchMutation.mutate(delivery.id)}
                              >
                                <IconTruckDelivery size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {/* Verify OTP */}
                          {delivery.status === 'OUT_FOR_DELIVERY' && (
                            <Button
                              size="xs"
                              color="green"
                              variant="filled"
                              leftSection={<IconShieldCheck size={14} />}
                              onClick={() => setVerifyDelivery(delivery)}
                            >
                              Verify OTP
                            </Button>
                          )}

                          {/* Thermal Print Slip */}
                          <Tooltip label="Print 80mm Dispatch Slip">
                            <ActionIcon
                              variant="default"
                              size="sm"
                              onClick={() => setPrintDelivery(delivery)}
                            >
                              <IconPrinter size={16} />
                            </ActionIcon>
                          </Tooltip>

                          {/* More Status Actions Menu */}
                          <Menu shadow="md" width={180} position="bottom-end">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" size="sm">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>

                            <Menu.Dropdown>
                              <Menu.Label>Status Transition</Menu.Label>
                              {delivery.status !== 'DELIVERED' && (
                                <>
                                  <Menu.Item
                                    color="red"
                                    leftSection={<IconAlertTriangle size={14} />}
                                    onClick={() => handleOpenStatusModal(delivery, 'FAILED')}
                                  >
                                    Mark Failed
                                  </Menu.Item>
                                  <Menu.Item
                                    color="yellow"
                                    leftSection={<IconRefresh size={14} />}
                                    onClick={() => handleOpenStatusModal(delivery, 'RETURNED')}
                                  >
                                    Return to Store
                                  </Menu.Item>
                                  <Menu.Item
                                    color="gray"
                                    leftSection={<IconX size={14} />}
                                    onClick={() => handleOpenStatusModal(delivery, 'CANCELLED')}
                                  >
                                    Cancel Dispatch
                                  </Menu.Item>
                                </>
                              )}
                              <Menu.Divider />
                              <Menu.Item
                                leftSection={<IconPrinter size={14} />}
                                onClick={() => setPrintDelivery(delivery)}
                              >
                                Thermal Slip
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </Paper>

      {/* Modals */}
      <CreateDeliveryModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        defaultStoreId={selectedStore}
      />

      <AssignDriverModal
        opened={Boolean(assignDelivery)}
        onClose={() => setAssignDelivery(null)}
        delivery={assignDelivery}
      />

      <VerifyOTPModal
        opened={Boolean(verifyDelivery)}
        onClose={() => setVerifyDelivery(null)}
        delivery={verifyDelivery}
      />

      <ThermalDispatchSlipModal
        opened={Boolean(printDelivery)}
        onClose={() => setPrintDelivery(null)}
        delivery={printDelivery}
      />

      {/* Status Reason Prompt Modal */}
      <Modal
        opened={Boolean(statusModalDelivery && targetStatus)}
        onClose={() => {
          setStatusModalDelivery(null);
          setTargetStatus(null);
          setStatusReason('');
        }}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />
            <Text fw={700} size="sm">
              Confirm Status Change — {targetStatus}
            </Text>
          </Group>
        }
        size="sm"
        radius="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to transition tracking ID{' '}
            <strong>{statusModalDelivery?.tracking_id}</strong> to{' '}
            <strong>{targetStatus}</strong>?
          </Text>

          <Textarea
            label="Reason / Notes"
            placeholder="e.g. Customer unavailable after 3 attempts, address not traceable, etc."
            value={statusReason}
            onChange={(e) => setStatusReason(e.currentTarget.value)}
            minRows={2}
            required
            autoFocus
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setStatusModalDelivery(null);
                setTargetStatus(null);
                setStatusReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={updateStatusMutation.isPending}
              onClick={handleConfirmStatusUpdate}
            >
              Confirm Update
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
