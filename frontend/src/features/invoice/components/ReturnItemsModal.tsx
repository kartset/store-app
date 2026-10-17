import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCoin,
  IconCreditCard,
  IconReceiptRefund,
  IconRotate2,
  IconWallet,
} from '@tabler/icons-react';
import { useProcessReturn } from '../api';
import type {
  CreditNote,
  Invoice,
  ProcessReturnPayload,
  RefundMethod,
  ReturnReason,
} from '../types';

interface ReturnItemsModalProps {
  opened: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess: (creditNote: CreditNote) => void;
}

interface ItemReturnState {
  quantity: number;
  reason: ReturnReason;
  restock_inventory: boolean;
}

const REASON_OPTIONS = [
  { value: 'DEFECTIVE', label: 'Defective / Damaged Product' },
  { value: 'WRONG_ITEM', label: 'Wrong Item / Size / Color' },
  { value: 'EXPIRED', label: 'Near Expiry or Expired' },
  { value: 'CUSTOMER_DISSATISFACTION', label: 'Customer Dissatisfaction' },
  { value: 'OTHER', label: 'Other / Exchange' },
];

export function ReturnItemsModal({ opened, onClose, invoice, onSuccess }: ReturnItemsModalProps) {
  const processReturnMutation = useProcessReturn();

  // State mapping: invoice_item_id -> ItemReturnState
  const [itemStates, setItemStates] = useState<Record<string, ItemReturnState>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH');
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset or initialize when invoice changes
  const returnableItems = useMemo(() => {
    if (!invoice?.items) return [];
    return invoice.items.map((item) => {
      const alreadyReturned = item.returned_quantity ?? 0;
      const returnable = item.returnable_quantity ?? Math.max(0, item.quantity - alreadyReturned);
      return {
        ...item,
        alreadyReturned,
        returnable,
      };
    });
  }, [invoice]);

  const handleQtyChange = (itemId: string, qty: number) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {
          reason: 'CUSTOMER_DISSATISFACTION',
          restock_inventory: true,
        }),
        quantity: Math.max(0, qty),
      },
    }));
  };

  const handleReasonChange = (itemId: string, reason: ReturnReason) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {
          quantity: 0,
          restock_inventory: true,
        }),
        reason,
      },
    }));
  };

  const handleRestockChange = (itemId: string, restock: boolean) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {
          quantity: 0,
          reason: 'CUSTOMER_DISSATISFACTION',
        }),
        restock_inventory: restock,
      },
    }));
  };

  // Live Calculations
  const summary = useMemo(() => {
    if (!invoice) {
      return {
        selectedCount: 0,
        subtotal: 0,
        discountReversed: 0,
        gstReversed: 0,
        cgstReversed: 0,
        sgstReversed: 0,
        igstReversed: 0,
        netRefund: 0,
        estimatedPointsRevoked: 0,
      };
    }

    let selectedCount = 0;
    let subtotal = 0;
    let discountReversed = 0;
    let gstReversed = 0;
    let cgstReversed = 0;
    let sgstReversed = 0;
    let igstReversed = 0;
    let netRefund = 0;

    returnableItems.forEach((item) => {
      const state = itemStates[item.id];
      const returnQty = state?.quantity || 0;
      if (returnQty > 0 && item.quantity > 0) {
        selectedCount += 1;
        const ratio = returnQty / item.quantity;
        const itemLineTotal = Number(item.line_total) * ratio;
        const itemDiscount = Number(item.discount) * ratio;
        const itemCgst = Number(item.cgst_amount) * ratio;
        const itemSgst = Number(item.sgst_amount) * ratio;
        const itemIgst = Number(item.igst_amount) * ratio;
        const itemGst = Number(item.gst_amount) * ratio;

        subtotal += Number(item.unit_price) * returnQty;
        discountReversed += itemDiscount;
        cgstReversed += itemCgst;
        sgstReversed += itemSgst;
        igstReversed += itemIgst;
        gstReversed += itemGst;
        netRefund += itemLineTotal;
      }
    });

    const grandTotal = Number(invoice.grand_total) || 1;
    const estimatedPointsRevoked = invoice.loyalty_points_earned > 0
      ? Math.floor((netRefund / grandTotal) * invoice.loyalty_points_earned)
      : 0;

    return {
      selectedCount,
      subtotal,
      discountReversed,
      gstReversed,
      cgstReversed,
      sgstReversed,
      igstReversed,
      netRefund,
      estimatedPointsRevoked,
    };
  }, [invoice, returnableItems, itemStates]);

  const hasCustomerAccount = Boolean(invoice?.customer_id || invoice?.customer);

  const handleSubmitReturn = async () => {
    if (!invoice) return;
    setErrorMsg(null);

    const payloadItems = returnableItems
      .filter((item) => (itemStates[item.id]?.quantity || 0) > 0)
      .map((item) => ({
        invoice_item_id: item.id,
        quantity: itemStates[item.id].quantity,
        reason: itemStates[item.id].reason || 'CUSTOMER_DISSATISFACTION',
        restock_inventory: itemStates[item.id].restock_inventory ?? true,
      }));

    if (payloadItems.length === 0) {
      setErrorMsg('Please specify a return quantity of at least 1 for one or more items.');
      return;
    }

    if (refundMethod === 'STORE_CREDIT' && !hasCustomerAccount) {
      setErrorMsg('Store Credit refund requires a customer account attached to the invoice.');
      return;
    }

    const payload: ProcessReturnPayload = {
      items: payloadItems,
      refund_method: refundMethod,
      reason: payloadItems[0]?.reason || 'CUSTOMER_DISSATISFACTION',
      notes: generalNotes.trim() || undefined,
    };

    try {
      const creditNote = await processReturnMutation.mutateAsync({
        invoiceId: invoice.id,
        payload,
      });

      onClose();
      onSuccess(creditNote);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to process return. Please check returnable limits and cash register state.';
      setErrorMsg(errMsg);
    }
  };

  if (!invoice) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon color="red" size="md" radius="md">
            <IconRotate2 size={18} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text fw={700} size="sm">
              Process Sales Return & Credit Note
            </Text>
            <Text size="xs" c="dimmed">
              Invoice #{invoice.invoice_number} • {new Date(invoice.created_at).toLocaleDateString('en-IN')}
            </Text>
          </Stack>
        </Group>
      }
      size="90%"
      radius="md"
      centered
    >
      <Stack gap="lg">
        {errorMsg && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            title="Return Processing Error"
            withCloseButton
            onClose={() => setErrorMsg(null)}
          >
            {errorMsg}
          </Alert>
        )}

        {/* Customer & Store Info Banner */}
        <Paper withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between" wrap="wrap">
            <Group gap="md">
              <Box>
                <Text size="xs" c="dimmed">
                  Customer
                </Text>
                <Text size="sm" fw={700}>
                  {invoice.customer_name_snapshot || invoice.customer?.name || 'Walk-in Customer'}
                </Text>
                {(invoice.customer_phone_snapshot || invoice.customer?.mobile_number) && (
                  <Text size="xs" c="dimmed">
                    {invoice.customer_phone_snapshot || invoice.customer?.mobile_number}
                  </Text>
                )}
              </Box>
              <Divider orientation="vertical" />
              <Box>
                <Text size="xs" c="dimmed">
                  Store
                </Text>
                <Text size="sm" fw={600}>
                  {invoice.store?.name || 'Store'}
                </Text>
              </Box>
            </Group>

            <Group gap="xs">
              <Badge color="teal" variant="light">
                Original Bill: ₹{Number(invoice.grand_total).toFixed(2)}
              </Badge>
              {invoice.loyalty_points_earned > 0 && (
                <Badge color="orange" variant="light">
                  {invoice.loyalty_points_earned} Loyalty Pts Awarded
                </Badge>
              )}
            </Group>
          </Group>
        </Paper>

        {/* Return Items Selection Table */}
        <Paper withBorder radius="md" p="md">
          <Text fw={700} size="sm" mb="xs">
            Select Items to Return
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            Enter the return quantity and reason for each item. Restock will return inventory to shelf immediately.
          </Text>

          <Table striped highlightOnHover withTableBorder verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Unit Price</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Billed Qty</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Already Returned</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Returnable</Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'center' }}>Return Qty</Table.Th>
                <Table.Th style={{ width: 220 }}>Reason</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Restock</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Refund Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {returnableItems.map((item) => {
                const currentState = itemStates[item.id] || {
                  quantity: 0,
                  reason: 'CUSTOMER_DISSATISFACTION',
                  restock_inventory: true,
                };
                const returnQty = currentState.quantity;
                const isItemReturnable = item.returnable > 0;
                const itemRefundEst =
                  item.quantity > 0
                    ? ((Number(item.line_total) / item.quantity) * returnQty).toFixed(2)
                    : '0.00';

                return (
                  <Table.Tr
                    key={item.id}
                    style={{
                      opacity: isItemReturnable ? 1 : 0.5,
                      backgroundColor: returnQty > 0 ? 'var(--mantine-color-red-0)' : undefined,
                    }}
                  >
                    <Table.Td>
                      <Text fw={600} size="sm">
                        {item.product_name_snapshot || item.product_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        SKU: {item.sku_snapshot || item.product_sku || 'N/A'} • HSN: {item.hsn_code || 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      ₹{Number(item.unit_price).toFixed(2)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>{item.quantity}</Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {item.alreadyReturned > 0 ? (
                        <Badge color="orange" size="sm" variant="light">
                          {item.alreadyReturned}
                        </Badge>
                      ) : (
                        '0'
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge color={isItemReturnable ? 'teal' : 'gray'} size="sm" variant="filled">
                        {item.returnable}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        min={0}
                        max={item.returnable}
                        value={returnQty}
                        onChange={(val) => handleQtyChange(item.id, Number(val) || 0)}
                        disabled={!isItemReturnable}
                        styles={{ input: { textAlign: 'center', fontWeight: 700 } }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        data={REASON_OPTIONS}
                        value={currentState.reason}
                        onChange={(val) => handleReasonChange(item.id, (val as ReturnReason) || 'CUSTOMER_DISSATISFACTION')}
                        disabled={returnQty === 0}
                      />
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Checkbox
                        size="sm"
                        checked={currentState.restock_inventory}
                        onChange={(e) => handleRestockChange(item.id, e.currentTarget.checked)}
                        disabled={returnQty === 0}
                        style={{ display: 'inline-flex' }}
                      />
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{itemRefundEst}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Refund Tender Method & Notes */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Paper withBorder radius="md" p="md">
            <Text fw={700} size="sm" mb="xs">
              Refund Tender Method
            </Text>
            <Radio.Group
              value={refundMethod}
              onChange={(val) => setRefundMethod(val as RefundMethod)}
            >
              <Stack gap="xs" mt="xs">
                <Radio
                  value="CASH"
                  label={
                    <Group gap="xs">
                      <ThemeIcon color="green" size="sm" variant="light">
                        <IconCoin size={14} />
                      </ThemeIcon>
                      <Box>
                        <Text size="sm" fw={600}>
                          Cash Drawer Outflow
                        </Text>
                        <Text size="xs" c="dimmed">
                          Refunds cash directly from currently open register session
                        </Text>
                      </Box>
                    </Group>
                  }
                />
                <Radio
                  value="STORE_CREDIT"
                  disabled={!hasCustomerAccount}
                  label={
                    <Group gap="xs">
                      <ThemeIcon color="teal" size="sm" variant="light">
                        <IconWallet size={14} />
                      </ThemeIcon>
                      <Box>
                        <Text size="sm" fw={600}>
                          Store Credit / Customer Wallet
                        </Text>
                        <Text size="xs" c="dimmed">
                          {hasCustomerAccount
                            ? 'Credits balance to customer profile for future checkout redemption'
                            : 'Unavailable: requires registered customer on invoice'}
                        </Text>
                      </Box>
                    </Group>
                  }
                />
                <Radio
                  value="UPI"
                  label={
                    <Group gap="xs">
                      <ThemeIcon color="blue" size="sm" variant="light">
                        <IconCreditCard size={14} />
                      </ThemeIcon>
                      <Box>
                        <Text size="sm" fw={600}>
                          UPI / Digital Refund
                        </Text>
                        <Text size="xs" c="dimmed">
                          Transfers refund via merchant UPI / payment gateway
                        </Text>
                      </Box>
                    </Group>
                  }
                />
              </Stack>
            </Radio.Group>

            <Divider my="sm" />

            <Textarea
              label="Return Notes / Reason Explanation"
              placeholder="e.g. Customer returned shirt due to size mismatch; box sealed."
              size="xs"
              minRows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.currentTarget.value)}
            />
          </Paper>

          {/* Refund Financial Summary Box */}
          <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Text fw={700} size="sm" mb="sm">
              Refund & Tax Reversal Summary
            </Text>

            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Items Selected:
                </Text>
                <Text size="sm" fw={600}>
                  {summary.selectedCount} line item(s)
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Subtotal:
                </Text>
                <Text size="sm" fw={600}>
                  ₹{summary.subtotal.toFixed(2)}
                </Text>
              </Group>

              {summary.discountReversed > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Discount Reversed:
                  </Text>
                  <Text size="sm" c="dimmed">
                    -₹{summary.discountReversed.toFixed(2)}
                  </Text>
                </Group>
              )}

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  GST Reversal (Intra/Inter state):
                </Text>
                <Text size="sm" fw={600}>
                  ₹{summary.gstReversed.toFixed(2)}
                </Text>
              </Group>

              {summary.estimatedPointsRevoked > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="orange.7">
                    Loyalty Points Revocation:
                  </Text>
                  <Text size="sm" fw={600} c="orange.7">
                    -{summary.estimatedPointsRevoked} Pts
                  </Text>
                </Group>
              )}

              <Divider my="xs" />

              <Group justify="space-between" align="baseline">
                <Text size="md" fw={900}>
                  TOTAL NET REFUND:
                </Text>
                <Text size="xl" fw={900} c="red.7">
                  ₹{summary.netRefund.toFixed(2)}
                </Text>
              </Group>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Modal Actions */}
        <Group justify="space-between" mt="md">
          <Button variant="default" onClick={onClose} disabled={processReturnMutation.isPending}>
            Cancel
          </Button>

          <Button
            color="red"
            size="md"
            leftSection={<IconReceiptRefund size={18} />}
            disabled={summary.selectedCount === 0 || summary.netRefund <= 0}
            loading={processReturnMutation.isPending}
            onClick={handleSubmitReturn}
          >
            Process Return & Generate Credit Note (₹{summary.netRefund.toFixed(2)})
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
