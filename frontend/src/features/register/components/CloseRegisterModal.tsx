import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Textarea,
  Alert,
  Paper,
  Badge,
  Divider,
} from '@mantine/core';
import {
  IconLock,
  IconAlertCircle,
  IconAlertTriangle,
  IconReceipt,
} from '@tabler/icons-react';
import { useState, useCallback, useMemo } from 'react';
import { useCloseRegisterSession } from '../api';
import { DenominationCalculator } from './DenominationCalculator';
import type { CashRegisterSession, DenominationCounts } from '../types';

interface CloseRegisterModalProps {
  opened: boolean;
  onClose: () => void;
  session: CashRegisterSession;
  onClosedSuccessfully: (closedSession: CashRegisterSession) => void;
}

export function CloseRegisterModal({
  opened,
  onClose,
  session,
  onClosedSuccessfully,
}: CloseRegisterModalProps) {
  const expectedCash = parseFloat(session.expected_cash || '0');
  const [countedCash, setCountedCash] = useState<number>(expectedCash);
  const [denominations, setDenominations] = useState<DenominationCounts | undefined>();
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const closeMutation = useCloseRegisterSession();

  const handleDenominationChange = useCallback((counts: DenominationCounts, total: number) => {
    setDenominations(counts);
    setCountedCash(total);
  }, []);

  const variance = useMemo(() => {
    return countedCash - expectedCash;
  }, [countedCash, expectedCash]);

  const handleSubmit = async () => {
    if (countedCash < 0) {
      setErrorMsg('Counted cash cannot be negative.');
      return;
    }

    try {
      setErrorMsg(null);
      const res = await closeMutation.mutateAsync({
        sessionId: session.id,
        payload: {
          closing_cash_counted: countedCash,
          closing_denominations: denominations,
          notes: notes.trim(),
        },
      });

      onClose();
      onClosedSuccessfully(res);
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to close register shift.';
      setErrorMsg(msg);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconLock size={20} color="#e11d48" />
          <Text fw={700} size="md">
            Close Register & End of Day (Z-Report)
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        <Paper withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-subtle)' }}>
          <Group justify="space-between" mb="xs">
            <div>
              <Text size="xs" c="dimmed">
                Active Session
              </Text>
              <Text size="sm" fw={700}>
                {session.session_number}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Store
              </Text>
              <Text size="sm" fw={600}>
                {session.store?.name || 'Retail Store'}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                System Expected Cash
              </Text>
              <Text size="md" fw={800} c="brand">
                ₹{expectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </div>
          </Group>
        </Paper>

        {errorMsg && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Error">
            {errorMsg}
          </Alert>
        )}

        <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
          Step 1: Count Cash in Register Drawer
        </Text>

        <DenominationCalculator onChange={handleDenominationChange} />

        <Divider my="xs" />

        <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
          Step 2: Reconcile Physical vs Expected Cash
        </Text>

        <Paper withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm">System Expected Cash:</Text>
              <Text size="sm" fw={700}>
                ₹{expectedCash.toFixed(2)}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm">Physical Cash Counted:</Text>
              <Text size="md" fw={800} c="teal">
                ₹{countedCash.toFixed(2)}
              </Text>
            </Group>

            <Divider my={2} />

            <Group justify="space-between" align="center">
              <Text size="sm" fw={700}>
                Cash Drawer Variance:
              </Text>
              {Math.abs(variance) < 0.01 ? (
                <Badge color="teal" size="lg" variant="filled">
                  EXACT MATCH (₹0.00)
                </Badge>
              ) : variance < 0 ? (
                <Badge color="red" size="lg" variant="filled" leftSection={<IconAlertTriangle size={14} />}>
                  SHORTAGE: -₹{Math.abs(variance).toFixed(2)}
                </Badge>
              ) : (
                <Badge color="orange" size="lg" variant="filled">
                  OVERAGE: +₹{variance.toFixed(2)}
                </Badge>
              )}
            </Group>
          </Stack>
        </Paper>

        <Textarea
          label="Closing Notes & Explanation"
          placeholder={
            Math.abs(variance) < 0.01
              ? 'Shift completed normally, drawer reconciled.'
              : 'Provide reason for cash variance / discrepancy...'
          }
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={closeMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleSubmit}
            loading={closeMutation.isPending}
            leftSection={<IconReceipt size={16} />}
          >
            Close Shift & Generate Z-Report
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
