import {
  Modal,
  Stack,
  Text,
  Group,
  Badge,
  NumberInput,
  Select,
  TextInput,
  Textarea,
  Button,
  Alert,
  Paper,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle, IconCheck, IconArrowsExchange } from '@tabler/icons-react';
import { useState } from 'react';
import { useAdjustStock } from '../api';
import type { InventoryItem, StockMovementType } from '../types';

interface StockAdjustmentModalProps {
  opened: boolean;
  onClose: () => void;
  inventory: InventoryItem | null;
}

const MOVEMENT_TYPE_OPTIONS = [
  { value: 'AUDIT_ADJUSTMENT', label: 'Audit / Physical Count Adjustment' },
  { value: 'DAMAGE_WASTE', label: 'Damage / Expiry / Shrinkage' },
  { value: 'RETURN_RESTOCK', label: 'Customer Return / Restock' },
  { value: 'POS_SALE', label: 'Point of Sale (Manual Deduction)' },
  { value: 'INITIAL_STOCK', label: 'Initial Stock Opening Balance' },
  { value: 'TRANSFER_IN', label: 'Inter-Store Transfer In' },
  { value: 'TRANSFER_OUT', label: 'Inter-Store Transfer Out' },
];

export function StockAdjustmentModal({ opened, onClose, inventory }: StockAdjustmentModalProps) {
  const { mutateAsync: adjustStock, isPending } = useAdjustStock();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      quantity_delta: 1,
      mode: 'ADD' as 'ADD' | 'DEDUCT',
      movement_type: 'AUDIT_ADJUSTMENT' as StockMovementType,
      reason: '',
      reference_id: '',
      notes: '',
    },
    validate: {
      quantity_delta: (val) => (val <= 0 ? 'Quantity must be greater than zero' : null),
      movement_type: (val) => (!val ? 'Movement type is required' : null),
    },
  });

  const handleClose = () => {
    form.reset();
    setErrorMessage(null);
    onClose();
  };

  if (!inventory) return null;

  const currentStock = inventory.stock_quantity;
  const delta = form.values.mode === 'ADD' ? form.values.quantity_delta : -form.values.quantity_delta;
  const projectedStock = currentStock + delta;
  const isNegativeWarning = projectedStock < 0;

  const handleSubmit = async (values: typeof form.values) => {
    setErrorMessage(null);
    const effectiveDelta = values.mode === 'ADD' ? values.quantity_delta : -values.quantity_delta;

    try {
      await adjustStock({
        inventoryId: inventory.id,
        payload: {
          quantity_delta: effectiveDelta,
          movement_type: values.movement_type,
          reason: values.reason,
          reference_id: values.reference_id,
          notes: values.notes,
          allow_negative: false,
        },
      });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to adjust stock';
      setErrorMessage(msg);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconArrowsExchange size={20} color="var(--brand-primary)" />
          <Text fw={700} size="md">
            Adjust Stock Level
          </Text>
        </Group>
      }
      size="md"
      radius="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {errorMessage && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" title="Adjustment Failed">
              {errorMessage}
            </Alert>
          )}

          {/* Product context card */}
          <Paper p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={700} size="sm">
                  {inventory.product?.name}
                </Text>
                <Text size="xs" c="dimmed">
                  SKU: {inventory.product?.sku} {inventory.product?.barcode && `• Barcode: ${inventory.product?.barcode}`}
                </Text>
              </div>
              <Badge variant="filled" color={currentStock > (inventory.low_stock_threshold || 10) ? 'teal' : currentStock > 0 ? 'yellow' : 'red'}>
                Current: {currentStock} in stock
              </Badge>
            </Group>
          </Paper>

          {/* Operation mode buttons */}
          <Group grow>
            <Button
              type="button"
              variant={form.values.mode === 'ADD' ? 'filled' : 'light'}
              color="teal"
              onClick={() => form.setFieldValue('mode', 'ADD')}
            >
              + Add Stock
            </Button>
            <Button
              type="button"
              variant={form.values.mode === 'DEDUCT' ? 'filled' : 'light'}
              color="red"
              onClick={() => form.setFieldValue('mode', 'DEDUCT')}
            >
              - Deduct Stock
            </Button>
          </Group>

          {/* Delta quantity and projected level */}
          <Group grow align="flex-start">
            <NumberInput
              label="Quantity"
              min={1}
              required
              {...form.getInputProps('quantity_delta')}
            />
            <Box>
              <Text size="xs" fw={500} mb={4} c="dimmed">
                Projected Balance
              </Text>
              <Paper
                p="xs"
                radius="sm"
                style={{
                  backgroundColor: isNegativeWarning ? '#fef2f2' : 'var(--bg-surface)',
                  border: `1px solid ${isNegativeWarning ? '#fca5a5' : 'var(--border-subtle)'}`,
                  textAlign: 'center',
                }}
              >
                <Text fw={700} size="md" c={isNegativeWarning ? 'red' : 'brand'}>
                  {currentStock} → {projectedStock} ({delta > 0 ? `+${delta}` : delta})
                </Text>
              </Paper>
            </Box>
          </Group>

          {isNegativeWarning && (
            <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
              This deduction exceeds available inventory ({currentStock}). System requires positive stock balances.
            </Alert>
          )}

          <Select
            label="Movement Classification"
            data={MOVEMENT_TYPE_OPTIONS}
            required
            {...form.getInputProps('movement_type')}
          />

          <TextInput
            label="Reason / Remarks"
            placeholder="e.g. Damaged during shelf restock, Cycle count adjustment"
            {...form.getInputProps('reason')}
          />

          <TextInput
            label="External Reference ID (Optional)"
            placeholder="e.g. INV-1002, AUDIT-OCT-26, TFR-09"
            {...form.getInputProps('reference_id')}
          />

          <Textarea
            label="Audit Notes (Optional)"
            placeholder="Detailed observation for store manager / auditor"
            rows={2}
            {...form.getInputProps('notes')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              color={form.values.mode === 'ADD' ? 'teal' : 'red'}
              leftSection={<IconCheck size={16} />}
              loading={isPending}
              disabled={isNegativeWarning}
            >
              Confirm Adjustment
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
