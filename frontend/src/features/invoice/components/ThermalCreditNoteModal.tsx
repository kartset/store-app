import { useEffect, useRef } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Divider,
  Box,
  Paper,
  Table,
  Badge,
} from '@mantine/core';
import { IconPrinter, IconReceiptRefund } from '@tabler/icons-react';
import JsBarcode from 'jsbarcode';
import type { CreditNote } from '../types';

interface ThermalCreditNoteModalProps {
  opened: boolean;
  onClose: () => void;
  creditNote: CreditNote | null;
}

export function ThermalCreditNoteModal({ opened, onClose, creditNote }: ThermalCreditNoteModalProps) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (opened && creditNote?.credit_note_number && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, creditNote.credit_note_number, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 1.5,
          height: 38,
          displayValue: false,
          margin: 0,
        });
      } catch (err) {
        console.error('Barcode rendering error on credit note:', err);
      }
    }
  }, [opened, creditNote]);

  if (!creditNote) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(creditNote.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const customerName = creditNote.customer_name || creditNote.customer?.name || 'Walk-in Customer';
  const customerPhone = creditNote.customer_phone || creditNote.customer?.mobile_number;

  // Find store credit balance if customer mapping exists
  const currentStoreCredit = creditNote.customer?.store_mappings?.find(
    (m) => m.store_id === creditNote.store_id
  )?.store_credit_balance;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconReceiptRefund size={20} color="var(--mantine-color-red-6)" />
          <Text fw={700} size="sm">
            Credit Note Slip — {creditNote.credit_note_number}
          </Text>
        </Group>
      }
      size="md"
      radius="md"
      centered
    >
      <Stack gap="md">
        {/* Printable Paper Canvas */}
        <Paper
          id="printable-thermal-credit-note"
          withBorder
          p="md"
          style={{
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            lineHeight: 1.35,
            margin: '0 auto',
            width: '100%',
            maxWidth: '360px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderRadius: '4px',
          }}
        >
          {/* Store Header */}
          <Stack gap={2} align="center" style={{ textAlign: 'center' }}>
            <Text fw={900} size="md" style={{ letterSpacing: '0.04em' }}>
              {creditNote.store?.name || 'STORE APP RETAIL'}
            </Text>
            {creditNote.store?.address && (
              <Text size="11px" c="dimmed">
                {creditNote.store.address}
              </Text>
            )}
            {creditNote.store?.gst_number && (
              <Text size="11px" fw={700}>
                GSTIN: {creditNote.store.gst_number}
              </Text>
            )}
            {creditNote.store?.phone && (
              <Text size="11px">Ph: {creditNote.store.phone}</Text>
            )}
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed', borderColor: '#444' }} />

          {/* Title Header */}
          <Stack gap={2} align="center" style={{ textAlign: 'center' }}>
            <Badge color="red" variant="outline" size="sm">
              CREDIT NOTE / SALES RETURN
            </Badge>
            <Text fw={700} size="sm">
              {creditNote.credit_note_number}
            </Text>
            <Text size="11px" c="dimmed">
              Date: {formattedDate}
            </Text>
            <Text size="11px" fw={600}>
              Against Original Invoice: #{creditNote.invoice_number || 'N/A'}
            </Text>
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed', borderColor: '#444' }} />

          {/* Customer Info */}
          <Stack gap={1} style={{ fontSize: '11px' }}>
            <Group justify="space-between">
              <Text c="dimmed">Customer:</Text>
              <Text fw={700}>{customerName}</Text>
            </Group>
            {customerPhone && (
              <Group justify="space-between">
                <Text c="dimmed">Phone:</Text>
                <Text>{customerPhone}</Text>
              </Group>
            )}
            <Group justify="space-between">
              <Text c="dimmed">Reason:</Text>
              <Text fw={600}>{creditNote.reason}</Text>
            </Group>
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed', borderColor: '#444' }} />

          {/* Returned Items Table */}
          <Table verticalSpacing={3} horizontalSpacing={4} style={{ fontSize: '11px' }}>
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid #000' }}>
                <Table.Th style={{ textAlign: 'left', paddingLeft: 0 }}>Item</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                <Table.Th style={{ textAlign: 'right', paddingRight: 0 }}>Refund</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {creditNote.items?.map((item) => (
                <Table.Tr key={item.id} style={{ borderBottom: '0.5px dashed #ccc' }}>
                  <Table.Td style={{ paddingLeft: 0 }}>
                    <Text size="11px" fw={700} lineClamp={1}>
                      {item.product_name_snapshot || item.product_name}
                    </Text>
                    {item.hsn_code && (
                      <Text size="10px" c="dimmed">
                        HSN: {item.hsn_code}
                      </Text>
                    )}
                    {item.restock_inventory && (
                      <Text size="9px" c="teal">
                        [Restocked]
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>{item.quantity}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>₹{Number(item.unit_price).toFixed(2)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right', paddingRight: 0, fontWeight: 700 }}>
                    ₹{Number(item.refund_amount).toFixed(2)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Divider my="xs" style={{ borderStyle: 'dashed', borderColor: '#444' }} />

          {/* Tax Reversals & Totals Breakup */}
          <Stack gap={2} style={{ fontSize: '11px' }}>
            <Group justify="space-between">
              <Text>Return Subtotal:</Text>
              <Text>₹{Number(creditNote.subtotal).toFixed(2)}</Text>
            </Group>

            {Number(creditNote.total_discount_reversed) > 0 && (
              <Group justify="space-between">
                <Text c="dimmed">Discount Reversed:</Text>
                <Text c="dimmed">-₹{Number(creditNote.total_discount_reversed).toFixed(2)}</Text>
              </Group>
            )}

            {Number(creditNote.cgst_amount) > 0 && (
              <Group justify="space-between">
                <Text c="dimmed">CGST Reversed:</Text>
                <Text>₹{Number(creditNote.cgst_amount).toFixed(2)}</Text>
              </Group>
            )}
            {Number(creditNote.sgst_amount) > 0 && (
              <Group justify="space-between">
                <Text c="dimmed">SGST Reversed:</Text>
                <Text>₹{Number(creditNote.sgst_amount).toFixed(2)}</Text>
              </Group>
            )}
            {Number(creditNote.igst_amount) > 0 && (
              <Group justify="space-between">
                <Text c="dimmed">IGST Reversed:</Text>
                <Text>₹{Number(creditNote.igst_amount).toFixed(2)}</Text>
              </Group>
            )}

            <Divider my={3} style={{ borderStyle: 'solid', borderColor: '#000' }} />

            <Group justify="space-between" align="baseline">
              <Text fw={900} size="sm">
                TOTAL REFUND:
              </Text>
              <Text fw={900} size="md" c="red.7">
                ₹{Number(creditNote.total_refund_amount).toFixed(2)}
              </Text>
            </Group>

            <Divider my={3} style={{ borderStyle: 'solid', borderColor: '#000' }} />

            {/* Refund Tender Details */}
            <Group justify="space-between">
              <Text fw={700}>Refund Mode:</Text>
              <Badge color={creditNote.refund_method === 'STORE_CREDIT' ? 'teal' : 'blue'} variant="filled" size="xs">
                {creditNote.refund_method.replace('_', ' ')}
              </Badge>
            </Group>

            {creditNote.refund_method === 'STORE_CREDIT' && currentStoreCredit !== undefined && (
              <Group justify="space-between">
                <Text c="dimmed">Current Wallet Balance:</Text>
                <Text fw={700} c="teal">₹{Number(currentStoreCredit).toFixed(2)}</Text>
              </Group>
            )}

            {creditNote.loyalty_points_deducted > 0 && (
              <Group justify="space-between">
                <Text c="dimmed">Loyalty Pts Revoked:</Text>
                <Text c="orange">-{creditNote.loyalty_points_deducted} Pts</Text>
              </Group>
            )}
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed', borderColor: '#444' }} />

          {/* Barcode & Signature */}
          <Stack gap={4} align="center" style={{ textAlign: 'center' }}>
            <Box style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <svg ref={barcodeRef} style={{ width: '100%', maxWidth: '240px' }} />
            </Box>
            <Text size="9px" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              {creditNote.credit_note_number}
            </Text>
            <Text size="9px" mt={4} c="dimmed">
              * Valid for redemption or store credit within 30 days *
            </Text>
            <Text size="9px" c="dimmed">
              Authorized Signatory: _________________________
            </Text>
          </Stack>
        </Paper>

        {/* Action Buttons */}
        <Group justify="space-between">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button
            color="brand"
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            Print Credit Note (80mm)
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
