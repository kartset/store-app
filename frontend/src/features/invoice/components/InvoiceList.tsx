import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconCoin,
  IconCreditCard,
  IconDeviceDesktop,
  IconEye,
  IconFileInvoice,
  IconPrinter,
  IconReceipt,
  IconReceiptRefund,
  IconRefresh,
  IconSearch,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useCreditNotes, useDailySummary, useInvoices } from '../api';
import { useStores } from '../../stores/api';
import { InvoiceDetailsDrawer } from './InvoiceDetailsDrawer';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { ThermalCreditNoteModal } from './ThermalCreditNoteModal';
import type { CreditNote, Invoice, InvoiceStatus, InvoiceType } from '../types';

export function InvoiceList() {
  const navigate = useNavigate();
  const { data: stores, isLoading: storesLoading } = useStores();

  const currentStore = useMemo(() => {
    try {
      const stored = localStorage.getItem('current_store');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const activeStoreId = useMemo(() => {
    if (selectedStoreId) return selectedStoreId;
    if (currentStore?.id) return currentStore.id;
    return stores?.[0]?.id || '';
  }, [selectedStoreId, currentStore, stores]);

  const activeStore = useMemo(() => {
    return stores?.find((s) => s.id === activeStoreId) || currentStore;
  }, [stores, activeStoreId, currentStore]);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<InvoiceType | 'ALL'>('ALL');

  // Query Invoices
  const filterParams = useMemo(() => {
    const params: Record<string, any> = {};
    if (activeStoreId) params.store_id = activeStoreId;
    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (typeFilter !== 'ALL') params.type = typeFilter;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [activeStoreId, statusFilter, typeFilter, search]);

  const { data: invoices, isLoading, refetch } = useInvoices(filterParams);
  const { data: summary, refetch: refetchSummary } = useDailySummary(activeStoreId || undefined);

  // Active Tab & Credit Notes
  const [activeTab, setActiveTab] = useState<'invoices' | 'credit_notes'>('invoices');
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);

  const { data: creditNotes, isLoading: creditNotesLoading, refetch: refetchCreditNotes } = useCreditNotes({
    store_id: activeStoreId || undefined,
    search: search.trim() || undefined,
  });

  // Drawers and Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Invoice | null>(null);

  const handleOpenDetails = (id: string) => {
    setSelectedInvoiceId(id);
    setDetailsDrawerOpen(true);
  };

  const handleOpenReceipt = (invoice: Invoice) => {
    setReceiptTarget(invoice);
    setReceiptModalOpen(true);
  };

  const handleOpenCreditNote = (cn: CreditNote) => {
    setSelectedCreditNote(cn);
    setCreditNoteModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge color="teal" variant="light" size="sm">PAID</Badge>;
      case 'CANCELLED':
        return <Badge color="red" variant="light" size="sm">CANCELLED</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge color="yellow" variant="light" size="sm">PARTIAL</Badge>;
      default:
        return <Badge color="gray" variant="light" size="sm">DRAFT</Badge>;
    }
  };

  return (
    <Box p="lg">
      <Stack gap="lg">
        {/* Header Section */}
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Box>
            <Group gap="xs">
              <ThemeIcon size={34} radius="md" color="brand" variant="filled">
                <IconReceipt size={20} />
              </ThemeIcon>
              <Title order={2} style={{ letterSpacing: '-0.02em', fontWeight: 800 }}>
                Invoices &amp; Billing Ledger
              </Title>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Real-time audit trail of counter sales, thermal receipts, and tax calculations for{' '}
              <Text component="span" fw={700} c="var(--brand-primary)">
                {activeStore?.name || 'All Locations'}
              </Text>.
            </Text>
          </Box>

          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                refetch();
                refetchSummary();
              }}
            >
              Refresh
            </Button>
            <Button
              color="brand"
              leftSection={<IconDeviceDesktop size={18} />}
              onClick={() => navigate('/pos')}
            >
              Open POS Cashier
            </Button>
          </Group>
        </Group>

        {/* Real-time Sales KPI Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Card withBorder padding="md" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Today's Gross Sales
              </Text>
              <ThemeIcon color="teal" variant="light" size="sm" radius="sm">
                <IconTrendingUp size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={900} size="xl" mt="xs" c="teal">
              ₹{Number(summary?.total_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
            <Text size="11px" c="dimmed" mt={4}>
              GST Collected: ₹{Number(summary?.total_gst || 0).toFixed(2)}
            </Text>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Receipts Cleared
              </Text>
              <ThemeIcon color="brand" variant="light" size="sm" radius="sm">
                <IconFileInvoice size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={900} size="xl" mt="xs">
              {summary?.paid_invoices_count || 0} Paid
            </Text>
            <Text size="11px" c="dimmed" mt={4}>
              {summary?.cancelled_invoices_count || 0} Voided / Cancelled
            </Text>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Cash vs Digital
              </Text>
              <ThemeIcon color="blue" variant="light" size="sm" radius="sm">
                <IconCreditCard size={14} />
              </ThemeIcon>
            </Group>
            <Group gap="xs" mt="xs">
              <Text size="sm" fw={800}>
                ₹{Number(summary?.tender_breakdown?.cash || 0).toFixed(0)} <Text component="span" size="10px" c="dimmed">Cash</Text>
              </Text>
              <Text size="xs" c="dimmed">•</Text>
              <Text size="sm" fw={800} c="blue">
                ₹{Number(summary?.tender_breakdown?.upi || 0).toFixed(0)} <Text component="span" size="10px" c="dimmed">UPI</Text>
              </Text>
            </Group>
            <Text size="11px" c="dimmed" mt={4}>
              Card Total: ₹{Number(summary?.tender_breakdown?.card || 0).toFixed(0)}
            </Text>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                Loyalty Points Used
              </Text>
              <ThemeIcon color="orange" variant="light" size="sm" radius="sm">
                <IconCoin size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={900} size="xl" mt="xs" c="orange">
              ₹{Number(summary?.loyalty_discount || 0).toFixed(2)}
            </Text>
            <Text size="11px" c="dimmed" mt={4}>
              Discounts: ₹{Number(summary?.total_discount || 0).toFixed(2)}
            </Text>
          </Card>
        </SimpleGrid>

        {/* Filter Toolbar */}
        <Paper withBorder p="md" radius="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
            <Select
              label="Store Location"
              placeholder="Select store"
              data={stores?.map((s) => ({ value: s.id, label: s.name })) || []}
              value={activeStoreId}
              onChange={(val) => setSelectedStoreId(val || '')}
              leftSection={<IconBuildingStore size={16} />}
              disabled={storesLoading}
              clearable={false}
            />

            <TextInput
              label="Search Invoices"
              placeholder="Search by invoice # or customer phone..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
            />

            <Select
              label="Status"
              data={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'PAID', label: 'Paid' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter((val as InvoiceStatus) || 'ALL')}
            />

            <Select
              label="Type"
              data={[
                { value: 'ALL', label: 'All Types' },
                { value: 'POS', label: 'POS Counter' },
                { value: 'ONLINE', label: 'Online Order' },
                { value: 'RETURN', label: 'Return / Credit Note' },
              ]}
              value={typeFilter}
              onChange={(val) => setTypeFilter((val as InvoiceType) || 'ALL')}
            />
          </SimpleGrid>
        </Paper>

        {/* Navigation Tabs & Actions */}
        <Group justify="space-between" align="center" wrap="wrap">
          <SegmentedControl
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'invoices' | 'credit_notes')}
            data={[
              {
                value: 'invoices',
                label: (
                  <Group gap={6}>
                    <IconFileInvoice size={14} />
                    <span>Invoices ({invoices?.length || 0})</span>
                  </Group>
                ),
              },
              {
                value: 'credit_notes',
                label: (
                  <Group gap={6}>
                    <IconReceiptRefund size={14} />
                    <span>Credit Notes / Returns ({creditNotes?.length || 0})</span>
                  </Group>
                ),
              },
            ]}
          />

          <Button
            size="xs"
            variant="subtle"
            leftSection={<IconRefresh size={14} />}
            onClick={() => {
              refetch();
              refetchCreditNotes();
              refetchSummary();
            }}
          >
            Refresh Data
          </Button>
        </Group>

        {activeTab === 'invoices' ? (
          /* Invoices Data Table */
          <Paper withBorder radius="md">
          {isLoading ? (
            <Center py="xl">
              <Loader color="brand" />
            </Center>
          ) : !invoices || invoices.length === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="xs">
                <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                  <IconReceipt size={24} />
                </ThemeIcon>
                <Text fw={700}>No Invoices Found</Text>
                <Text size="sm" c="dimmed">
                  There are no invoices matching your current filters or store.
                </Text>
                <Button
                  size="xs"
                  color="brand"
                  leftSection={<IconDeviceDesktop size={14} />}
                  onClick={() => navigate('/pos')}
                  mt="xs"
                >
                  Create First Sale in POS
                </Button>
              </Stack>
            </Center>
          ) : (
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice #</Table.Th>
                  <Table.Th>Date &amp; Time</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Items Billed</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total Amount</Table.Th>
                  <Table.Th>Tenders</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invoices.map((inv) => (
                  <Table.Tr key={inv.id}>
                    <Table.Td>
                      <Text
                        fw={700}
                        size="sm"
                        c="var(--brand-primary)"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleOpenDetails(inv.id)}
                      >
                        {inv.invoice_number}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Text size="xs" fw={500}>
                        {new Date(inv.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {new Date(inv.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Text size="xs" fw={600}>
                        {inv.customer_name_snapshot || inv.customer?.name || 'Walk-in Customer'}
                      </Text>
                      {(inv.customer_phone_snapshot || inv.customer?.mobile_number) && (
                        <Text size="10px" c="dimmed">
                          {inv.customer_phone_snapshot || inv.customer?.mobile_number}
                        </Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Tooltip
                        label={inv.items?.map((it) => `${it.product_name_snapshot} (x${it.quantity})`).join(', ') || 'Items'}
                        multiline
                        w={260}
                      >
                        <Badge variant="light" color="gray" size="sm">
                          {inv.items?.length || 0} items
                        </Badge>
                      </Tooltip>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={800} size="sm">
                        ₹{Number(inv.grand_total).toFixed(2)}
                      </Text>
                      {Number(inv.total_gst) > 0 && (
                        <Text size="10px" c="dimmed">
                          Incl. ₹{Number(inv.total_gst).toFixed(2)} GST
                        </Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Group gap={4}>
                        {inv.payments?.map((p, idx) => (
                          <Badge key={idx} size="xs" color="teal" variant="outline">
                            {p.method}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>

                    <Table.Td>{getStatusBadge(inv.status)}</Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Group gap={4} justify="flex-end">
                        <Tooltip label="View Bill Details">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => handleOpenDetails(inv.id)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Print Thermal Receipt">
                          <ActionIcon
                            variant="subtle"
                            color="brand"
                            size="sm"
                            onClick={() => handleOpenReceipt(inv)}
                          >
                            <IconPrinter size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
        ) : (
          /* Credit Notes / Sales Returns Data Table */
          <Paper withBorder radius="md">
            {creditNotesLoading ? (
              <Center py="xl">
                <Loader color="brand" />
              </Center>
            ) : !creditNotes || creditNotes.length === 0 ? (
              <Center py={60}>
                <Stack align="center" gap="xs">
                  <ThemeIcon size={48} radius="xl" color="red" variant="light">
                    <IconReceiptRefund size={24} />
                  </ThemeIcon>
                  <Text fw={700}>No Credit Notes Found</Text>
                  <Text size="sm" c="dimmed">
                    There are no sales returns or credit notes recorded for this store location.
                  </Text>
                </Stack>
              </Center>
            ) : (
              <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Credit Note #</Table.Th>
                    <Table.Th>Date &amp; Time</Table.Th>
                    <Table.Th>Original Bill</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Return Reason</Table.Th>
                    <Table.Th>Refund Mode</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Refund Amount</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {creditNotes.map((cn) => (
                    <Table.Tr key={cn.id}>
                      <Table.Td>
                        <Text
                          fw={700}
                          size="sm"
                          c="red.7"
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleOpenCreditNote(cn)}
                        >
                          {cn.credit_note_number}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={500}>
                          {new Date(cn.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                        <Text size="10px" c="dimmed">
                          {new Date(cn.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="xs"
                          fw={600}
                          c="var(--brand-primary)"
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleOpenDetails(cn.invoice_id)}
                        >
                          #{cn.invoice_number || 'Invoice'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600}>
                          {cn.customer_name || cn.customer?.name || 'Walk-in Customer'}
                        </Text>
                        {(cn.customer_phone || cn.customer?.mobile_number) && (
                          <Text size="10px" c="dimmed">
                            {cn.customer_phone || cn.customer?.mobile_number}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="outline" color="gray">
                          {cn.reason}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          variant="filled"
                          color={
                            cn.refund_method === 'STORE_CREDIT'
                              ? 'teal'
                              : cn.refund_method === 'CASH'
                              ? 'green'
                              : 'blue'
                          }
                        >
                          {cn.refund_method.replace('_', ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={900} size="sm" c="red.7">
                          ₹{Number(cn.total_refund_amount).toFixed(2)}
                        </Text>
                        <Text size="10px" c="dimmed">
                          Tax Rev: ₹{Number(cn.total_gst).toFixed(2)}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Group gap={4} justify="flex-end">
                          <Tooltip label="Print Credit Note Slip">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => handleOpenCreditNote(cn)}
                            >
                              <IconPrinter size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="View Original Invoice">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={() => handleOpenDetails(cn.invoice_id)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        )}
      </Stack>

      {/* Invoice Details Drawer */}
      <InvoiceDetailsDrawer
        invoiceId={selectedInvoiceId}
        opened={detailsDrawerOpen}
        onClose={() => {
          setDetailsDrawerOpen(false);
          setSelectedInvoiceId(null);
        }}
      />

      {/* Thermal Receipt Modal */}
      <ThermalReceiptModal
        opened={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptTarget(null);
        }}
        invoice={receiptTarget}
      />

      {/* Thermal Credit Note Modal */}
      <ThermalCreditNoteModal
        opened={creditNoteModalOpen}
        onClose={() => {
          setCreditNoteModalOpen(false);
          setSelectedCreditNote(null);
        }}
        creditNote={selectedCreditNote}
      />
    </Box>
  );
}
