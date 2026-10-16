import {
  Drawer,
  Stack,
  Text,
  Group,
  TextInput,
  Button,
  Alert,
  Paper,
  Table,
  ActionIcon,
  NumberInput,
  Select,
  Box,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconTruckLoading,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useReceiveGoods } from '../api';
import { useProducts } from '../../products/api';
import type { ReceiveGoodsItemPayload } from '../types';

interface ReceiveGoodsDrawerProps {
  opened: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  organizationId: string;
}

export function ReceiveGoodsDrawer({
  opened,
  onClose,
  storeId,
  storeName,
  organizationId,
}: ReceiveGoodsDrawerProps) {
  const { mutateAsync: receiveGoods, isPending } = useReceiveGoods();
  const { data: products } = useProducts({ organization_id: organizationId });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const productOptions = useMemo(() => {
    if (!products) return [];
    return products.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.sku})`,
    }));
  }, [products]);

  const form = useForm({
    initialValues: {
      reference_id: '',
      notes: '',
      items: [
        {
          product_id: '',
          quantity: 1,
          store_price: '',
          batch_number: '',
        },
      ],
    },
    validate: {
      reference_id: (val) => (!val.trim() ? 'Invoice or PO reference number is required' : null),
      items: {
        product_id: (val) => (!val ? 'Please select a product' : null),
        quantity: (val) => (val <= 0 ? 'Quantity must be ≥ 1' : null),
      },
    },
  });

  const handleClose = () => {
    form.reset();
    setErrorMessage(null);
    onClose();
  };

  const handleAddLine = () => {
    form.insertListItem('items', {
      product_id: '',
      quantity: 1,
      store_price: '',
      batch_number: '',
    });
  };

  const handleRemoveLine = (index: number) => {
    if (form.values.items.length > 1) {
      form.removeListItem('items', index);
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    setErrorMessage(null);

    const formattedItems: ReceiveGoodsItemPayload[] = values.items.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      store_price: item.store_price ? Number(item.store_price) : null,
      batch_number: item.batch_number ? item.batch_number.trim() : null,
    }));

    try {
      await receiveGoods({
        store_id: storeId,
        reference_id: values.reference_id.trim(),
        notes: values.notes.trim(),
        items: formattedItems,
      });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to receive goods';
      setErrorMessage(msg);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconTruckLoading size={22} color="var(--brand-primary)" />
          <div>
            <Text fw={700} size="md">
              Inward Stock (GRN Receipt)
            </Text>
            <Text size="xs" c="dimmed">
              Store: {storeName}
            </Text>
          </div>
        </Group>
      }
      position="right"
      size="xl"
      padding="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {errorMessage && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" title="Inwarding Failed">
              {errorMessage}
            </Alert>
          )}

          {/* Header Info */}
          <Paper p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <Group grow align="flex-start">
              <TextInput
                label="Invoice / PO Reference #"
                placeholder="e.g. PO-2026-991, INV-DL-4482"
                required
                {...form.getInputProps('reference_id')}
              />
              <TextInput
                label="Auditor / Receiver Notes"
                placeholder="e.g. Delivered via Apex Freight, verified"
                {...form.getInputProps('notes')}
              />
            </Group>
          </Paper>

          {/* Line items section */}
          <Box>
            <Group justify="space-between" mb="xs">
              <div>
                <Text fw={700} size="sm">
                  Consignment Line Items
                </Text>
                <Text size="xs" c="dimmed">
                  Specify products, quantities, batch lot numbers, and store price overrides.
                </Text>
              </div>
              <Button
                variant="light"
                color="brand"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={handleAddLine}
              >
                Add Line Item
              </Button>
            </Group>

            <Paper radius="md" style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <Table verticalSpacing="xs" striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                  <Table.Tr>
                    <Table.Th style={{ width: '40%' }}>Product</Table.Th>
                    <Table.Th style={{ width: '18%' }}>Quantity</Table.Th>
                    <Table.Th style={{ width: '20%' }}>Store Price (₹)</Table.Th>
                    <Table.Th style={{ width: '18%' }}>Batch / Lot #</Table.Th>
                    <Table.Th style={{ width: '4%' }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {form.values.items.map((_, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Select
                          placeholder="Select product..."
                          data={productOptions}
                          searchable
                          required
                          size="xs"
                          {...form.getInputProps(`items.${index}.product_id`)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={1}
                          required
                          size="xs"
                          {...form.getInputProps(`items.${index}.quantity`)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="Override price"
                          min={0}
                          decimalScale={2}
                          size="xs"
                          {...form.getInputProps(`items.${index}.store_price`)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="LOT-2026-X"
                          size="xs"
                          {...form.getInputProps(`items.${index}.batch_number`)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="sm"
                          disabled={form.values.items.length <= 1}
                          onClick={() => handleRemoveLine(index)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Box>

          <Divider />

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="brand"
              leftSection={<IconCheck size={16} />}
              loading={isPending}
            >
              Inward {form.values.items.length} Items to Inventory
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
