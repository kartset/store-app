import {
  Table,
  Badge,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Paper,
  Skeleton,
} from '@mantine/core';
import {
  IconLock,
  IconLockOpen,
  IconCheck,
  IconDownload,
  IconHistory,
} from '@tabler/icons-react';
import type { GSTFilingPeriod } from '../types';
import { useTogglePeriodLock, downloadGSTNJson } from '../api';

interface FilingHistoryTableProps {
  periods: GSTFilingPeriod[];
  loading?: boolean;
  onMarkFiledClick: (period: GSTFilingPeriod) => void;
}

function formatINR(val: number | string | undefined | null): string {
  const num = typeof val === 'string' ? parseFloat(val) : Number(val || 0);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FilingHistoryTable({
  periods,
  loading,
  onMarkFiledClick,
}: FilingHistoryTableProps) {
  const toggleLockMutation = useTogglePeriodLock();

  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Skeleton height={40} mb="md" />
        <Skeleton height={200} />
      </Paper>
    );
  }

  if (!periods || periods.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" ta="center">
        <Text c="dimmed" size="sm">
          No saved filing periods found. Click &quot;Generate Snapshot&quot; above to capture and persist statutory return snapshots.
        </Text>
      </Paper>
    );
  }

  const handleToggleLock = (periodId: string) => {
    toggleLockMutation.mutate(periodId);
  };

  const handleDownload = (storeId: string, periodKey: string) => {
    downloadGSTNJson(storeId, periodKey);
  };

  return (
    <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconHistory size={18} color="var(--brand-primary)" />
          <Text fw={700} size="sm">
            Filing Periods & Statutory Audit History
          </Text>
          <Badge size="sm" variant="light" color="indigo">
            {periods.length} Records
          </Badge>
        </Group>
      </Group>

      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing="xs" striped highlightOnHover>
          <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <Table.Tr>
              <Table.Th>Return</Table.Th>
              <Table.Th>Period Key</Table.Th>
              <Table.Th>Store</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Audit Lock</Table.Th>
              <Table.Th ta="right">Invoices</Table.Th>
              <Table.Th ta="right">Taxable Turnover</Table.Th>
              <Table.Th ta="right">Total Tax</Table.Th>
              <Table.Th>Acknowledgement (ARN)</Table.Th>
              <Table.Th ta="right">Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {periods.map((p) => {
              const statusColor =
                p.status === 'FILED' ? 'teal' : p.status === 'GENERATED' ? 'blue' : 'gray';

              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Badge color={p.return_type === 'GSTR1' ? 'indigo' : 'teal'} variant="filled" size="sm">
                      {p.return_type}
                    </Badge>
                  </Table.Td>
                  <Table.Td fw={700} style={{ fontFamily: 'monospace' }}>
                    {p.period_key}
                  </Table.Td>
                  <Table.Td>{p.store?.name || 'Primary Store'}</Table.Td>
                  <Table.Td>
                    <Badge color={statusColor} variant="light" size="sm">
                      {p.status_display || p.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {p.is_locked ? (
                      <Badge color="red" variant="outline" size="sm" leftSection={<IconLock size={12} />}>
                        LOCKED
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="outline" size="sm" leftSection={<IconLockOpen size={12} />}>
                        UNLOCKED
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">{p.invoices_count}</Table.Td>
                  <Table.Td ta="right" fw={600} c="blue">
                    {formatINR(p.taxable_value)}
                  </Table.Td>
                  <Table.Td ta="right" fw={700} c="brand">
                    {formatINR(p.total_tax)}
                  </Table.Td>
                  <Table.Td>
                    {p.acknowledged_ref_number ? (
                      <Text size="xs" fw={700} style={{ fontFamily: 'monospace' }} c="teal">
                        {p.acknowledged_ref_number}
                      </Text>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Not Filed
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={6} justify="flex-end">
                      {p.return_type === 'GSTR1' && (
                        <Tooltip label="Download GSTN Offline JSON">
                          <ActionIcon
                            variant="light"
                            color="indigo"
                            size="sm"
                            onClick={() => handleDownload(p.store_id, p.period_key)}
                          >
                            <IconDownload size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}

                      <Tooltip label={p.is_locked ? 'Unlock Audit Period' : 'Lock Audit Period'}>
                        <ActionIcon
                          variant="light"
                          color={p.is_locked ? 'red' : 'gray'}
                          size="sm"
                          loading={toggleLockMutation.isPending}
                          onClick={() => handleToggleLock(p.id)}
                        >
                          {p.is_locked ? <IconLock size={14} /> : <IconLockOpen size={14} />}
                        </ActionIcon>
                      </Tooltip>

                      {p.status !== 'FILED' && (
                        <Tooltip label="Record ARN & Mark Filed">
                          <ActionIcon
                            variant="light"
                            color="teal"
                            size="sm"
                            onClick={() => onMarkFiledClick(p)}
                          >
                            <IconCheck size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
