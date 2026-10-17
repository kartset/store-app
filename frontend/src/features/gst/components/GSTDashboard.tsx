import { useState, useMemo } from 'react';
import {
  Title,
  Text,
  Group,
  Button,
  Stack,
  Paper,
  Select,
  Badge,
  Card,
  SimpleGrid,
  Tooltip,
  SegmentedControl,
  ThemeIcon,
} from '@mantine/core';
import {
  IconDownload,
  IconRefresh,
  IconLock,
  IconCheck,
  IconReceiptTax,
} from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import {
  useGSTR1Summary,
  useGSTR3BSummary,
  useGSTFilingPeriods,
  useGenerateFilingPeriod,
  downloadGSTNJson,
} from '../api';
import { GSTR1Viewer } from './GSTR1Viewer';
import { GSTR3BViewer } from './GSTR3BViewer';
import { FilingHistoryTable } from './FilingHistoryTable';
import { MarkFiledModal } from './MarkFiledModal';
import type { GSTFilingPeriod } from '../types';

function formatINR(val: number | string | undefined | null): string {
  const num = typeof val === 'string' ? parseFloat(val) : Number(val || 0);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function GSTDashboard() {
  const { data: stores, isLoading: storesLoading } = useStores();

  // Helper to generate recent 12 months options
  const monthOptions = useMemo(() => {
    const list = [];
    const date = new Date(2026, 9, 1); // October 2026 current
    for (let i = 0; i < 12; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${year}-${monthNum}`;
      const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) + ` (${monthNum}${year})`;
      list.push({ value: val, label });
    }
    return list;
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(monthOptions[0]?.value || '2026-10');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('GSTR1');

  // Modal state
  const [markFiledOpened, setMarkFiledOpened] = useState(false);
  const [modalTargetPeriod, setModalTargetPeriod] = useState<GSTFilingPeriod | null>(null);

  // Queries
  const { data: gstr1Data, isLoading: gstr1Loading, refetch: refetchGSTR1 } = useGSTR1Summary(
    selectedStore || undefined,
    selectedPeriod
  );

  const { data: gstr3bData, isLoading: gstr3bLoading, refetch: refetchGSTR3B } = useGSTR3BSummary(
    selectedStore || undefined,
    selectedPeriod
  );

  const { data: periodsData, isLoading: periodsLoading, refetch: refetchPeriods } = useGSTFilingPeriods(
    selectedStore || undefined,
    selectedPeriod
  );

  const generatePeriodMutation = useGenerateFilingPeriod();

  // Find store details
  const activeStoreObj = useMemo(() => {
    if (!stores) return null;
    return stores.find((s) => s.id === selectedStore) || null;
  }, [stores, selectedStore]);

  // Current period matching record (for GSTR1 or GSTR3B)
  const currentPeriodRecord = useMemo(() => {
    if (!periodsData) return null;
    return (
      periodsData.find(
        (p) =>
          (p.return_type === activeTab || (activeTab === 'HISTORY' && p.return_type === 'GSTR1')) &&
          (!selectedStore || p.store_id === selectedStore)
      ) || null
    );
  }, [periodsData, activeTab, selectedStore]);

  const handleRefresh = () => {
    refetchGSTR1();
    refetchGSTR3B();
    refetchPeriods();
  };

  const handleGenerateSnapshot = () => {
    const storeId = selectedStore || activeStoreObj?.id || stores?.[0]?.id;
    if (!storeId) {
      alert('Please select a specific store first to generate a persistent filing period snapshot.');
      return;
    }

    const returnType = activeTab === 'GSTR3B' ? 'GSTR3B' : 'GSTR1';
    generatePeriodMutation.mutate({
      store_id: storeId,
      period_key: selectedPeriod,
      return_type: returnType,
    });
  };

  const handleDownloadGSTN = () => {
    downloadGSTNJson(selectedStore || undefined, selectedPeriod);
  };

  const handleOpenMarkFiled = (record?: GSTFilingPeriod) => {
    if (record) {
      setModalTargetPeriod(record);
    } else {
      setModalTargetPeriod(null);
    }
    setMarkFiledOpened(true);
  };

  // Aggregate KPIs based on GSTR-1 summary or fallback to 0
  const summaryKPIs = useMemo(() => {
    if (gstr1Data?.summary) {
      return {
        grossTurnover: gstr1Data.summary.gross_turnover || 0,
        taxableValue: gstr1Data.summary.taxable_value || 0,
        cgst: gstr1Data.summary.cgst || 0,
        sgst: gstr1Data.summary.sgst || 0,
        igst: gstr1Data.summary.igst || 0,
        totalTax: gstr1Data.summary.total_tax || 0,
        invoicesCount: gstr1Data.summary.invoices_count || 0,
        creditNotesCount: gstr1Data.summary.credit_notes_count || 0,
      };
    }
    return {
      grossTurnover: 0,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
      invoicesCount: 0,
      creditNotesCount: 0,
    };
  }, [gstr1Data]);

  const storeOptions = useMemo(() => {
    const list = [{ value: '', label: 'All Registered Stores (Aggregated)' }];
    if (stores) {
      stores.forEach((s) => {
        list.push({
          value: s.id,
          label: `${s.name}${s.gst_number ? ` (${s.gst_number})` : ''}`,
        });
      });
    }
    return list;
  }, [stores]);

  return (
    <Stack gap="lg">
      {/* Top Header */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Group gap="xs">
              <ThemeIcon
                size={34}
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                }}
              >
                <IconReceiptTax size={20} color="#fff" />
              </ThemeIcon>
              <div>
                <Title order={3} fw={800} style={{ letterSpacing: '-0.02em' }}>
                  GST Compliance & Tax Returns Hub
                </Title>
                <Text size="xs" c="dimmed">
                  Official GSTR-1, GSTR-3B reconciliation, Table 12 HSN aggregation, and GSTN Offline Tool JSON export
                </Text>
              </div>
            </Group>
          </div>

          {/* Quick Actions */}
          <Group gap="xs">
            <Tooltip label="Download GST Portal Offline Tool JSON schema for GSTR-1">
              <Button
                variant="light"
                color="indigo"
                size="sm"
                leftSection={<IconDownload size={16} />}
                onClick={handleDownloadGSTN}
              >
                Export GSTN JSON
              </Button>
            </Tooltip>

            <Tooltip label="Compute and lock an immutable statutory snapshot in the database">
              <Button
                variant="outline"
                color="brand"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                loading={generatePeriodMutation.isPending}
                onClick={handleGenerateSnapshot}
              >
                Generate Snapshot
              </Button>
            </Tooltip>

            <Button
              color="teal"
              size="sm"
              leftSection={<IconCheck size={16} />}
              onClick={() => handleOpenMarkFiled(currentPeriodRecord || undefined)}
            >
              Record Filing (ARN)
            </Button>
          </Group>
        </Group>

        {/* Filter & Live Status Bar */}
        <Group justify="space-between" mt="md" pt="md" style={{ borderTop: '1px solid var(--border-subtle)' }} wrap="wrap">
          <Group gap="md">
            <Select
              label="Retail Store"
              size="xs"
              placeholder="Select store"
              data={storeOptions}
              value={selectedStore}
              onChange={(val) => setSelectedStore(val || '')}
              disabled={storesLoading}
              style={{ minWidth: 260 }}
            />

            <Select
              label="Return Filing Period"
              size="xs"
              data={monthOptions}
              value={selectedPeriod}
              onChange={(val) => setSelectedPeriod(val || monthOptions[0].value)}
              style={{ minWidth: 220 }}
            />
          </Group>

          {/* Period Status Display */}
          <Group gap="xs" align="center">
            {currentPeriodRecord ? (
              <>
                <Text size="xs" c="dimmed" fw={600}>
                  FILING STATUS:
                </Text>
                <Badge
                  color={
                    currentPeriodRecord.status === 'FILED'
                      ? 'teal'
                      : currentPeriodRecord.status === 'GENERATED'
                      ? 'blue'
                      : 'yellow'
                  }
                  variant="filled"
                  size="md"
                >
                  {currentPeriodRecord.status_display || currentPeriodRecord.status}
                </Badge>

                {currentPeriodRecord.is_locked ? (
                  <Badge color="red" variant="light" size="md" leftSection={<IconLock size={12} />}>
                    AUDIT LOCKED
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light" size="md">
                    UNLOCKED
                  </Badge>
                )}

                {currentPeriodRecord.acknowledged_ref_number && (
                  <Badge color="violet" variant="outline" size="md">
                    ARN: {currentPeriodRecord.acknowledged_ref_number}
                  </Badge>
                )}
              </>
            ) : (
              <Badge color="gray" variant="light" size="sm">
                No Snapshot Generated Yet
              </Badge>
            )}
          </Group>
        </Group>
      </Paper>

      {/* KPI Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }} spacing="sm">
        <Card withBorder p="sm" radius="md">
          <Text size="10px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
            Gross Turnover
          </Text>
          <Text fw={800} size="md" mt={4}>
            {formatINR(summaryKPIs.grossTurnover)}
          </Text>
          <Text size="10px" c="dimmed">
            {summaryKPIs.invoicesCount} Invoices
          </Text>
        </Card>

        <Card withBorder p="sm" radius="md">
          <Text size="10px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
            Net Taxable Value
          </Text>
          <Text fw={800} size="md" mt={4} c="blue">
            {formatINR(summaryKPIs.taxableValue)}
          </Text>
          <Text size="10px" c="dimmed">
            Tax Base Amount
          </Text>
        </Card>

        <Card withBorder p="sm" radius="md">
          <Text size="10px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
            CGST (Central)
          </Text>
          <Text fw={800} size="md" mt={4}>
            {formatINR(summaryKPIs.cgst)}
          </Text>
          <Text size="10px" c="dimmed">
            Intra-state share
          </Text>
        </Card>

        <Card withBorder p="sm" radius="md">
          <Text size="10px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
            SGST (State)
          </Text>
          <Text fw={800} size="md" mt={4}>
            {formatINR(summaryKPIs.sgst)}
          </Text>
          <Text size="10px" c="dimmed">
            State/UT share
          </Text>
        </Card>

        <Card withBorder p="sm" radius="md">
          <Text size="10px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
            IGST (Integrated)
          </Text>
          <Text fw={800} size="md" mt={4}>
            {formatINR(summaryKPIs.igst)}
          </Text>
          <Text size="10px" c="dimmed">
            Inter-state sales
          </Text>
        </Card>

        <Card withBorder p="sm" radius="md" style={{ borderColor: 'var(--brand-primary)' }}>
          <Text size="10px" fw={700} c="brand" style={{ textTransform: 'uppercase' }}>
            Total Tax Liability
          </Text>
          <Text fw={800} size="md" mt={4} c="brand">
            {formatINR(summaryKPIs.totalTax)}
          </Text>
          <Text size="10px" c="dimmed">
            {summaryKPIs.creditNotesCount > 0 ? `${summaryKPIs.creditNotesCount} Notes Adjusted` : 'Net Outward Tax'}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Tab Switcher */}
      <Paper withBorder radius="md" p="xs" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <SegmentedControl
          fullWidth
          value={activeTab}
          onChange={setActiveTab}
          data={[
            { label: 'GSTR-1 Outward Supplies Return', value: 'GSTR1' },
            { label: 'GSTR-3B Monthly Summary & Liability', value: 'GSTR3B' },
            { label: 'Filing History & Audit Lock Log', value: 'HISTORY' },
          ]}
        />
      </Paper>

      {/* Tab Panels */}
      {activeTab === 'GSTR1' && (
        <GSTR1Viewer data={gstr1Data} loading={gstr1Loading} />
      )}

      {activeTab === 'GSTR3B' && (
        <GSTR3BViewer data={gstr3bData} loading={gstr3bLoading} />
      )}

      {activeTab === 'HISTORY' && (
        <FilingHistoryTable
          periods={periodsData || []}
          loading={periodsLoading}
          onMarkFiledClick={(period) => handleOpenMarkFiled(period)}
        />
      )}

      {/* Mark Filed Modal */}
      <MarkFiledModal
        opened={markFiledOpened}
        onClose={() => {
          setMarkFiledOpened(false);
          setModalTargetPeriod(null);
          handleRefresh();
        }}
        storeId={modalTargetPeriod?.store_id || selectedStore || activeStoreObj?.id || stores?.[0]?.id || ''}
        periodKey={modalTargetPeriod?.period_key || selectedPeriod}
        returnType={(modalTargetPeriod?.return_type as 'GSTR1' | 'GSTR3B') || (activeTab === 'GSTR3B' ? 'GSTR3B' : 'GSTR1')}
        storeName={modalTargetPeriod?.store?.name || activeStoreObj?.name || 'Selected Store'}
      />
    </Stack>
  );
}
