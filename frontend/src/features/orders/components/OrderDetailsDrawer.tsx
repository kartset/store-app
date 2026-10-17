import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBoxSeam,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconFileInvoice,
  IconMapPin,
  IconPhone,
  IconReceipt,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import {
  useConfirmOrder,
  usePackOrder,
  useReadyOrder,
  useCancelOrder,
} from '../api';
import type { Order } from '../types';

interface OrderDetailsDrawerProps {
  opened: boolean;
  onClose: () => void;
  order: Order | null;
  onOpenConvertModal: (order: Order) => void;
  onViewInvoice?: (invoiceId: string) => void;
}

export function OrderDetailsDrawer({
  opened,
  onClose,
  order,
  onOpenConvertModal,
  onViewInvoice,
}: OrderDetailsDrawerProps) {
  const [cancelModalOpened, setCancelModalOpened] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const confirmMutation = useConfirmOrder();
  const packMutation = usePackOrder();
  const readyMutation = useReadyOrder();
  const cancelMutation = useCancelOrder();

  if (!order) return null;

  const grandTotal = Number(order.grand_total) || 0;
  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.total_discount) || 0;
  const tax = Number(order.total_tax) || 0;

  const handleConfirm = async () => {
    setActionError(null);
    try {
      await confirmMutation.mutateAsync(order.id);
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || err?.message || 'Failed to confirm order.');
    }
  };

  const handlePack = async () => {
    setActionError(null);
    try {
      await packMutation.mutateAsync(order.id);
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || err?.message || 'Failed to pack order.');
    }
  };

  const handleReady = async () => {
    setActionError(null);
    try {
      await readyMutation.mutateAsync(order.id);
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || err?.message || 'Failed to mark ready.');
    }
  };

  const handleCancelSubmit = async () => {
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({ orderId: order.id, reason: cancelReason });
      setCancelModalOpened(false);
      setCancelReason('');
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || err?.message || 'Failed to cancel order.');
    }
  };

  // Determine timeline active step
  let activeStep = 0;
  if (order.status === 'CONFIRMED') activeStep = 1;
  else if (order.status === 'PACKED') activeStep = 2;
  else if (order.status === 'READY_FOR_PICKUP') activeStep = 3;
  else if (order.status === 'COMPLETED') activeStep = 4;

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="xs">
            <ThemeIcon size={32} radius="md" color="brand" variant="light">
              <IconBoxSeam size={18} />
            </ThemeIcon>
            <Box>
              <Group gap="xs">
                <Text fw={800} size="lg">
                  {order.order_number}
                </Text>
                <Badge
                  color={
                    order.status === 'COMPLETED'
                      ? 'teal'
                      : order.status === 'READY_FOR_PICKUP'
                      ? 'blue'
                      : order.status === 'PACKED'
                      ? 'indigo'
                      : order.status === 'CONFIRMED'
                      ? 'cyan'
                      : order.status === 'CANCELLED'
                      ? 'gray'
                      : 'yellow'
                  }
                  variant="filled"
                  size="sm"
                >
                  {order.status.replace('_', ' ')}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {order.store?.name || 'Retail Branch'} • Placed{' '}
                {new Date(order.created_at).toLocaleString()}
              </Text>
            </Box>
          </Group>
        }
        position="right"
        size="lg"
      >
        <Stack gap="lg" pb="xl">
          {actionError && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Action Failed"
              color="red"
              variant="filled"
              withCloseButton
              onClose={() => setActionError(null)}
            >
              {actionError}
            </Alert>
          )}

          {/* Quick Action Bar */}
          <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-gray-0)">
            <Group justify="space-between" wrap="wrap">
              <Box>
                <Text size="xs" c="dimmed">
                  Grand Total
                </Text>
                <Text size="xl" fw={900} c="brand">
                  ₹{grandTotal.toFixed(2)}
                </Text>
              </Box>

              <Group gap="xs">
                {order.status === 'PENDING' && (
                  <Button
                    color="brand"
                    size="sm"
                    leftSection={<IconCheck size={16} />}
                    loading={confirmMutation.isPending}
                    onClick={handleConfirm}
                  >
                    Confirm Order
                  </Button>
                )}

                {order.status === 'CONFIRMED' && (
                  <Button
                    color="indigo"
                    size="sm"
                    leftSection={<IconBoxSeam size={16} />}
                    loading={packMutation.isPending}
                    onClick={handlePack}
                  >
                    Pack Items
                  </Button>
                )}

                {order.status === 'PACKED' && (
                  <Button
                    color="teal"
                    size="sm"
                    leftSection={<IconTruck size={16} />}
                    loading={readyMutation.isPending}
                    onClick={handleReady}
                  >
                    Mark Ready
                  </Button>
                )}

                {['CONFIRMED', 'PACKED', 'READY_FOR_PICKUP'].includes(order.status) && (
                  <Button
                    color="violet"
                    variant="filled"
                    size="sm"
                    leftSection={<IconFileInvoice size={16} />}
                    onClick={() => onOpenConvertModal(order)}
                  >
                    Convert to Invoice
                  </Button>
                )}

                {order.status === 'COMPLETED' && order.invoice_id && (
                  <Button
                    color="teal"
                    variant="light"
                    size="sm"
                    leftSection={<IconReceipt size={16} />}
                    onClick={() => onViewInvoice?.(order.invoice_id!)}
                  >
                    View Invoice {order.invoice_number || ''}
                  </Button>
                )}

                {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                  <Button
                    color="red"
                    variant="subtle"
                    size="sm"
                    leftSection={<IconX size={16} />}
                    onClick={() => setCancelModalOpened(true)}
                  >
                    Cancel
                  </Button>
                )}
              </Group>
            </Group>
          </Paper>

          {/* Fulfillment Lifecycle Timeline */}
          <Paper p="md" radius="md" withBorder>
            <Text size="xs" fw={700} c="dimmed" mb="md" style={{ textTransform: 'uppercase' }}>
              Fulfillment Journey
            </Text>

            {order.status === 'CANCELLED' ? (
              <Alert icon={<IconX size={16} />} title="Order Cancelled" color="gray" variant="light">
                <Text size="xs">
                  Cancelled on {order.cancelled_at ? new Date(order.cancelled_at).toLocaleString() : 'N/A'}
                </Text>
                {order.cancellation_reason && (
                  <Text size="xs" fw={600} mt={4}>
                    Reason: {order.cancellation_reason}
                  </Text>
                )}
              </Alert>
            ) : (
              <Timeline active={activeStep} bulletSize={24} lineWidth={2}>
                <Timeline.Item
                  bullet={<IconClock size={12} />}
                  title="Order Placed"
                >
                  <Text size="xs" c="dimmed">
                    {new Date(order.created_at).toLocaleString()}
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={<IconCheck size={12} />}
                  title="Order Confirmed"
                >
                  <Text size="xs" c="dimmed">
                    {order.confirmed_at
                      ? new Date(order.confirmed_at).toLocaleString()
                      : 'Pending confirmation by store team'}
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={<IconBoxSeam size={12} />}
                  title="Packed & Inspected"
                >
                  <Text size="xs" c="dimmed">
                    {order.packed_at
                      ? new Date(order.packed_at).toLocaleString()
                      : 'Awaiting packing and label generation'}
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={<IconTruck size={12} />}
                  title="Ready for Pickup / Out for Delivery"
                >
                  <Text size="xs" c="dimmed">
                    {order.ready_at
                      ? new Date(order.ready_at).toLocaleString()
                      : 'Staged for counter collection or carrier pickup'}
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={<IconCircleCheck size={12} />}
                  title="Completed & Invoiced"
                >
                  <Text size="xs" c="dimmed">
                    {order.completed_at
                      ? `Converted to Invoice ${order.invoice_number || ''} on ${new Date(
                          order.completed_at
                        ).toLocaleString()}`
                      : 'Awaiting customer handover & invoice conversion'}
                  </Text>
                </Timeline.Item>
              </Timeline>
            )}
          </Paper>

          {/* Customer & Shipping Details */}
          <Paper p="md" radius="md" withBorder>
            <Text size="xs" fw={700} c="dimmed" mb="sm" style={{ textTransform: 'uppercase' }}>
              Customer & Delivery Coordinates
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Box>
                <Text size="xs" c="dimmed">
                  Recipient Name
                </Text>
                <Text size="sm" fw={700}>
                  {order.customer_name_snapshot || 'Walk-in Customer'}
                </Text>

                <Group gap={4} mt={6}>
                  <IconPhone size={14} color="gray" />
                  <Text size="xs">{order.customer_phone_snapshot || 'No phone provided'}</Text>
                </Group>
              </Box>

              <Box>
                <Text size="xs" c="dimmed">
                  Fulfillment Method
                </Text>
                <Badge
                  color={
                    order.fulfillment_type === 'STORE_PICKUP'
                      ? 'cyan'
                      : order.fulfillment_type === 'HOME_DELIVERY'
                      ? 'grape'
                      : 'orange'
                  }
                  variant="light"
                  size="sm"
                  mt={2}
                >
                  {order.fulfillment_type.replace('_', ' ')}
                </Badge>

                {order.delivery_address_line1 && (
                  <Group gap={4} align="flex-start" mt={8}>
                    <IconMapPin size={14} color="gray" style={{ marginTop: 2 }} />
                    <Text size="xs">
                      {order.delivery_address_line1}
                      {order.delivery_address_line2 ? `, ${order.delivery_address_line2}` : ''}
                      {order.delivery_city ? `, ${order.delivery_city}` : ''}
                      {order.delivery_state ? `, ${order.delivery_state}` : ''}
                      {order.delivery_pincode ? ` - ${order.delivery_pincode}` : ''}
                    </Text>
                  </Group>
                )}

                {order.delivery_notes && (
                  <Text size="xs" c="dimmed" fs="italic" mt={4}>
                    Notes: {order.delivery_notes}
                  </Text>
                )}
              </Box>
            </SimpleGrid>
          </Paper>

          {/* Line Items Table */}
          <Paper p="md" radius="md" withBorder>
            <Text size="xs" fw={700} c="dimmed" mb="sm" style={{ textTransform: 'uppercase' }}>
              Line Items ({order.items?.length || 0})
            </Text>

            <Table striped withTableBorder style={{ fontSize: '12px' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Unit Price</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Discount</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {order.items?.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text size="xs" fw={600}>
                        {item.product_name_snapshot || item.product_name}
                      </Text>
                      <Text size="10px" c="dimmed">
                        SKU: {item.sku_snapshot || item.product_sku || 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge size="xs" variant="light">
                        x{item.quantity}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      ₹{Number(item.unit_price).toFixed(2)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'red' }}>
                      {Number(item.discount) > 0 ? `-₹${Number(item.discount).toFixed(2)}` : '—'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{Number(item.line_total).toFixed(2)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Divider my="sm" />

            {/* Financial Summary */}
            <Stack gap={4} align="flex-end">
              <Group justify="space-between" style={{ width: '220px' }}>
                <Text size="xs" c="dimmed">
                  Subtotal:
                </Text>
                <Text size="xs" fw={600}>
                  ₹{subtotal.toFixed(2)}
                </Text>
              </Group>

              {discount > 0 && (
                <Group justify="space-between" style={{ width: '220px' }}>
                  <Text size="xs" c="red">
                    Discount:
                  </Text>
                  <Text size="xs" c="red" fw={600}>
                    -₹{discount.toFixed(2)}
                  </Text>
                </Group>
              )}

              <Group justify="space-between" style={{ width: '220px' }}>
                <Text size="xs" c="dimmed">
                  Taxes (GST):
                </Text>
                <Text size="xs" fw={600}>
                  ₹{tax.toFixed(2)}
                </Text>
              </Group>

              <Group justify="space-between" style={{ width: '220px', borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
                <Text size="sm" fw={800}>
                  Grand Total:
                </Text>
                <Text size="md" fw={900} c="brand">
                  ₹{grandTotal.toFixed(2)}
                </Text>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Drawer>

      {/* Cancellation Reason Modal */}
      <Modal
        opened={cancelModalOpened}
        onClose={() => setCancelModalOpened(false)}
        title="Cancel Order"
        size="sm"
        radius="md"
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Please enter a reason for cancelling Order {order.order_number}.
          </Text>
          <Textarea
            label="Cancellation Reason"
            placeholder="e.g. Customer cancelled on phone, item out of stock..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
            required
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => setCancelModalOpened(false)}>
              Keep Order
            </Button>
            <Button
              color="red"
              size="xs"
              loading={cancelMutation.isPending}
              onClick={handleCancelSubmit}
            >
              Confirm Cancellation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
