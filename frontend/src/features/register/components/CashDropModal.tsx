import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  NumberInput,
  TextInput,
  SegmentedControl,
  Alert,
  Paper,
} from '@mantine/core';
import { IconVault, IconAlertCircle, IconArrowDownRight } from '@tabler/icons-react';
import { useState } from 'react';
import { useRecordCashDrop } from '../api';
import type { CashRegisterSession } from '../types';

interface CashDropModalProps {
  opened: boolean;
  onClose: () => void;
  session: CashRegisterSession;
  onSuccess?: () => void;
}

export function CashDropModal({ opened, onClose, session, onSuccess }: CashDropModalProps) {
  const [type, setType] = useState<'CASH_DROP' | 'PETTY_PAYOUT'>('CASH_DROP');
  const [amount, setAmount] = useState<number>(500);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dropMutation = useRecordCashDrop();
  const currentExpected = parseFloat(session.expected_cash || '0');

  const handleSubmit = async () => {
    if (amount <= 0) {
      setErrorMsg('Transfer amount must be greater than zero.');
      return;
    }

    if (amount > currentExpected) {
      setErrorMsg(`Cannot drop ₹${amount.toFixed(2)}; current drawer cash is only ₹${currentExpected.toFixed(2)}.`);
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please enter a reason or description for this drawer transfer.');
      return;
    }

    try {
      setErrorMsg(null);
      await dropMutation.mutateAsync({
        sessionId: session.id,
        payload: {
          type,
          amount,
          reason: reason.trim(),
        },
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to record cash transfer.';
      setErrorMsg(msg);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconVault size={20} color="#f59e0b" />
          <Text fw={700} size="md">
            Drawer Cash Drop / Safe Transfer
          </Text>
        </Group>
      }
      size="md"
      radius="md"
    >
      <Stack gap="md">
        <Paper withBorder p="xs" radius="sm" style={{ backgroundColor: 'var(--bg-subtle)' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Current Cash in Drawer:
            </Text>
            <Text size="sm" fw={800} c="teal">
              ₹{currentExpected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Group>
        </Paper>

        {errorMsg && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Error">
            {errorMsg}
          </Alert>
        )}

        <div>
          <Text size="xs" fw={600} mb={4}>
            Transfer Category
          </Text>
          <SegmentedControl
            fullWidth
            value={type}
            onChange={(val) => setType(val as 'CASH_DROP' | 'PETTY_PAYOUT')}
            data={[
              { label: 'Drop to Store Safe', value: 'CASH_DROP' },
              { label: 'Petty Expense Payout', value: 'PETTY_PAYOUT' },
            ]}
          />
        </div>

        <NumberInput
          label="Transfer Amount (₹)"
          description="Physical cash removed from active drawer"
          placeholder="500.00"
          min={1}
          max={currentExpected}
          decimalScale={2}
          value={amount}
          onChange={(val) => typeof val === 'number' && setAmount(val)}
          required
        />

        <TextInput
          label="Transfer Reason & Recipient"
          placeholder={type === 'CASH_DROP' ? 'e.g. Midday safe drop #1 to manager safe' : 'e.g. Store cleaning supplies & tea'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={dropMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="orange"
            onClick={handleSubmit}
            loading={dropMutation.isPending}
            leftSection={<IconArrowDownRight size={16} />}
          >
            Confirm Drawer Removal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
