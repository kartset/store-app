import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Paper,
  Divider,
  Badge,
  Grid,
  Box,
} from '@mantine/core';
import { IconPrinter, IconReceipt } from '@tabler/icons-react';
import type { CashRegisterSession } from '../types';

interface ZReportModalProps {
  opened: boolean;
  onClose: () => void;
  session: CashRegisterSession | null;
}

export function ZReportModal({ opened, onClose, session }: ZReportModalProps) {
  if (!session) return null;

  const openingFloat = parseFloat(session.opening_float || '0');
  const expectedCash = parseFloat(session.expected_cash || '0');
  const countedCash = parseFloat(session.closing_cash_counted || session.expected_cash || '0');
  const variance = parseFloat(session.closing_cash_variance || '0');
  const cashSales = parseFloat(session.total_cash_sales || '0');
  const upiSales = parseFloat(session.total_upi_sales || '0');
  const cardSales = parseFloat(session.total_card_sales || '0');
  const creditSales = parseFloat(session.total_credit_sales || '0');
  const grossSales = parseFloat(session.total_sales || '0');
  const cashDrops = parseFloat(session.cash_drops_total || '0');

  const handlePrint = () => {
    window.print();
  };

  const getVarianceBadge = () => {
    if (Math.abs(variance) < 0.01) {
      return (
        <Badge color="teal" variant="filled" size="md">
          EXACT MATCH (₹0.00)
        </Badge>
      );
    }
    if (variance < 0) {
      return (
        <Badge color="red" variant="filled" size="md">
          CASH SHORT: ₹{Math.abs(variance).toFixed(2)}
        </Badge>
      );
    }
    return (
      <Badge color="orange" variant="filled" size="md">
        CASH OVER: +₹{variance.toFixed(2)}
      </Badge>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group justify="space-between" w="100%">
          <Group gap="xs">
            <IconReceipt size={20} color="#4f46e5" />
            <Text fw={700} size="md">
              End-of-Day Z-Report
            </Text>
          </Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPrinter size={14} />}
            onClick={handlePrint}
          >
            Print Slip
          </Button>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        {/* Printable Thermal Receipt Container */}
        <Paper
          withBorder
          p="md"
          radius="sm"
          className="printable-z-report"
          style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            fontFamily: "'Courier New', Courier, monospace",
            border: '1px dashed #9ca3af',
          }}
        >
          {/* Header */}
          <Stack gap={2} align="center" mb="sm">
            <Text fw={800} size="lg" style={{ letterSpacing: '0.05em' }}>
              {session.store?.name?.toUpperCase() || 'RETAIL STORE'}
            </Text>
            <Text size="xs" c="dimmed">
              DAILY CASH REGISTER CLOSURE (Z-REPORT)
            </Text>
            <Text size="xs" fw={700}>
              SESSION: {session.session_number}
            </Text>
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* Metadata */}
          <Box style={{ fontSize: '12px' }} mb="xs">
            <Group justify="space-between">
              <Text size="xs">CASHIER:</Text>
              <Text size="xs" fw={700}>
                {session.cashier
                  ? `${session.cashier.first_name} ${session.cashier.last_name || ''}`.trim()
                  : session.cashier_id}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">OPENED AT:</Text>
              <Text size="xs">
                {session.opened_at ? new Date(session.opened_at).toLocaleString() : 'N/A'}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">CLOSED AT:</Text>
              <Text size="xs">
                {session.closed_at ? new Date(session.closed_at).toLocaleString() : 'Active Shift'}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">INVOICES PROCESSED:</Text>
              <Text size="xs" fw={700}>
                {session.invoices_count}
              </Text>
            </Group>
          </Box>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* Tender Breakdown */}
          <Text size="xs" fw={800} mb={4} style={{ textDecoration: 'underline' }}>
            SALES BY PAYMENT METHOD:
          </Text>
          <Box style={{ fontSize: '12px' }}>
            <Group justify="space-between">
              <Text size="xs">CASH SALES:</Text>
              <Text size="xs" fw={600}>
                ₹{cashSales.toFixed(2)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">UPI / DIGITAL PAYMENTS:</Text>
              <Text size="xs" fw={600}>
                ₹{upiSales.toFixed(2)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">CREDIT / DEBIT CARDS:</Text>
              <Text size="xs" fw={600}>
                ₹{cardSales.toFixed(2)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">STORE CREDIT / KHATA:</Text>
              <Text size="xs" fw={600}>
                ₹{creditSales.toFixed(2)}
              </Text>
            </Group>
            <Divider my={4} style={{ borderStyle: 'dotted' }} />
            <Group justify="space-between">
              <Text size="xs" fw={800}>
                GROSS SALES REVENUE:
              </Text>
              <Text size="xs" fw={800}>
                ₹{grossSales.toFixed(2)}
              </Text>
            </Group>
          </Box>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* Cash Drawer Reconciliation */}
          <Text size="xs" fw={800} mb={4} style={{ textDecoration: 'underline' }}>
            DRAWER CASH RECONCILIATION:
          </Text>
          <Box style={{ fontSize: '12px' }}>
            <Group justify="space-between">
              <Text size="xs">(+) OPENING FLOAT:</Text>
              <Text size="xs">₹{openingFloat.toFixed(2)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">(+) CASH SALES INFLOW:</Text>
              <Text size="xs">₹{cashSales.toFixed(2)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs">(-) SAFE DROPS & PAYOUTS:</Text>
              <Text size="xs">₹{cashDrops.toFixed(2)}</Text>
            </Group>
            <Divider my={4} style={{ borderStyle: 'dotted' }} />
            <Group justify="space-between">
              <Text size="xs" fw={700}>
                SYSTEM EXPECTED DRAWER CASH:
              </Text>
              <Text size="xs" fw={700}>
                ₹{expectedCash.toFixed(2)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" fw={800}>
                PHYSICAL CASH COUNTED:
              </Text>
              <Text size="xs" fw={800}>
                ₹{countedCash.toFixed(2)}
              </Text>
            </Group>
            <Divider my={4} style={{ borderStyle: 'dotted' }} />
            <Group justify="space-between" align="center" mt={4}>
              <Text size="xs" fw={800}>
                CLOSING VARIANCE:
              </Text>
              <div>{getVarianceBadge()}</div>
            </Group>
          </Box>

          {/* Denominations breakdown if present */}
          {session.closing_denominations && (
            <>
              <Divider my="xs" style={{ borderStyle: 'dashed' }} />
              <Text size="xs" fw={800} mb={4} style={{ textDecoration: 'underline' }}>
                DENOMINATION PIECES COUNTED:
              </Text>
              <Grid gap="xs" style={{ fontSize: '11px' }}>
                {Object.entries(session.closing_denominations).map(([k, v]) => {
                  if (!v) return null;
                  return (
                    <Grid.Col span={6} key={k}>
                      <Group justify="space-between">
                        <Text size="11px">₹{k}:</Text>
                        <Text size="11px" fw={700}>
                          {v} pcs
                        </Text>
                      </Group>
                    </Grid.Col>
                  );
                })}
              </Grid>
            </>
          )}

          {session.notes && (
            <>
              <Divider my="xs" style={{ borderStyle: 'dashed' }} />
              <Text size="xs" c="dimmed">
                <b>Closing Notes:</b> {session.notes}
              </Text>
            </>
          )}

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          <Stack gap={2} align="center" mt="xs">
            <Text size="10px" c="dimmed">
              *** END OF Z-REPORT SLIP ***
            </Text>
            <Text size="9px" c="dimmed">
              Generated by StoreCraft Retail Platform
            </Text>
          </Stack>
        </Paper>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button color="brand" leftSection={<IconPrinter size={16} />} onClick={handlePrint}>
            Print Z-Report
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
