import { useState } from 'react';
import {
  Tabs,
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
} from '@mantine/core';
import {
  IconBuildingStore,
  IconReceipt,
  IconUsers,
  IconFileSpreadsheet,
  IconFileInvoice,
  IconReceiptTax,
  IconFileText,
} from '@tabler/icons-react';
import { HSNSummaryTable } from './HSNSummaryTable';
import type { GSTR1Response } from '../types';

interface GSTR1ViewerProps {
  data?: GSTR1Response;
  loading?: boolean;
}

function formatINR(val: number | string | undefined | null): string {
  const num = typeof val === 'string' ? parseFloat(val) : Number(val || 0);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function GSTR1Viewer({ data, loading }: GSTR1ViewerProps) {
  const [activeTab, setActiveTab] = useState<string | null>('b2b');

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
        <Text c="dimmed">No GSTR-1 data available. Please generate or select a period.</Text>
      </Paper>
    );
  }

  const b2bCount = data.b2b?.length || 0;
  const b2clCount = data.b2cl?.length || 0;
  const b2csCount = data.b2cs?.length || 0;
  const notesCount = (data.cdnr?.length || 0) + (data.cdnur?.length || 0);
  const hsnCount = data.hsn?.length || 0;

  return (
    <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <Group justify="space-between" mb="md">
        <div>
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="indigo" variant="light">
              <IconFileSpreadsheet size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="md">
                GSTR-1: Return of Outward Supplies
              </Text>
              <Text size="xs" c="dimmed">
                GSTIN: <strong>{data.store_gstin || 'UNREGISTERED'}</strong> • Store:{' '}
                <strong>{data.store_name}</strong> • Period: <strong>{data.period_key}</strong>
              </Text>
            </div>
          </Group>
        </div>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab
            value="b2b"
            leftSection={<IconBuildingStore size={15} />}
            rightSection={<Badge size="xs" variant="filled" color={b2bCount > 0 ? 'brand' : 'gray'}>{b2bCount}</Badge>}
          >
            4. B2B Invoices
          </Tabs.Tab>

          <Tabs.Tab
            value="b2cl"
            leftSection={<IconReceipt size={15} />}
            rightSection={<Badge size="xs" variant="filled" color={b2clCount > 0 ? 'blue' : 'gray'}>{b2clCount}</Badge>}
          >
            5. B2CL (Large)
          </Tabs.Tab>

          <Tabs.Tab
            value="b2cs"
            leftSection={<IconUsers size={15} />}
            rightSection={<Badge size="xs" variant="filled" color={b2csCount > 0 ? 'teal' : 'gray'}>{b2csCount}</Badge>}
          >
            7. B2CS (Retail)
          </Tabs.Tab>

          <Tabs.Tab
            value="notes"
            leftSection={<IconFileInvoice size={15} />}
            rightSection={<Badge size="xs" variant="filled" color={notesCount > 0 ? 'orange' : 'gray'}>{notesCount}</Badge>}
          >
            9B. Credit / Debit Notes
          </Tabs.Tab>

          <Tabs.Tab
            value="hsn"
            leftSection={<IconReceiptTax size={15} />}
            rightSection={<Badge size="xs" variant="filled" color={hsnCount > 0 ? 'violet' : 'gray'}>{hsnCount}</Badge>}
          >
            12. HSN Summary
          </Tabs.Tab>

          <Tabs.Tab
            value="docs"
            leftSection={<IconFileText size={15} />}
          >
            13. Documents Issued
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 4: B2B */}
        <Tabs.Panel value="b2b">
          {b2bCount === 0 ? (
            <Box p="xl" ta="center">
              <Text c="dimmed" size="sm">No B2B invoices recorded for this tax period.</Text>
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="xs" striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <Table.Tr>
                    <Table.Th>Buyer GSTIN</Table.Th>
                    <Table.Th>Customer Name</Table.Th>
                    <Table.Th>Invoice #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>POS</Table.Th>
                    <Table.Th ta="right">Invoice Value</Table.Th>
                    <Table.Th ta="right">Taxable Value</Table.Th>
                    <Table.Th ta="right">CGST</Table.Th>
                    <Table.Th ta="right">SGST</Table.Th>
                    <Table.Th ta="right">IGST</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.b2b.map((inv) => (
                    <Table.Tr key={inv.invoice_number}>
                      <Table.Td fw={700} style={{ fontFamily: 'monospace' }}>
                        {inv.customer_gstin}
                      </Table.Td>
                      <Table.Td>{inv.customer_name || 'Registered Buyer'}</Table.Td>
                      <Table.Td fw={600}>{inv.invoice_number}</Table.Td>
                      <Table.Td>{inv.invoice_date}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light">{inv.pos}</Badge>
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>{formatINR(inv.invoice_value)}</Table.Td>
                      <Table.Td ta="right" fw={600} c="blue">{formatINR(inv.taxable_value)}</Table.Td>
                      <Table.Td ta="right">{formatINR(inv.cgst)}</Table.Td>
                      <Table.Td ta="right">{formatINR(inv.sgst)}</Table.Td>
                      <Table.Td ta="right">{formatINR(inv.igst)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>

        {/* Tab 5: B2CL */}
        <Tabs.Panel value="b2cl">
          {b2clCount === 0 ? (
            <Box p="xl" ta="center">
              <Text c="dimmed" size="sm">
                No large inter-state invoices (&gt; ₹2.5L to unregistered customers) for this period.
              </Text>
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={700}>
              <Table verticalSpacing="xs" striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <Table.Tr>
                    <Table.Th>Invoice #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Place of Supply (POS)</Table.Th>
                    <Table.Th ta="right">Invoice Value</Table.Th>
                    <Table.Th ta="right">Taxable Value</Table.Th>
                    <Table.Th ta="right">IGST</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.b2cl.map((inv) => (
                    <Table.Tr key={inv.invoice_number}>
                      <Table.Td fw={700}>{inv.invoice_number}</Table.Td>
                      <Table.Td>{inv.invoice_date}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light">{inv.pos}</Badge>
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>{formatINR(inv.invoice_value)}</Table.Td>
                      <Table.Td ta="right" fw={600} c="blue">{formatINR(inv.taxable_value)}</Table.Td>
                      <Table.Td ta="right" fw={700} c="brand">{formatINR(inv.igst)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>

        {/* Tab 7: B2CS */}
        <Tabs.Panel value="b2cs">
          {b2csCount === 0 ? (
            <Box p="xl" ta="center">
              <Text c="dimmed" size="sm">No retail consumer supplies recorded for this period.</Text>
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={700}>
              <Table verticalSpacing="xs" striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <Table.Tr>
                    <Table.Th>Place of Supply (POS)</Table.Th>
                    <Table.Th>Supply Type</Table.Th>
                    <Table.Th ta="center">Applicable Rate</Table.Th>
                    <Table.Th ta="right">Taxable Value</Table.Th>
                    <Table.Th ta="right">CGST</Table.Th>
                    <Table.Th ta="right">SGST</Table.Th>
                    <Table.Th ta="right">IGST</Table.Th>
                    <Table.Th ta="right">Total Tax</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.b2cs.map((item, idx) => {
                    const totalTax = Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0);
                    return (
                      <Table.Tr key={`${item.pos}-${item.rate}-${idx}`}>
                        <Table.Td fw={600}>
                          <Badge variant="light" size="sm">{item.pos}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" size="xs">{item.type || 'E-Commerce/Store'}</Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge color="teal" variant="light" size="xs">{item.rate}%</Badge>
                        </Table.Td>
                        <Table.Td ta="right" fw={600} c="blue">{formatINR(item.taxable_value)}</Table.Td>
                        <Table.Td ta="right">{formatINR(item.cgst)}</Table.Td>
                        <Table.Td ta="right">{formatINR(item.sgst)}</Table.Td>
                        <Table.Td ta="right">{formatINR(item.igst)}</Table.Td>
                        <Table.Td ta="right" fw={700} c="brand">{formatINR(totalTax)}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>

        {/* Tab 9B: CDNR & CDNUR */}
        <Tabs.Panel value="notes">
          <Stack gap="md">
            <div>
              <Text fw={700} size="sm" mb="xs">
                CDNR: Registered Taxpayer Notes ({data.cdnr?.length || 0})
              </Text>
              {data.cdnr?.length === 0 ? (
                <Text size="xs" c="dimmed">No registered credit notes.</Text>
              ) : (
                <Table.ScrollContainer minWidth={800}>
                  <Table verticalSpacing="xs" striped highlightOnHover>
                    <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                      <Table.Tr>
                        <Table.Th>Buyer GSTIN</Table.Th>
                        <Table.Th>Credit Note #</Table.Th>
                        <Table.Th>Note Date</Table.Th>
                        <Table.Th>Original Inv #</Table.Th>
                        <Table.Th ta="right">Note Value</Table.Th>
                        <Table.Th ta="right">Taxable Value</Table.Th>
                        <Table.Th ta="right">CGST</Table.Th>
                        <Table.Th ta="right">SGST</Table.Th>
                        <Table.Th ta="right">IGST</Table.Th>
                        <Table.Th>Reason</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.cdnr.map((note) => (
                        <Table.Tr key={note.credit_note_number}>
                          <Table.Td fw={700} style={{ fontFamily: 'monospace' }}>
                            {note.customer_gstin || 'N/A'}
                          </Table.Td>
                          <Table.Td fw={700}>{note.credit_note_number}</Table.Td>
                          <Table.Td>{note.credit_note_date}</Table.Td>
                          <Table.Td>{note.original_invoice_number}</Table.Td>
                          <Table.Td ta="right" fw={600} c="red">{formatINR(note.note_value)}</Table.Td>
                          <Table.Td ta="right" fw={600}>{formatINR(note.taxable_value)}</Table.Td>
                          <Table.Td ta="right">{formatINR(note.cgst)}</Table.Td>
                          <Table.Td ta="right">{formatINR(note.sgst)}</Table.Td>
                          <Table.Td ta="right">{formatINR(note.igst)}</Table.Td>
                          <Table.Td><Badge size="xs" variant="light">{note.reason}</Badge></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </div>

            <div>
              <Text fw={700} size="sm" mb="xs">
                CDNUR: Unregistered Consumer Notes ({data.cdnur?.length || 0})
              </Text>
              {data.cdnur?.length === 0 ? (
                <Text size="xs" c="dimmed">No unregistered credit notes.</Text>
              ) : (
                <Table.ScrollContainer minWidth={700}>
                  <Table verticalSpacing="xs" striped highlightOnHover>
                    <Table.Thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                      <Table.Tr>
                        <Table.Th>Credit Note #</Table.Th>
                        <Table.Th>Note Date</Table.Th>
                        <Table.Th>Original Inv #</Table.Th>
                        <Table.Th ta="right">Note Value</Table.Th>
                        <Table.Th ta="right">Taxable Value</Table.Th>
                        <Table.Th ta="right">CGST</Table.Th>
                        <Table.Th ta="right">SGST</Table.Th>
                        <Table.Th ta="right">IGST</Table.Th>
                        <Table.Th>Reason</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.cdnur.map((note) => (
                        <Table.Tr key={note.credit_note_number}>
                          <Table.Td fw={700}>{note.credit_note_number}</Table.Td>
                          <Table.Td>{note.credit_note_date}</Table.Td>
                          <Table.Td>{note.original_invoice_number}</Table.Td>
                          <Table.Td ta="right" fw={600} c="red">{formatINR(note.note_value)}</Table.Td>
                          <Table.Td ta="right" fw={600}>{formatINR(note.taxable_value)}</Table.Td>
                          <Table.Td ta="right">{formatINR(note.cgst)}</Table.Td>
                          <Table.Td ta="right">{formatINR(note.sgst)}</Table.Td>
                          <Table.Td ta="right">{formatINR(note.igst)}</Table.Td>
                          <Table.Td><Badge size="xs" variant="light">{note.reason}</Badge></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </div>
          </Stack>
        </Tabs.Panel>

        {/* Tab 12: HSN Summary */}
        <Tabs.Panel value="hsn">
          <HSNSummaryTable data={data.hsn || []} />
        </Tabs.Panel>

        {/* Tab 13: Documents Issued */}
        <Tabs.Panel value="docs">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card withBorder p="md" radius="md">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="sm">Invoices for Outward Supply</Text>
                <Badge color="blue" variant="light">Doc Type: INVOICE</Badge>
              </Group>
              <Stack gap="xs" mt="sm">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">From Serial Number:</Text>
                  <Text size="xs" fw={700} style={{ fontFamily: 'monospace' }}>
                    {data.doc_issue?.invoices?.from_serial || 'N/A'}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">To Serial Number:</Text>
                  <Text size="xs" fw={700} style={{ fontFamily: 'monospace' }}>
                    {data.doc_issue?.invoices?.to_serial || 'N/A'}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Total Issued:</Text>
                  <Text size="sm" fw={700}>{data.doc_issue?.invoices?.total_count ?? 0}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Cancelled:</Text>
                  <Text size="sm" fw={700} c="red">{data.doc_issue?.invoices?.cancelled_count ?? 0}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Net Number Issued:</Text>
                  <Text size="sm" fw={800} c="teal">{data.doc_issue?.invoices?.net_issued ?? 0}</Text>
                </Group>
              </Stack>
            </Card>

            <Card withBorder p="md" radius="md">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="sm">Credit Notes Register</Text>
                <Badge color="orange" variant="light">Doc Type: CREDIT_NOTE</Badge>
              </Group>
              <Stack gap="xs" mt="sm">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Total Issued:</Text>
                  <Text size="sm" fw={700}>{data.doc_issue?.credit_notes?.total_count ?? 0}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Cancelled:</Text>
                  <Text size="sm" fw={700} c="red">{data.doc_issue?.credit_notes?.cancelled_count ?? 0}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Net Number Issued:</Text>
                  <Text size="sm" fw={800} c="teal">{data.doc_issue?.credit_notes?.net_issued ?? 0}</Text>
                </Group>
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}
