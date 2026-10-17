import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBuildingStore,
  IconCash,
  IconFileInvoice,
  IconPrinter,
  IconReceipt,
  IconRotate2,
  IconUser,
} from '@tabler/icons-react';
import { useCancelInvoice, useInvoice } from '../api';
import { ThermalReceiptModal } from './ThermalReceiptModal';

interface InvoiceDetailsDrawerProps {
  invoiceId: string | null;
  opened: boolean;
  onClose: () => void;
}

export function InvoiceDetailsDrawer({ invoiceId, opened, onClose }: InvoiceDetailsDrawerProps) {
  const { data: invoice, isLoading, refetch } = useInvoice(invoiceId || undefined);
  const cancelMutation = useCancelInvoice();

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  if (!opened) return null;

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    await cancelMutation.mutateAsync(invoice.id);
    setConfirmCancelOpen(false);
    refetch();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge color="teal" variant="filled">PAID</Badge>;
      case 'CANCELLED':
        return <Badge color="red" variant="filled">CANCELLED</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge color="yellow" variant="filled">PARTIALLY PAID</Badge>;
      default:
        return <Badge color="gray" variant="filled">DRAFT</Badge>;
    }
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="xl"
        title={
          <Group gap="sm">
            <ThemeIcon color="brand" size="md" radius="md">
              <IconFileInvoice size={18} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={700} size="sm">
                {invoice?.invoice_number || 'Invoice Details'}
              </Text>
              {invoice?.created_at && (
                <Text size="xs" c="dimmed">
                  {new Date(invoice.created_at).toLocaleString('en-IN')}
                </Text>
              )}
            </Stack>
            {invoice?.status && getStatusBadge(invoice.status)}
          </Group>
        }
      >
        {isLoading ? (
          <Center py="xl">
            <Loader size="md" color="brand" />
          </Center>
        ) : !invoice ? (
          <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>
            Invoice record not found.
          </Alert>
        ) : (
          <Stack gap="lg" pb="xl">
            {/* Quick Actions Header */}
            <Paper withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <Group justify="space-between" wrap="wrap">
                <Group gap="xs">
                  <Badge variant="light" color="blue" leftSection={<IconBuildingStore size={12} />}>
                    {invoice.store?.name || 'Store'}
                  </Badge>
                  <Badge variant="outline" color="gray">
                    {invoice.type}
                  </Badge>
                  {invoice.is_tax_inclusive && (
                    <Badge variant="dot" color="teal">
                      Tax Inclusive MRP
                    </Badge>
                  )}
                </Group>

                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    color="brand"
                    leftSection={<IconPrinter size={14} />}
                    onClick={() => setReceiptOpen(true)}
                  >
                    Thermal Receipt
                  </Button>

                  {invoice.status !== 'CANCELLED' && (
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconRotate2 size={14} />}
                      onClick={() => setConfirmCancelOpen(true)}
                    >
                      Void Invoice
                    </Button>
                  )}
                </Group>
              </Group>
            </Paper>

            {/* Customer Info Pill */}
            {(invoice.customer_phone_snapshot || invoice.customer) && (
              <Paper withBorder p="sm" radius="md">
                <Group gap="sm">
                  <ThemeIcon color="cyan" size="md" radius="xl" variant="light">
                    <IconUser size={16} />
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={700}>
                      {invoice.customer_name_snapshot || invoice.customer?.name || 'Walk-in Customer'}
                    </Text>
                    <Group gap="md">
                      <Text size="xs" c="dimmed">
                        Phone: {invoice.customer_phone_snapshot || invoice.customer?.mobile_number}
                      </Text>
                      {invoice.customer_gstin_snapshot && (
                        <Text size="xs" c="dimmed">
                          GSTIN: {invoice.customer_gstin_snapshot}
                        </Text>
                      )}
                    </Group>
                  </Box>
                  {invoice.loyalty_points_redeemed > 0 && (
                    <Badge color="orange" variant="light">
                      Redeemed {invoice.loyalty_points_redeemed} Pts
                    </Badge>
                  )}
                  {invoice.loyalty_points_earned > 0 && (
                    <Badge color="teal" variant="light">
                      +{invoice.loyalty_points_earned} Pts Earned
                    </Badge>
                  )}
                </Group>
              </Paper>
            )}

            {/* Itemized Line Items Table */}
            <Paper withBorder radius="md" p="md">
              <Text fw={700} size="sm" mb="sm">
                Billed Items ({invoice.items?.length || 0})
              </Text>

              <Table striped highlightOnHover withTableBorder verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product & Details</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Discount</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>GST Slab</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Tax</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invoice.items?.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Text fw={600} size="xs">
                          {item.product_name_snapshot || item.product_name}
                        </Text>
                        <Group gap={6}>
                          {item.sku_snapshot && (
                            <Text size="10px" c="dimmed">
                              SKU: {item.sku_snapshot}
                            </Text>
                          )}
                          {item.hsn_code && (
                            <Text size="10px" c="dimmed">
                              • HSN: {item.hsn_code}
                            </Text>
                          )}
                          {item.barcode_snapshot && (
                            <Text size="10px" c="dimmed">
                              • Barcode: {item.barcode_snapshot}
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px' }}>
                        {item.quantity}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontSize: '13px' }}>
                        ₹{Number(item.unit_price).toFixed(2)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontSize: '13px', color: Number(item.discount) > 0 ? '#fa5252' : undefined }}>
                        {Number(item.discount) > 0 ? `-₹${Number(item.discount).toFixed(2)}` : '—'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontSize: '12px' }}>
                        <Badge size="xs" variant="outline" color="blue">
                          {item.tax_slab}%
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontSize: '12px' }}>
                        <Text size="xs">₹{Number(item.gst_amount).toFixed(2)}</Text>
                        {Number(item.cgst_amount) > 0 && (
                          <Text size="9px" c="dimmed">
                            (C: ₹{Number(item.cgst_amount).toFixed(2)} | S: ₹{Number(item.sgst_amount).toFixed(2)})
                          </Text>
                        )}
                        {Number(item.igst_amount) > 0 && (
                          <Text size="9px" c="dimmed">
                            (IGST: ₹{Number(item.igst_amount).toFixed(2)})
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>
                        ₹{Number(item.line_total).toFixed(2)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>

            {/* Financial Totals & Tax Split Breakdown */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Paper withBorder p="md" radius="md">
                  <Group gap="xs" mb="xs">
                    <ThemeIcon color="teal" size="sm" radius="sm">
                      <IconCash size={14} />
                    </ThemeIcon>
                    <Text fw={700} size="sm">
                      Payments & Tenders
                    </Text>
                  </Group>

                  <Stack gap="xs">
                    {invoice.payments?.length ? (
                      invoice.payments.map((p) => (
                        <Paper key={p.id} withBorder p="xs" radius="sm" style={{ backgroundColor: 'var(--bg-surface)' }}>
                          <Group justify="space-between">
                            <Badge color="teal" variant="light">
                              {p.method}
                            </Badge>
                            <Text fw={700} size="sm">
                              ₹{Number(p.amount).toFixed(2)}
                            </Text>
                          </Group>
                          {p.amount_tendered && (
                            <Group justify="space-between" mt={4}>
                              <Text size="11px" c="dimmed">Cash Tendered:</Text>
                              <Text size="11px">₹{Number(p.amount_tendered).toFixed(2)}</Text>
                            </Group>
                          )}
                          {p.change_returned && (
                            <Group justify="space-between">
                              <Text size="11px" c="dimmed">Change Returned:</Text>
                              <Text size="11px" c="teal" fw={600}>₹{Number(p.change_returned).toFixed(2)}</Text>
                            </Group>
                          )}
                          {p.external_transaction_id && (
                            <Text size="10px" c="dimmed" mt={2}>
                              Txn Ref: {p.external_transaction_id}
                            </Text>
                          )}
                        </Paper>
                      ))
                    ) : (
                      <Text size="xs" c="dimmed">
                        No payments recorded for this invoice.
                      </Text>
                    )}

                    {invoice.notes && (
                      <Box mt="xs">
                        <Text size="xs" fw={600} c="dimmed">Cashier Notes:</Text>
                        <Text size="xs">{invoice.notes}</Text>
                      </Box>
                    )}
                  </Stack>
                </Paper>

              <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <Group gap="xs" mb="xs">
                    <ThemeIcon color="brand" size="sm" radius="sm">
                      <IconReceipt size={14} />
                    </ThemeIcon>
                    <Text fw={700} size="sm">
                      Invoice Totals Summary
                    </Text>
                  </Group>

                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Gross Subtotal:</Text>
                      <Text size="xs" fw={600}>₹{Number(invoice.subtotal).toFixed(2)}</Text>
                    </Group>

                    {Number(invoice.total_discount) > 0 && (
                      <Group justify="space-between">
                        <Text size="xs" c="red">Item Discounts:</Text>
                        <Text size="xs" c="red" fw={600}>-₹{Number(invoice.total_discount).toFixed(2)}</Text>
                      </Group>
                    )}

                    {Number(invoice.loyalty_discount_amount) > 0 && (
                      <Group justify="space-between">
                        <Text size="xs" c="orange">Loyalty Points Discount:</Text>
                        <Text size="xs" c="orange" fw={600}>-₹{Number(invoice.loyalty_discount_amount).toFixed(2)}</Text>
                      </Group>
                    )}

                    <Divider my={4} variant="dashed" />

                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Total GST Collection:</Text>
                      <Text size="xs" fw={600}>₹{Number(invoice.total_gst).toFixed(2)}</Text>
                    </Group>

                    {Number(invoice.cgst_amount) > 0 && (
                      <Group justify="space-between" pl="xs">
                        <Text size="11px" c="dimmed">└ CGST:</Text>
                        <Text size="11px">₹{Number(invoice.cgst_amount).toFixed(2)}</Text>
                      </Group>
                    )}
                    {Number(invoice.sgst_amount) > 0 && (
                      <Group justify="space-between" pl="xs">
                        <Text size="11px" c="dimmed">└ SGST:</Text>
                        <Text size="11px">₹{Number(invoice.sgst_amount).toFixed(2)}</Text>
                      </Group>
                    )}
                    {Number(invoice.igst_amount) > 0 && (
                      <Group justify="space-between" pl="xs">
                        <Text size="11px" c="dimmed">└ IGST:</Text>
                        <Text size="11px">₹{Number(invoice.igst_amount).toFixed(2)}</Text>
                      </Group>
                    )}

                    {Number(invoice.round_off) !== 0 && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">Round Off Adjustment:</Text>
                        <Text size="xs">
                          {Number(invoice.round_off) > 0 ? '+' : ''}₹{Number(invoice.round_off).toFixed(2)}
                        </Text>
                      </Group>
                    )}

                    <Divider my={4} />

                    <Group justify="space-between">
                      <Text size="sm" fw={800}>Net Grand Total:</Text>
                      <Text size="lg" fw={900} c="brand">
                        ₹{Number(invoice.grand_total).toFixed(2)}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
            </SimpleGrid>
          </Stack>
        )}
      </Drawer>

      {/* Confirmation Modal to Void / Cancel Invoice */}
      <Modal
        opened={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        title={
          <Group gap="xs">
            <IconAlertCircle size={20} color="red" />
            <Text fw={700} size="sm">
              Confirm Void Invoice
            </Text>
          </Group>
        }
        radius="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to cancel invoice <strong>{invoice?.invoice_number}</strong>?
          </Text>
          <Alert color="orange" title="Operational Impact">
            • Stock for all {invoice?.items?.length || 0} line items will be automatically restocked into store inventory.
            <br />
            • Customer loyalty points earned will be revoked and redeemed points restored.
          </Alert>

          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setConfirmCancelOpen(false)}>
              Back
            </Button>
            <Button
              color="red"
              loading={cancelMutation.isPending}
              onClick={handleCancelInvoice}
            >
              Confirm Void
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Printable Thermal Receipt Modal */}
      <ThermalReceiptModal
        opened={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        invoice={invoice || null}
      />
    </>
  );
}
