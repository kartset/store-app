import {
  Drawer,
  Stack,
  Text,
  Group,
  Badge,
  Table,
  Paper,
  TextInput,
  Select,
  Loader,
  Center,
  ThemeIcon,
} from '@mantine/core';
import {
  IconHistory,
  IconSearch,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowsExchange,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useStockMovements } from '../api';
import type { StockMovementType } from '../types';

interface StockMovementsDrawerProps {
  opened: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  productId?: string;
  productName?: string;
}

const MOVEMENT_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Movement Types' },
  { value: 'PURCHASE_RECEIPT', label: 'Goods Received (GRN)' },
  { value: 'POS_SALE', label: 'Point of Sale' },
  { value: 'RETURN_RESTOCK', label: 'Customer Return' },
  { value: 'DAMAGE_WASTE', label: 'Damage / Waste' },
  { value: 'AUDIT_ADJUSTMENT', label: 'Audit Adjustment' },
  { value: 'INITIAL_STOCK', label: 'Initial Stock' },
];

function getMovementTypeBadge(type: StockMovementType) {
  switch (type) {
    case 'PURCHASE_RECEIPT':
    case 'RETURN_RESTOCK':
    case 'INITIAL_STOCK':
    case 'TRANSFER_IN':
      return { color: 'teal', label: type.replace('_', ' ') };
    case 'DAMAGE_WASTE':
      return { color: 'red', label: 'DAMAGE / EXPIRY' };
    case 'POS_SALE':
    case 'TRANSFER_OUT':
      return { color: 'blue', label: 'POS SALE' };
    case 'AUDIT_ADJUSTMENT':
      return { color: 'orange', label: 'AUDIT ADJUSTMENT' };
    default:
      return { color: 'gray', label: type };
  }
}

export function StockMovementsDrawer({
  opened,
  onClose,
  storeId,
  storeName,
  productId,
  productName,
}: StockMovementsDrawerProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const { data: movements, isLoading } = useStockMovements({
    store_id: storeId,
    product_id: productId,
    movement_type: selectedType || undefined,
    search: search.trim() || undefined,
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconHistory size={22} color="var(--brand-primary)" />
          <div>
            <Text fw={700} size="md">
              Stock Movement Audit Ledger
            </Text>
            <Text size="xs" c="dimmed">
              Store: {storeName} {productName && `• Product: ${productName}`}
            </Text>
          </div>
        </Group>
      }
      position="right"
      size="xl"
      padding="lg"
    >
      <Stack gap="md">
        {/* Filter controls */}
        <Group grow align="flex-start">
          <TextInput
            placeholder="Search by reason, ref #, or SKU..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="sm"
          />
          <Select
            placeholder="Filter by type..."
            data={MOVEMENT_TYPE_FILTER_OPTIONS}
            value={selectedType}
            onChange={(val) => setSelectedType(val || '')}
            size="sm"
            clearable
          />
        </Group>

        {/* Movements table */}
        {isLoading ? (
          <Center py="xl">
            <Loader size="md" color="brand" />
          </Center>
        ) : !movements || movements.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                <IconArrowsExchange size={24} />
              </ThemeIcon>
              <Text fw={600} size="sm" c="dimmed">
                No stock movement records found
              </Text>
              <Text size="xs" c="dimmed">
                All inventory inwarding, sales, and manual reconciliations will appear here.
              </Text>
            </Stack>
          </Center>
        ) : (
          <Paper radius="md" style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <Table verticalSpacing="sm" striped highlightOnHover>
              <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                <Table.Tr>
                  <Table.Th>Timestamp</Table.Th>
                  {!productId && <Table.Th>Product</Table.Th>}
                  <Table.Th>Classification</Table.Th>
                  <Table.Th>Delta</Table.Th>
                  <Table.Th>Before → After</Table.Th>
                  <Table.Th>Reason / Ref</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {movements.map((m) => {
                  const badgeInfo = getMovementTypeBadge(m.movement_type);
                  const isPositive = m.quantity_delta > 0;
                  const sign = isPositive ? '+' : '';

                  return (
                    <Table.Tr key={m.id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text size="xs" fw={600}>
                          {new Date(m.created_at).toLocaleDateString()}
                        </Text>
                        <Text size="10px" c="dimmed">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </Table.Td>

                      {!productId && (
                        <Table.Td>
                          <Text size="xs" fw={600} lineClamp={1}>
                            {m.product?.name}
                          </Text>
                          <Text size="10px" c="dimmed">
                            {m.product?.sku}
                          </Text>
                        </Table.Td>
                      )}

                      <Table.Td>
                        <Badge size="xs" color={badgeInfo.color} variant="light" fw={700}>
                          {badgeInfo.label}
                        </Badge>
                      </Table.Td>

                      <Table.Td>
                        <Group gap={4}>
                          {isPositive ? (
                            <IconArrowUpRight size={14} color="var(--mantine-color-teal-6)" />
                          ) : (
                            <IconArrowDownRight size={14} color="var(--mantine-color-red-6)" />
                          )}
                          <Text fw={700} size="sm" c={isPositive ? 'teal' : 'red'}>
                            {sign}{m.quantity_delta}
                          </Text>
                        </Group>
                      </Table.Td>

                      <Table.Td>
                        <Text size="xs" fw={600} c="dimmed">
                          {m.quantity_before} → <span style={{ color: 'var(--mantine-color-dark-8)' }}>{m.quantity_after}</span>
                        </Text>
                      </Table.Td>

                      <Table.Td>
                        {m.reference_id && (
                          <Badge size="xs" variant="outline" color="gray" mb={2}>
                            {m.reference_id}
                          </Badge>
                        )}
                        <Text size="xs" lineClamp={1}>
                          {m.reason || '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </Drawer>
  );
}
