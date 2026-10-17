import {
  Card,
  Grid,
  Group,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Badge,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCoins,
  IconReceipt,
  IconReceiptRefund,
  IconScale,
  IconTrendingUp,
} from '@tabler/icons-react';
import type { OverviewAnalytics } from '../types';

interface ExecutiveKPICardsProps {
  data?: OverviewAnalytics;
  isLoading: boolean;
}

export function ExecutiveKPICards({ data, isLoading }: ExecutiveKPICardsProps) {
  if (isLoading || !data) {
    return (
      <Grid gap="md">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 2 }}>
            <Card padding="md" radius="md" withBorder>
              <Skeleton height={16} width="60%" mb="xs" />
              <Skeleton height={28} width="80%" mb="xs" />
              <Skeleton height={14} width="40%" />
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    );
  }

  const {
    net_sales = 0,
    gross_sales = 0,
    returns_total = 0,
    total_tax = 0,
    total_invoices = 0,
    total_orders = 0,
    aov = 0,
    comparison,
  } = data;

  const salesGrowth = comparison?.sales_growth_pct ?? 0;
  const isGrowthPositive = salesGrowth >= 0;

  const refundRate = gross_sales > 0 ? ((returns_total / gross_sales) * 100).toFixed(1) : '0.0';

  return (
    <Grid gap="md">
      {/* 1. Net Sales */}
      <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
        <Card
          padding="lg"
          radius="md"
          withBorder
          style={{
            background: 'var(--brand-gradient-subtle)',
            borderColor: 'var(--brand-primary)',
          }}
        >
          <Group justify="space-between" align="flex-start" mb="xs">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Net Realized Sales
              </Text>
              <Text size="xl" fw={800} style={{ fontSize: '1.85rem' }}>
                ₹{Number(net_sales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Stack>
            <ThemeIcon size={44} radius="md" color="brand" variant="light">
              <IconTrendingUp size={24} />
            </ThemeIcon>
          </Group>
          <Group justify="space-between" mt="xs">
            <Tooltip
              label={`Prior Period (${comparison?.prior_period_start || ''} to ${comparison?.prior_period_end || ''}): ₹${Number(comparison?.prev_net || 0).toLocaleString('en-IN')}`}
            >
              <Badge
                color={isGrowthPositive ? 'teal' : 'red'}
                variant="light"
                leftSection={isGrowthPositive ? <IconArrowUpRight size={14} /> : <IconArrowDownRight size={14} />}
              >
                {isGrowthPositive ? `+${salesGrowth}%` : `${salesGrowth}%`} vs prior period
              </Badge>
            </Tooltip>
            <Text size="xs" c="dimmed">
              Gross: ₹{Number(gross_sales).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Text>
          </Group>
        </Card>
      </Grid.Col>

      {/* 2. Average Order Value (AOV) */}
      <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
        <Card padding="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start" mb={4}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Avg Order Value
            </Text>
            <ThemeIcon size={32} radius="md" color="cyan" variant="light">
              <IconScale size={18} />
            </ThemeIcon>
          </Group>
          <Text size="lg" fw={800}>
            ₹{Number(aov).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Per billed transaction
          </Text>
        </Card>
      </Grid.Col>

      {/* 3. Total Invoices */}
      <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
        <Card padding="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start" mb={4}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Total Invoices
            </Text>
            <ThemeIcon size={32} radius="md" color="indigo" variant="light">
              <IconReceipt size={18} />
            </ThemeIcon>
          </Group>
          <Text size="lg" fw={800}>
            {total_invoices.toLocaleString()}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {comparison?.invoice_growth_pct !== undefined ? (
              <span style={{ color: comparison.invoice_growth_pct >= 0 ? '#10b981' : '#ef4444' }}>
                {comparison.invoice_growth_pct >= 0 ? `+${comparison.invoice_growth_pct}%` : `${comparison.invoice_growth_pct}%`}
              </span>
            ) : null}{' '}
            txns billed
          </Text>
        </Card>
      </Grid.Col>

      {/* 4. Total Returns / Refunds */}
      <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
        <Card padding="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start" mb={4}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Returns Deducted
            </Text>
            <ThemeIcon size={32} radius="md" color="orange" variant="light">
              <IconReceiptRefund size={18} />
            </ThemeIcon>
          </Group>
          <Text size="lg" fw={800} c={returns_total > 0 ? 'orange.7' : undefined}>
            ₹{Number(returns_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {refundRate}% return rate
          </Text>
        </Card>
      </Grid.Col>

      {/* 5. GST / Tax Collected */}
      <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
        <Card padding="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start" mb={4}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Total GST
            </Text>
            <ThemeIcon size={32} radius="md" color="teal" variant="light">
              <IconCoins size={18} />
            </ThemeIcon>
          </Group>
          <Text size="lg" fw={800}>
            ₹{Number(total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Orders: {total_orders.toLocaleString()}
          </Text>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
