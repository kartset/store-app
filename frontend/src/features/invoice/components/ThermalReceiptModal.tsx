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
} from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import JsBarcode from 'jsbarcode';
import type { Invoice } from '../types';

interface ThermalReceiptModalProps {
  opened: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export function ThermalReceiptModal({ opened, onClose, invoice }: ThermalReceiptModalProps) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (opened && invoice && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, invoice.invoice_number, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 1.5,
          height: 38,
          displayValue: false,
          margin: 0,
        });
      } catch (err) {
        console.error('Barcode rendering error:', err);
      }
    }
  }, [opened, invoice]);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(invoice.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPrinter size={18} color="var(--brand-primary)" />
          <Text fw={700} size="sm">
            Thermal POS Receipt — {invoice.invoice_number}
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
          id="printable-thermal-receipt"
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
              {invoice.store?.name || 'STORE APP RETAIL'}
            </Text>
            {invoice.store?.address && (
              <Text size="11px" c="dimmed">
                {invoice.store.address}
              </Text>
            )}
            {invoice.store?.gst_number && (
              <Text size="11px" fw={700}>
                GSTIN: {invoice.store.gst_number}
              </Text>
            )}
          </Stack>

          <Divider my={8} variant="dashed" />

          {/* Invoice Metadata */}
          <Box style={{ fontSize: '11px' }}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={700}>INV #: {invoice.invoice_number}</Text>
              <Text>{invoice.type}</Text>
            </Group>
            <Group justify="space-between" wrap="nowrap">
              <Text>DATE: {formattedDate}</Text>
              <Text fw={700} c={invoice.status === 'PAID' ? 'teal' : 'orange'}>
                [{invoice.status}]
              </Text>
            </Group>
            {(invoice.customer_phone_snapshot || invoice.customer?.mobile_number) && (
              <Group justify="space-between" wrap="nowrap" mt={2}>
                <Text>CUST: {invoice.customer_name_snapshot || invoice.customer?.name || 'Walk-in'}</Text>
                <Text>{invoice.customer_phone_snapshot || invoice.customer?.mobile_number}</Text>
              </Group>
            )}
            {invoice.customer_gstin_snapshot && (
              <Text size="10px">CUST GSTIN: {invoice.customer_gstin_snapshot}</Text>
            )}
          </Box>

          <Divider my={8} variant="dashed" />

          {/* Line Items Table */}
          <Table verticalSpacing={2} horizontalSpacing={4} style={{ fontSize: '11px', width: '100%' }}>
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid #000' }}>
                <Table.Th style={{ textAlign: 'left', padding: '2px 0' }}>ITEM</Table.Th>
                <Table.Th style={{ textAlign: 'center', padding: '2px 0' }}>QTY</Table.Th>
                <Table.Th style={{ textAlign: 'right', padding: '2px 0' }}>RATE</Table.Th>
                <Table.Th style={{ textAlign: 'right', padding: '2px 0' }}>AMT</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invoice.items.map((item, idx) => (
                <Table.Tr key={item.id || idx}>
                  <Table.Td style={{ padding: '2px 0', verticalAlign: 'top' }}>
                    <Text fw={700} size="11px" lh={1.2}>
                      {item.product_name_snapshot || item.product_name}
                    </Text>
                    {item.hsn_code && (
                      <Text size="9px" c="dimmed">
                        HSN: {item.hsn_code} ({item.tax_slab}%)
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center', padding: '2px 0', verticalAlign: 'top' }}>
                    {item.quantity}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '2px 0', verticalAlign: 'top' }}>
                    {Number(item.unit_price).toFixed(2)}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '2px 0', verticalAlign: 'top', fontWeight: 700 }}>
                    {Number(item.line_total).toFixed(2)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Divider my={8} variant="dashed" />

          {/* Financial Calculation Summary */}
          <Stack gap={2} style={{ fontSize: '11px' }}>
            <Group justify="space-between">
              <Text>Subtotal:</Text>
              <Text>₹{Number(invoice.subtotal).toFixed(2)}</Text>
            </Group>
            {Number(invoice.total_discount) > 0 && (
              <Group justify="space-between" c="dimmed">
                <Text>Item Discount:</Text>
                <Text>-₹{Number(invoice.total_discount).toFixed(2)}</Text>
              </Group>
            )}
            {Number(invoice.loyalty_discount_amount) > 0 && (
              <Group justify="space-between" c="dimmed">
                <Text>Loyalty Points Redeemed ({invoice.loyalty_points_redeemed} pts):</Text>
                <Text>-₹{Number(invoice.loyalty_discount_amount).toFixed(2)}</Text>
              </Group>
            )}
            <Group justify="space-between">
              <Text>Total GST {invoice.is_tax_inclusive ? '(Included)' : ''}:</Text>
              <Text>₹{Number(invoice.total_gst).toFixed(2)}</Text>
            </Group>
            {Number(invoice.cgst_amount) > 0 && (
              <Group justify="space-between" c="dimmed" pl="xs">
                <Text size="10px">└ CGST:</Text>
                <Text size="10px">₹{Number(invoice.cgst_amount).toFixed(2)}</Text>
              </Group>
            )}
            {Number(invoice.sgst_amount) > 0 && (
              <Group justify="space-between" c="dimmed" pl="xs">
                <Text size="10px">└ SGST:</Text>
                <Text size="10px">₹{Number(invoice.sgst_amount).toFixed(2)}</Text>
              </Group>
            )}
            {Number(invoice.igst_amount) > 0 && (
              <Group justify="space-between" c="dimmed" pl="xs">
                <Text size="10px">└ IGST:</Text>
                <Text size="10px">₹{Number(invoice.igst_amount).toFixed(2)}</Text>
              </Group>
            )}
            {Number(invoice.round_off) !== 0 && (
              <Group justify="space-between">
                <Text>Round Off:</Text>
                <Text>{Number(invoice.round_off) > 0 ? '+' : ''}₹{Number(invoice.round_off).toFixed(2)}</Text>
              </Group>
            )}

            <Divider my={4} style={{ borderStyle: 'solid' }} />

            <Group justify="space-between" style={{ fontSize: '14px', fontWeight: 900 }}>
              <Text fw={900}>GRAND TOTAL:</Text>
              <Text fw={900}>₹{Number(invoice.grand_total).toFixed(2)}</Text>
            </Group>
          </Stack>

          <Divider my={8} variant="dashed" />

          {/* Payment Details */}
          <Stack gap={2} style={{ fontSize: '11px' }}>
            <Text fw={700}>PAYMENT DETAILS:</Text>
            {invoice.payments && invoice.payments.length > 0 ? (
              invoice.payments.map((p, i) => (
                <Group key={p.id || i} justify="space-between">
                  <Text>{p.method}:</Text>
                  <Text fw={700}>₹{Number(p.amount).toFixed(2)}</Text>
                </Group>
              ))
            ) : (
              <Text c="dimmed">No payment recorded</Text>
            )}

            {invoice.payments?.[0]?.amount_tendered && (
              <Group justify="space-between" c="dimmed">
                <Text size="10px">Cash Tendered:</Text>
                <Text size="10px">₹{Number(invoice.payments[0].amount_tendered).toFixed(2)}</Text>
              </Group>
            )}
            {invoice.payments?.[0]?.change_returned && (
              <Group justify="space-between" c="dimmed">
                <Text size="10px">Change Returned:</Text>
                <Text size="10px">₹{Number(invoice.payments[0].change_returned).toFixed(2)}</Text>
              </Group>
            )}
          </Stack>

          {/* Loyalty Points Accrual */}
          {invoice.loyalty_points_earned > 0 && (
            <>
              <Divider my={6} variant="dashed" />
              <Group justify="space-between" style={{ fontSize: '11px', color: '#099268' }}>
                <Text fw={700}>LOYALTY REWARD:</Text>
                <Text fw={700}>+{invoice.loyalty_points_earned} Points Earned</Text>
              </Group>
            </>
          )}

          <Divider my={8} variant="dashed" />

          {/* Barcode & Footer */}
          <Stack gap={4} align="center" style={{ textAlign: 'center' }}>
            <svg ref={barcodeRef} style={{ width: '100%', maxWidth: '220px' }} />
            <Text fw={700} size="10px" style={{ letterSpacing: '0.05em' }}>
              *** THANK YOU FOR SHOPPING! ***
            </Text>
            <Text size="9px" c="dimmed">
              Exchange or return within 7 days with original invoice.
            </Text>
          </Stack>
        </Paper>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button
            leftSection={<IconPrinter size={16} />}
            color="brand"
            onClick={handlePrint}
          >
            Print Receipt
          </Button>
        </Group>
      </Stack>

      {/* Global Print Media Style */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-thermal-receipt,
          #printable-thermal-receipt * {
            visibility: visible;
          }
          #printable-thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </Modal>
  );
}
