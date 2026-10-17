import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Radio,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconCoin,
  IconCreditCard,
  IconReceipt,
  IconQrcode,
  IconWallet,
} from '@tabler/icons-react';
import { useConvertToInvoice } from '../api';
import type { Order, OrderConvertToInvoicePayload } from '../types';

interface ConvertToInvoiceModalProps {
  opened: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: (data: { order: Order; invoice: any; message: string }) => void;
}

export function ConvertToInvoiceModal({
  opened,
  onClose,
  order,
  onSuccess,
}: ConvertToInvoiceModalProps) {
  const [paymentOption, setPaymentOption] = useState<'PAID' | 'UNPAID'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'STORE_CREDIT'>('CASH');
  const [tenderedAmount, setTenderedAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const convertMutation = useConvertToInvoice();

  if (!order) return null;

  const grandTotal = Number(order.grand_total) || 0;
  const changeDue =
    paymentMethod === 'CASH' && typeof tenderedAmount === 'number'
      ? Math.max(0, tenderedAmount - grandTotal)
      : 0;

  const handleConvert = async () => {
    setErrorMsg(null);
    try {
      const payload: OrderConvertToInvoicePayload = {
        notes,
      };

      if (paymentOption === 'PAID') {
        payload.payment_method = paymentMethod;
        payload.payment_amount = grandTotal;
      }

      const result = await convertMutation.mutateAsync({
        orderId: order.id,
        payload,
      });

      onSuccess(result);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string' ? err.response.data : null) ||
        err?.message ||
        'Failed to convert order to invoice. Please check stock availability.';
      setErrorMsg(msg);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size={28} radius="md" color="brand" variant="light">
            <IconReceipt size={16} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="md">
              Convert Order to Invoice
            </Text>
            <Text size="xs" c="dimmed">
              Order {order.order_number} • {order.store?.name || 'Retail Branch'}
            </Text>
          </Box>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        {errorMsg && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Conversion Error"
            color="red"
            variant="filled"
            withCloseButton
            onClose={() => setErrorMsg(null)}
          >
            {errorMsg}
          </Alert>
        )}

        {/* Order Summary Header Card */}
        <Paper
          p="md"
          radius="md"
          style={{
            backgroundColor: 'var(--mantine-color-gray-0)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Box>
              <Text size="xs" c="dimmed">
                Customer
              </Text>
              <Text size="sm" fw={700}>
                {order.customer_name_snapshot || 'Walk-in Customer'}
              </Text>
              <Text size="xs" c="dimmed">
                {order.customer_phone_snapshot}
              </Text>
            </Box>

            <Box>
              <Text size="xs" c="dimmed">
                Fulfillment Type
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
            </Box>

            <Box>
              <Text size="xs" c="dimmed">
                Items Count
              </Text>
              <Text size="sm" fw={700}>
                {order.items?.length || order.items_count || 0} Products
              </Text>
            </Box>

            <Box>
              <Text size="xs" c="dimmed">
                Order Amount
              </Text>
              <Text size="lg" fw={800} c="brand">
                ₹{grandTotal.toFixed(2)}
              </Text>
            </Box>
          </SimpleGrid>
        </Paper>

        {/* Line Items Table */}
        {order.items && order.items.length > 0 && (
          <Box>
            <Text size="xs" fw={700} c="dimmed" mb={4} style={{ textTransform: 'uppercase' }}>
              Line Items & Stock Check
            </Text>
            <Table
              striped
              highlightOnHover
              withTableBorder
              withColumnBorders={false}
              style={{ fontSize: '12px' }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Line Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {order.items.map((item) => (
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
                    <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ₹{Number(item.line_total).toFixed(2)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}

        <Divider />

        {/* Payment Options */}
        <Box>
          <Text size="sm" fw={700} mb="xs">
            Payment & Settlement Status
          </Text>

          <Radio.Group
            value={paymentOption}
            onChange={(val) => setPaymentOption(val as 'PAID' | 'UNPAID')}
            mb="md"
          >
            <Group gap="lg">
              <Radio
                value="PAID"
                label={
                  <Box>
                    <Text size="sm" fw={600}>
                      Collect Payment Now (Paid Invoice)
                    </Text>
                    <Text size="xs" c="dimmed">
                      Invoice marked PAID, registers cash/card/UPI tender
                    </Text>
                  </Box>
                }
              />
              <Radio
                value="UNPAID"
                label={
                  <Box>
                    <Text size="sm" fw={600}>
                      Leave as Unpaid / Draft Invoice
                    </Text>
                    <Text size="xs" c="dimmed">
                      Payment will be collected upon customer pickup or delivery
                    </Text>
                  </Box>
                }
              />
            </Group>
          </Radio.Group>

          {paymentOption === 'PAID' && (
            <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-gray-0)">
              <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase' }}>
                Select Payment Tender
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="sm">
                <Button
                  variant={paymentMethod === 'CASH' ? 'filled' : 'default'}
                  color="teal"
                  size="sm"
                  leftSection={<IconCoin size={16} />}
                  onClick={() => setPaymentMethod('CASH')}
                >
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'UPI' ? 'filled' : 'default'}
                  color="brand"
                  size="sm"
                  leftSection={<IconQrcode size={16} />}
                  onClick={() => setPaymentMethod('UPI')}
                >
                  UPI / QR
                </Button>
                <Button
                  variant={paymentMethod === 'CARD' ? 'filled' : 'default'}
                  color="indigo"
                  size="sm"
                  leftSection={<IconCreditCard size={16} />}
                  onClick={() => setPaymentMethod('CARD')}
                >
                  Card
                </Button>
                <Button
                  variant={paymentMethod === 'STORE_CREDIT' ? 'filled' : 'default'}
                  color="orange"
                  size="sm"
                  leftSection={<IconWallet size={16} />}
                  onClick={() => setPaymentMethod('STORE_CREDIT')}
                >
                  Store Credit
                </Button>
              </SimpleGrid>

              {paymentMethod === 'CASH' && (
                <Group grow align="flex-start" mt="xs">
                  <NumberInput
                    label="Amount Tendered"
                    placeholder={`₹${grandTotal.toFixed(2)}`}
                    prefix="₹"
                    min={0}
                    value={tenderedAmount}
                    onChange={(val) => setTenderedAmount(typeof val === 'number' ? val : '')}
                    size="sm"
                  />
                  <Paper p="xs" radius="md" withBorder bg="white">
                    <Text size="xs" c="dimmed">
                      Change Due to Customer
                    </Text>
                    <Text size="lg" fw={800} c={changeDue > 0 ? 'teal' : 'dimmed'}>
                      ₹{changeDue.toFixed(2)}
                    </Text>
                  </Paper>
                </Group>
              )}
            </Paper>
          )}
        </Box>

        {/* Conversion Notes */}
        <Textarea
          label="Conversion Notes"
          placeholder="Optional fulfillment or delivery reference..."
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          size="sm"
          rows={2}
        />

        <Divider />

        {/* Modal Actions */}
        <Group justify="space-between" mt="xs">
          <Button variant="default" onClick={onClose} disabled={convertMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="brand"
            leftSection={<IconCheck size={16} />}
            loading={convertMutation.isPending}
            onClick={handleConvert}
          >
            Confirm & Convert to Invoice
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
