import { useState, useMemo } from 'react';
import {
  Table,
  TextInput,
  Group,
  Text,
  Badge,
  Paper,
  Box,
  Skeleton,
} from '@mantine/core';
import { IconSearch, IconReceiptTax } from '@tabler/icons-react';
import type { GSTR1HSNEntry } from '../types';

interface HSNSummaryTableProps {
  data: GSTR1HSNEntry[];
  loading?: boolean;
}

function formatINR(val: number | string): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HSNSummaryTable({ data, loading }: HSNSummaryTableProps) {
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase().trim();
    return data.filter(
      (item) =>
        item.hsn_code?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => ({
        qty: acc.qty + Number(item.total_quantity || 0),
        value: acc.value + Number(item.total_value || 0),
        taxable: acc.taxable + Number(item.taxable_value || 0),
        cgst: acc.cgst + Number(item.cgst || 0),
        sgst: acc.sgst + Number(item.sgst || 0),
        igst: acc.igst + Number(item.igst || 0),
        tax: acc.tax + Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0),
      }),
      { qty: 0, value: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }
    );
  }, [filteredData]);

  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Skeleton height={40} mb="md" />
        <Skeleton height={200} />
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <Group justify="space-between" mb="md">
        <div>
          <Group gap="xs">
            <IconReceiptTax size={18} color="var(--brand-primary)" />
            <Text fw={700} size="sm">
              Table 12: HSN-Wise Summary of Outward Supplies
            </Text>
            <Badge size="sm" variant="light" color="indigo">
              {filteredData.length} Harmonized Codes
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            Aggregated by 4-8 digit HSN/SAC code with unit quantity and tax rate splits
          </Text>
        </div>
        <TextInput
          placeholder="Filter by HSN or Description..."
          leftSection={<IconSearch size={14} />}
          size="xs"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ width: 260 }}
        />
      </Group>

      {filteredData.length === 0 ? (
        <Box p="xl" ta="center">
          <Text c="dimmed" size="sm">
            No HSN summary records found for this period.
          </Text>
        </Box>
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table verticalSpacing="xs" striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <Table.Tr>
                <Table.Th>HSN/SAC</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>UOM</Table.Th>
                <Table.Th ta="right">Total Qty</Table.Th>
                <Table.Th ta="right">Total Value</Table.Th>
                <Table.Th ta="right">Taxable Value</Table.Th>
                <Table.Th ta="center">Rate</Table.Th>
                <Table.Th ta="right">CGST</Table.Th>
                <Table.Th ta="right">SGST</Table.Th>
                <Table.Th ta="right">IGST</Table.Th>
                <Table.Th ta="right">Total Tax</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredData.map((item, index) => {
                const totalTax = Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0);
                return (
                  <Table.Tr key={`${item.hsn_code}-${item.rate}-${index}`}>
                    <Table.Td fw={700} style={{ fontFamily: 'monospace' }}>
                      {item.hsn_code}
                    </Table.Td>
                    <Table.Td style={{ maxWidth: 220 }}>
                      <Text size="xs" lineClamp={1}>
                        {item.description || 'General Supplies'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline" size="xs">
                        {item.uom || 'OTH'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">{Number(item.total_quantity || 0).toLocaleString('en-IN')}</Table.Td>
                    <Table.Td ta="right" fw={600}>
                      {formatINR(item.total_value)}
                    </Table.Td>
                    <Table.Td ta="right" fw={600} c="blue">
                      {formatINR(item.taxable_value)}
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge color="teal" variant="light" size="xs">
                        {item.rate}%
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">{formatINR(item.cgst)}</Table.Td>
                    <Table.Td ta="right">{formatINR(item.sgst)}</Table.Td>
                    <Table.Td ta="right">{formatINR(item.igst)}</Table.Td>
                    <Table.Td ta="right" fw={700} c="brand">
                      {formatINR(totalTax)}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
            <Table.Tfoot style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <Table.Tr>
                <Table.Th colSpan={3}>
                  <Text fw={700} size="sm">
                    Total
                  </Text>
                </Table.Th>
                <Table.Th ta="right" fw={700}>
                  {totals.qty.toLocaleString('en-IN')}
                </Table.Th>
                <Table.Th ta="right" fw={700}>
                  {formatINR(totals.value)}
                </Table.Th>
                <Table.Th ta="right" fw={700} c="blue">
                  {formatINR(totals.taxable)}
                </Table.Th>
                <Table.Th />
                <Table.Th ta="right" fw={700}>
                  {formatINR(totals.cgst)}
                </Table.Th>
                <Table.Th ta="right" fw={700}>
                  {formatINR(totals.sgst)}
                </Table.Th>
                <Table.Th ta="right" fw={700}>
                  {formatINR(totals.igst)}
                </Table.Th>
                <Table.Th ta="right" fw={800} c="brand">
                  {formatINR(totals.tax)}
                </Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}
