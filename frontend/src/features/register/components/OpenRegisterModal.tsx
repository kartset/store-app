import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  NumberInput,
  Textarea,
  Alert,
  Switch,
  Collapse,
} from '@mantine/core';
import { IconCashRegister, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useState, useCallback } from 'react';
import { useOpenRegisterSession } from '../api';
import { DenominationCalculator } from './DenominationCalculator';
import type { DenominationCounts } from '../types';

interface OpenRegisterModalProps {
  opened: boolean;
  onClose: () => void;
  storeId: string;
  storeName?: string;
  onSuccess?: () => void;
}

export function OpenRegisterModal({
  opened,
  onClose,
  storeId,
  storeName,
  onSuccess,
}: OpenRegisterModalProps) {
  const [openingFloat, setOpeningFloat] = useState<number>(1000);
  const [useDenominations, setUseDenominations] = useState(false);
  const [denominations, setDenominations] = useState<DenominationCounts | undefined>();
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openMutation = useOpenRegisterSession();

  const handleDenominationChange = useCallback((counts: DenominationCounts, total: number) => {
    setDenominations(counts);
    setOpeningFloat(total);
  }, []);

  const handleSubmit = async () => {
    if (!storeId) {
      setErrorMsg('No store selected.');
      return;
    }

    if (openingFloat < 0) {
      setErrorMsg('Opening float cannot be negative.');
      return;
    }

    try {
      setErrorMsg(null);
      await openMutation.mutateAsync({
        store_id: storeId,
        opening_float: openingFloat,
        notes: notes.trim(),
        opening_denominations: useDenominations ? denominations : undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to open register shift.';
      setErrorMsg(msg);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCashRegister size={20} color="#4f46e5" />
          <Text fw={700} size="md">
            Open Register Shift
          </Text>
        </Group>
      }
      size="md"
      radius="md"
    >
      <Stack gap="md">
        {storeName && (
          <Text size="xs" c="dimmed">
            Opening shift for store: <b>{storeName}</b>
          </Text>
        )}

        {errorMsg && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Error">
            {errorMsg}
          </Alert>
        )}

        <NumberInput
          label="Opening Cash Float (₹)"
          description="Initial physical cash present in the cash drawer at shift start"
          placeholder="1000.00"
          min={0}
          decimalScale={2}
          value={openingFloat}
          onChange={(val) => typeof val === 'number' && setOpeningFloat(val)}
          required
        />

        <Switch
          label="Itemize currency notes & coins"
          description="Count physical denominations for drawer audit"
          checked={useDenominations}
          onChange={(event) => setUseDenominations(event.currentTarget.checked)}
        />

        <Collapse expanded={useDenominations}>
          <DenominationCalculator onChange={handleDenominationChange} />
        </Collapse>

        <Textarea
          label="Shift Notes (Optional)"
          placeholder="e.g. Morning opening shift, float verified"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={openMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="brand"
            onClick={handleSubmit}
            loading={openMutation.isPending}
            leftSection={<IconCheck size={16} />}
          >
            Start Register Shift
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
