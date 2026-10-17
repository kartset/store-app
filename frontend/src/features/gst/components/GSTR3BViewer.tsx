import {
  Paper,
  Table,
  Badge,
  Text,
  Group,
  Stack,
  Skeleton,
  Box,
  Card,
  SimpleGrid,
  ThemeIcon,
  Alert,
} from '@mantine/core';
import {
  IconFileInvoice,
  IconReceiptTax,
  IconCoins,
  IconInfoCircle,
} from '@tabler/icons-react';
import type { GSTR3BResponse } from '../types';

interface GSTR3BViewerProps {
  data?: GSTR3BResponse;
  loading?: boolean;
}

function formatINR(val: number | string | undefined | null): string {
  const num = typeof val === 'string' ? parseFloat(val) : Number(val || 0);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function GSTR3BViewer({ data, loading }: GSTR3BViewerProps) {
  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Skeleton height={40} mb="md" />
        <Skeleton height={250} />
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper withBorder p="xl" radius="md" ta="center">
        <Text c="dimmed">No GSTR-3B return data available. Please generate or select a period.</Text>
      </Paper>
    );
  }

  const t31 = data.table_3_1;
  const t32 = data.table_3_2 || [];
  const liability = data.tax_liability;

  return (
    <Stack gap="lg">
      {/* Table 3.1 */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <Group justify="space-between" mb="sm">
          <div>
            <Group gap="xs">
              <ThemeIcon size={28} radius="md" color="teal" variant="light">
                <IconReceiptTax size={18} />
              </ThemeIcon>
              <div>
                <Text fw={700} size="md">
                  Table 3.1: Details of Outward Supplies & Inward Supplies Liable to Reverse Charge
                </Text>
                <Text size="xs" c="dimmed">
                  Official statutory table format for self-assessed tax liability computation
                </Text>
              </div>
            </Group>
          </div>
          <Badge variant="light" color="indigo" size="md">
            Period: {data.period_key}
          </Badge>
        </Group>

        <Table.ScrollContainer minWidth={800}>
          <Table verticalSpacing="sm" striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <Table.Tr>
                <Table.Th style={{ width: '40%' }}>Nature of Supplies</Table.Th>
                <Table.Th ta="right">Total Taxable Value</Table.Th>
                <Table.Th ta="right">Integrated Tax (IGST)</Table.Th>
                <Table.Th ta="right">Central Tax (CGST)</Table.Th>
                <Table.Th ta="right">State/UT Tax (SGST)</Table.Th>
                <Table.Th ta="right">Cess</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {/* Row (a) */}
              <Table.Tr>
                <Table.Td>
                  <Text fw={600} size="sm">
                    (a) Outward taxable supplies (other than zero rated, nil rated & exempted)
                  </Text>
                </Table.Td>
                <Table.Td ta="right" fw={700} c="blue">
                  {formatINR(t31?.outward_taxable_supplies?.taxable_value)}
                </Table.Td>
                <Table.Td ta="right">{formatINR(t31?.outward_taxable_supplies?.igst)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.outward_taxable_supplies?.cgst)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.outward_taxable_supplies?.sgst)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.outward_taxable_supplies?.cess)}</Table.Td>
              </Table.Tr>

              {/* Row (b) */}
              <Table.Tr>
                <Table.Td>
                  <Text size="sm">(b) Outward taxable supplies (zero rated / exports)</Text>
                </Table.Td>
                <Table.Td ta="right">{formatINR(t31?.zero_rated?.taxable_value)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.zero_rated?.igst)}</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.zero_rated?.cess)}</Table.Td>
              </Table.Tr>

              {/* Row (c) */}
              <Table.Tr>
                <Table.Td>
                  <Text size="sm">(c) Other outward supplies (Nil rated, exempted)</Text>
                </Table.Td>
                <Table.Td ta="right">{formatINR(t31?.nil_exempt?.taxable_value)}</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
              </Table.Tr>

              {/* Row (d) */}
              <Table.Tr>
                <Table.Td>
                  <Text size="sm">(d) Inward supplies (liable to reverse charge)</Text>
                </Table.Td>
                <Table.Td ta="right">{formatINR(t31?.reverse_charge?.taxable_value)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.reverse_charge?.igst)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.reverse_charge?.cgst)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.reverse_charge?.sgst)}</Table.Td>
                <Table.Td ta="right">{formatINR(t31?.reverse_charge?.cess)}</Table.Td>
              </Table.Tr>

              {/* Row (e) */}
              <Table.Tr>
                <Table.Td>
                  <Text size="sm">(e) Non-GST outward supplies</Text>
                </Table.Td>
                <Table.Td ta="right">{formatINR(t31?.non_gst?.taxable_value)}</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
                <Table.Td ta="right" c="dimmed">—</Table.Td>
              </Table.Tr>
            </Table.Tbody>
            <Table.Tfoot style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <Table.Tr>
                <Table.Th fw={800}>Total Net Tax Liability</Table.Th>
                <Table.Th ta="right" fw={800} c="blue">
                  {formatINR(liability?.total_taxable_value)}
                </Table.Th>
                <Table.Th ta="right" fw={800}>
                  {formatINR(liability?.igst)}
                </Table.Th>
                <Table.Th ta="right" fw={800}>
                  {formatINR(liability?.cgst)}
                </Table.Th>
                <Table.Th ta="right" fw={800}>
                  {formatINR(liability?.sgst)}
                </Table.Th>
                <Table.Th ta="right" fw={800} c="brand">
                  {formatINR(liability?.total_tax_payable)}
                </Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {/* Table 3.2 */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <Group justify="space-between" mb="sm">
          <div>
            <Group gap="xs">
              <ThemeIcon size={28} radius="md" color="blue" variant="light">
                <IconFileInvoice size={18} />
              </ThemeIcon>
              <div>
                <Text fw={700} size="md">
                  Table 3.2: Inter-State Supplies Made to Unregistered Persons
                </Text>
                <Text size="xs" c="dimmed">
                  Subset of Table 3.1(a) supplies routed to other states for IGST apportionment
                </Text>
              </div>
            </Group>
          </div>
          <Badge variant="outline" size="sm">
            {t32.length} State Jurisdictions
          </Badge>
        </Group>

        {t32.length === 0 ? (
          <Box p="md" ta="center">
            <Text c="dimmed" size="xs">
              No inter-state supplies made to unregistered buyers in this tax period.
            </Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table verticalSpacing="xs" striped highlightOnHover>
              <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <Table.Tr>
                  <Table.Th>Place of Supply (State / UT)</Table.Th>
                  <Table.Th ta="right">Total Taxable Value</Table.Th>
                  <Table.Th ta="right">Amount of Integrated Tax (IGST)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {t32.map((item, i) => (
                  <Table.Tr key={`${item.pos}-${i}`}>
                    <Table.Td fw={600}>
                      <Badge variant="light" color="indigo" size="sm">
                        {item.pos}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right" fw={600} c="blue">
                      {formatINR(item.taxable_value)}
                    </Table.Td>
                    <Table.Td ta="right" fw={700} c="brand">
                      {formatINR(item.igst)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      {/* Tax Liability Breakdown Cards */}
      <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-subtle)' }}>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconCoins size={20} color="var(--brand-primary)" />
            <Text fw={700} size="sm">
              Tax Payable & Payment Breakdown (Cash & ITC)
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Self-assessed statutory obligation to discharge
          </Text>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Paper withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">CGST Payable</Text>
            <Text fw={700} size="lg">{formatINR(liability?.cgst)}</Text>
            <Text size="10px" c="dimmed">Central Tax Account</Text>
          </Paper>

          <Paper withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">SGST Payable</Text>
            <Text fw={700} size="lg">{formatINR(liability?.sgst)}</Text>
            <Text size="10px" c="dimmed">State/UT Tax Account</Text>
          </Paper>

          <Paper withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">IGST Payable</Text>
            <Text fw={700} size="lg">{formatINR(liability?.igst)}</Text>
            <Text size="10px" c="dimmed">Integrated Tax Account</Text>
          </Paper>

          <Paper withBorder p="sm" radius="md" style={{ borderColor: 'var(--brand-primary)' }}>
            <Text size="xs" c="brand" fw={600}>Total Net Tax Liability</Text>
            <Text fw={800} size="lg" c="brand">{formatINR(liability?.total_tax_payable)}</Text>
            <Text size="10px" c="dimmed">Cumulative Payment Due</Text>
          </Paper>
        </SimpleGrid>

        <Alert
          icon={<IconInfoCircle size={16} />}
          title="Filing Rule"
          color="blue"
          variant="light"
          radius="md"
          mt="md"
        >
          GSTR-3B must be filed by the 20th of the subsequent month. Before filing, verify invoice numbers and ensure GSTR-1 outward supplies tally with Table 3.1.
        </Alert>
      </Card>
    </Stack>
  );
}
