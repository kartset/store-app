import { useEffect, useRef } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Divider,
  Paper,
  Box,
} from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import JsBarcode from 'jsbarcode';
import type { Delivery } from '../types';

interface ThermalDispatchSlipModalProps {
  opened: boolean;
  onClose: () => void;
  delivery: Delivery | null;
}

export function ThermalDispatchSlipModal({ opened, onClose, delivery }: ThermalDispatchSlipModalProps) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (opened && delivery && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, delivery.tracking_id, {
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
  }, [opened, delivery]);

  if (!delivery) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(delivery.created_at).toLocaleString('en-IN', {
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
            Thermal Dispatch Slip (80mm) — {delivery.tracking_id}
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
          id="printable-dispatch-slip"
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
              {delivery.store?.name || 'STORE APP RETAIL'}
            </Text>
            {delivery.store?.address && (
              <Text size="11px" c="dimmed">
                {delivery.store.address}
              </Text>
            )}
            <Text size="11px" fw={700} mt={4}>
              *** DISPATCH &amp; DELIVERY SLIP ***
            </Text>
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* Tracking ID & Barcode */}
          <Stack gap={4} align="center" style={{ textAlign: 'center' }}>
            <Text fw={800} size="sm">
              {delivery.tracking_id}
            </Text>
            <Box style={{ overflow: 'hidden' }}>
              <svg ref={barcodeRef} style={{ maxWidth: '100%' }} />
            </Box>
            <Text size="10px" c="dimmed">
              CHANNEL: {delivery.delivery_type} {delivery.delivery_partner ? `(${delivery.delivery_partner})` : ''}
            </Text>
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* Metadata */}
          <Stack gap={2}>
            <Group justify="space-between">
              <Text size="11px">Dispatch Date:</Text>
              <Text size="11px" fw={700}>{formattedDate}</Text>
            </Group>
            {delivery.order && (
              <Group justify="space-between">
                <Text size="11px">Order Reference:</Text>
                <Text size="11px" fw={700}>{delivery.order.order_number}</Text>
              </Group>
            )}
            <Group justify="space-between">
              <Text size="11px">Current Status:</Text>
              <Text size="11px" fw={700}>{delivery.status}</Text>
            </Group>
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* Customer / Recipient Address */}
          <Stack gap={3}>
            <Text fw={800} size="11px">DELIVER TO:</Text>
            <Text fw={700} size="12px">{delivery.recipient_name}</Text>
            <Text size="11px">Mobile: {delivery.recipient_phone}</Text>
            <Text size="11px" style={{ wordBreak: 'break-word' }}>
              {delivery.delivery_address}
            </Text>
            {delivery.delivery_notes && (
              <Box p={4} mt={2} style={{ backgroundColor: '#f0f0f0', borderRadius: '3px' }}>
                <Text size="10px" fw={600}>
                  Notes: {delivery.delivery_notes}
                </Text>
              </Box>
            )}
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* Driver Fleet Info */}
          <Stack gap={2}>
            <Text fw={800} size="11px">ASSIGNED DRIVER / COURIER:</Text>
            <Group justify="space-between">
              <Text size="11px">Name:</Text>
              <Text size="11px" fw={700}>{delivery.driver_name || 'Unassigned'}</Text>
            </Group>
            {delivery.driver_phone && (
              <Group justify="space-between">
                <Text size="11px">Phone:</Text>
                <Text size="11px" fw={700}>{delivery.driver_phone}</Text>
              </Group>
            )}
            {delivery.vehicle_number && (
              <Group justify="space-between">
                <Text size="11px">Vehicle:</Text>
                <Text size="11px" fw={700}>{delivery.vehicle_number}</Text>
              </Group>
            )}
          </Stack>

          <Divider my="xs" style={{ borderStyle: 'dashed' }} />

          {/* COD Notice Box */}
          {delivery.is_cod ? (
            <Paper
              withBorder
              p={6}
              my="xs"
              style={{
                borderColor: '#000000',
                borderWidth: '2px',
                textAlign: 'center',
                backgroundColor: '#fffbe6',
              }}
            >
              <Text fw={900} size="13px">
                CASH ON DELIVERY DUE:
              </Text>
              <Text fw={900} size="18px">
                ₹{Number(delivery.cod_amount_due).toFixed(2)}
              </Text>
              <Text size="10px">
                COLLECT FULL AMOUNT PRIOR TO HANDOVER
              </Text>
            </Paper>
          ) : (
            <Paper
              withBorder
              p={4}
              my="xs"
              style={{
                borderColor: '#000000',
                textAlign: 'center',
              }}
            >
              <Text fw={800} size="11px">
                PREPAID ORDER — DO NOT COLLECT CASH
              </Text>
            </Paper>
          )}

          {/* Verification Protocol Notice */}
          <Stack gap={2} align="center" style={{ textAlign: 'center' }}>
            <Text size="10px" fw={700}>
              *** OTP VERIFICATION REQUIRED ***
            </Text>
            <Text size="9px" c="dimmed">
              Obtain 4-digit recipient verification code on delivery app to confirm handoff.
            </Text>
          </Stack>
        </Paper>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button
            color="brand"
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            Print Slip
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
