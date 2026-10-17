import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
  TextInput,
  Paper,
} from '@mantine/core';
import {
  IconChartBar,
  IconDownload,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import {
  useAnalyticsOverview,
  useCategoryBreakdown,
  useHourlyFootfall,
  useInventoryHealth,
  usePaymentMethods,
  useSalesTrend,
  useTopProducts,
} from '../api';
import { CategoryBreakdownChart } from './CategoryBreakdownChart';
import { ExecutiveKPICards } from './ExecutiveKPICards';
import { HourlyFootfallChart } from './HourlyFootfallChart';
import { InventoryHealthCard } from './InventoryHealthCard';
import { PaymentTenderBreakdown } from './PaymentTenderBreakdown';
import { SalesTrendChart } from './SalesTrendChart';
import { TopProductsLeaderboard } from './TopProductsLeaderboard';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function AnalyticsDashboard() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [trendGranularity, setTrendGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [productSortBy, setProductSortBy] = useState<'revenue' | 'units_sold'>('revenue');

  // Compute active start & end dates
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    if (datePreset === 'today') {
      const d = formatDate(today);
      return { startDate: d, endDate: d };
    }
    if (datePreset === '7d') {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { startDate: formatDate(s), endDate: formatDate(today) };
    }
    if (datePreset === '30d') {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { startDate: formatDate(s), endDate: formatDate(today) };
    }
    if (datePreset === 'this_month') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(s), endDate: formatDate(today) };
    }
    if (datePreset === 'last_month') {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: formatDate(s), endDate: formatDate(e) };
    }
    if (datePreset === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    // Default 30d
    const s = new Date(today);
    s.setDate(s.getDate() - 29);
    return { startDate: formatDate(s), endDate: formatDate(today) };
  }, [datePreset, customStart, customEnd]);

  const activeStoreId = selectedStoreId === 'all' ? undefined : selectedStoreId;

  // Stores
  const { data: stores = [] } = useStores();

  // Analytics queries
  const filterParams = useMemo(
    () => ({
      store_id: activeStoreId,
      start_date: startDate,
      end_date: endDate,
    }),
    [activeStoreId, startDate, endDate]
  );

  const overviewQuery = useAnalyticsOverview(filterParams);
  const trendQuery = useSalesTrend({ ...filterParams, granularity: trendGranularity });
  const topProductsQuery = useTopProducts({ ...filterParams, sort_by: productSortBy, limit: 10 });
  const categoryQuery = useCategoryBreakdown(filterParams);
  const footfallQuery = useHourlyFootfall(filterParams);
  const paymentsQuery = usePaymentMethods(filterParams);
  const inventoryQuery = useInventoryHealth({ store_id: activeStoreId });

  const isRefreshing =
    overviewQuery.isFetching ||
    trendQuery.isFetching ||
    topProductsQuery.isFetching ||
    categoryQuery.isFetching ||
    footfallQuery.isFetching ||
    paymentsQuery.isFetching ||
    inventoryQuery.isFetching;

  const handleRefreshAll = () => {
    overviewQuery.refetch();
    trendQuery.refetch();
    topProductsQuery.refetch();
    categoryQuery.refetch();
    footfallQuery.refetch();
    paymentsQuery.refetch();
    inventoryQuery.refetch();
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!overviewQuery.data) return;
    const ov = overviewQuery.data;

    let csv = `RETAIL BUSINESS INTELLIGENCE REPORT\n`;
    csv += `Period: ${ov.period_start} to ${ov.period_end}\n`;
    csv += `Store: ${selectedStoreId === 'all' ? 'All Outlets Combined' : selectedStoreId}\n\n`;

    csv += `EXECUTIVE FINANCIAL KPIs\n`;
    csv += `Gross Sales,₹${ov.gross_sales}\n`;
    csv += `Returns & Refunds,₹${ov.returns_total}\n`;
    csv += `Net Sales,₹${ov.net_sales}\n`;
    csv += `Total Tax (GST),₹${ov.total_tax}\n`;
    csv += `Total Invoices,${ov.total_invoices}\n`;
    csv += `Total Orders,${ov.total_orders}\n`;
    csv += `Average Order Value,₹${ov.aov}\n`;
    csv += `Sales Growth vs Prior Period,${ov.comparison?.sales_growth_pct}%\n\n`;

    if (categoryQuery.data?.categories) {
      csv += `CATEGORY REVENUE BREAKDOWN\n`;
      csv += `Category Name,Revenue,Units Sold,Revenue Share %\n`;
      categoryQuery.data.categories.forEach((c) => {
        csv += `"${c.category_name}",${c.revenue},${c.units_sold},${c.revenue_share_pct}%\n`;
      });
      csv += `\n`;
    }

    if (topProductsQuery.data?.products) {
      csv += `TOP PERFORMING PRODUCTS\n`;
      csv += `Product Name,SKU,Category,Revenue,Units Sold,Revenue Share %\n`;
      topProductsQuery.data.products.forEach((p) => {
        csv += `"${p.name}","${p.sku || ''}","${p.category_name}",${p.revenue},${p.units_sold},${p.revenue_share_pct}%\n`;
      });
      csv += `\n`;
    }

    if (paymentsQuery.data?.payment_methods) {
      csv += `PAYMENT TENDER SPLIT\n`;
      csv += `Tender Method,Transactions,Amount,Share %\n`;
      paymentsQuery.data.payment_methods.forEach((pm) => {
        csv += `"${pm.label || pm.method}",${pm.count},${pm.total_amount},${pm.percentage}%\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `store_analytics_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const storeOptions = useMemo(() => {
    const list = [{ label: 'All Stores & Outlets', value: 'all' }];
    stores.forEach((s) => list.push({ label: s.name, value: s.id }));
    return list;
  }, [stores]);

  return (
    <Container size="xxl" px="md" py="lg">
      <Stack gap="lg">
        {/* Top Header & Filter Controls */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            background: 'var(--bg-surface)',
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="sm">
              <IconChartBar size={28} color="var(--brand-primary)" />
              <Box>
                <Group gap="xs">
                  <Title order={3} fw={800} style={{ letterSpacing: '-0.02em' }}>
                    Business Intelligence & Executive Analytics
                  </Title>
                  <Badge
                    size="sm"
                    color="brand"
                    variant="light"
                    leftSection={<IconSparkles size={12} />}
                  >
                    REAL-TIME
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Comprehensive sales, tender reconciliation, velocity, and catalog health
                </Text>
              </Box>
            </Group>

            {/* Controls Bar */}
            <Group gap="xs" wrap="wrap">
              <Select
                size="xs"
                w={200}
                value={selectedStoreId}
                onChange={(val) => setSelectedStoreId(val || 'all')}
                data={storeOptions}
                placeholder="Select Store"
                comboboxProps={{ shadow: 'md', transitionProps: { transition: 'pop', duration: 150 } }}
              />

              <Select
                size="xs"
                w={140}
                value={datePreset}
                onChange={(val) => setDatePreset(val || '30d')}
                data={[
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 Days', value: '7d' },
                  { label: 'Last 30 Days', value: '30d' },
                  { label: 'This Month', value: 'this_month' },
                  { label: 'Last Month', value: 'last_month' },
                  { label: 'Custom Range', value: 'custom' },
                ]}
              />

              {datePreset === 'custom' && (
                <Group gap={4}>
                  <TextInput
                    size="xs"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.currentTarget.value)}
                  />
                  <Text size="xs" c="dimmed">
                    to
                  </Text>
                  <TextInput
                    size="xs"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.currentTarget.value)}
                  />
                </Group>
              )}

              <Tooltip label="Refresh all metrics">
                <ActionIcon
                  size="input-xs"
                  variant="default"
                  onClick={handleRefreshAll}
                  loading={isRefreshing}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>

              <Button
                size="xs"
                variant="light"
                color="brand"
                leftSection={<IconDownload size={14} />}
                onClick={handleExportCSV}
                disabled={!overviewQuery.data}
              >
                Export CSV
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* 1. Executive KPIs */}
        <ExecutiveKPICards
          data={overviewQuery.data}
          isLoading={overviewQuery.isLoading}
        />

        {/* 2. Trajectory & Payment Tender Breakdown */}
        <Grid gap="md">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <SalesTrendChart
              data={trendQuery.data}
              isLoading={trendQuery.isLoading}
              granularity={trendGranularity}
              onGranularityChange={setTrendGranularity}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <PaymentTenderBreakdown
              data={paymentsQuery.data}
              isLoading={paymentsQuery.isLoading}
            />
          </Grid.Col>
        </Grid>

        {/* 3. Top Products & Category Breakdown */}
        <Grid gap="md">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <TopProductsLeaderboard
              data={topProductsQuery.data}
              isLoading={topProductsQuery.isLoading}
              sortBy={productSortBy}
              onSortChange={setProductSortBy}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <CategoryBreakdownChart
              data={categoryQuery.data}
              isLoading={categoryQuery.isLoading}
            />
          </Grid.Col>
        </Grid>

        {/* 4. Hourly Footfall & Real-time Inventory Health */}
        <Grid gap="md">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <HourlyFootfallChart
              data={footfallQuery.data}
              isLoading={footfallQuery.isLoading}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <InventoryHealthCard
              data={inventoryQuery.data}
              isLoading={inventoryQuery.isLoading}
            />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
