import {
  Card,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Badge,
  Box,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconAward, IconTrophy } from '@tabler/icons-react';
import type { TopProductsAnalytics } from '../types';

interface TopProductsLeaderboardProps {
  data?: TopProductsAnalytics;
  isLoading: boolean;
  sortBy: 'revenue' | 'units_sold';
  onSortChange: (sort: 'revenue' | 'units_sold') => void;
}

export function TopProductsLeaderboard({
  data,
  isLoading,
  sortBy,
  onSortChange,
}: TopProductsLeaderboardProps) {
  if (isLoading || !data) {
    return (
      <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
        <Group justify="space-between" mb="md">
          <Skeleton height={20} width={180} />
          <Skeleton height={28} width={140} />
        </Group>
        <Stack gap="sm">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={48} width="100%" radius="sm" />
          ))}
        </Stack>
      </Card>
    );
  }

  const products = data.products || [];
  const maxMetric = Math.max(
    ...products.map((p) => (sortBy === 'revenue' ? p.revenue : p.units_sold)),
    1
  );

  return (
    <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Stack gap={2}>
          <Group gap="xs">
            <IconTrophy size={20} color="#f59e0b" />
            <Text fw={700} size="md">
              Top Performing Products
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Ranked SKU velocity and gross merchandise contribution
          </Text>
        </Stack>

        <SegmentedControl
          size="xs"
          value={sortBy}
          onChange={(val) => onSortChange(val as 'revenue' | 'units_sold')}
          data={[
            { label: 'By Revenue', value: 'revenue' },
            { label: 'By Units Sold', value: 'units_sold' },
          ]}
        />
      </Group>

      {products.length === 0 ? (
        <Box py={60} style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="sm">
            No product sales found for this timeframe.
          </Text>
        </Box>
      ) : (
        <Stack gap="xs">
          {products.slice(0, 7).map((prod, idx) => {
            const rank = idx + 1;
            const progress =
              sortBy === 'revenue' ? (prod.revenue / maxMetric) * 100 : (prod.units_sold / maxMetric) * 100;

            const isTop3 = rank <= 3;
            const medalColor = rank === 1 ? 'yellow' : rank === 2 ? 'gray' : rank === 3 ? 'orange' : 'dark';

            return (
              <Box
                key={prod.id}
                p="xs"
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: isTop3 ? 'var(--brand-gradient-subtle)' : 'transparent',
                }}
              >
                <Group justify="space-between" align="center" mb={4}>
                  <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon
                      size={24}
                      radius="xl"
                      color={isTop3 ? medalColor : 'gray'}
                      variant={isTop3 ? 'filled' : 'light'}
                    >
                      {rank === 1 ? (
                        <IconTrophy size={14} />
                      ) : isTop3 ? (
                        <IconAward size={14} />
                      ) : (
                        <Text size="xs" fw={700}>
                          {rank}
                        </Text>
                      )}
                    </ThemeIcon>

                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" fw={700} truncate>
                          {prod.name}
                        </Text>
                        <Badge size="xs" variant="light" color="indigo" radius="xs">
                          {prod.category_name}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" style={{ fontSize: '0.7rem' }}>
                        SKU: {prod.sku || 'N/A'} {prod.barcode ? `• Barcode: ${prod.barcode}` : ''}
                      </Text>
                    </Box>
                  </Group>

                  <Group gap="md" align="flex-end">
                    <Stack gap={0} align="flex-end">
                      <Text size="xs" fw={800}>
                        ₹{Number(prod.revenue).toLocaleString('en-IN')}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ fontSize: '0.7rem' }}>
                        {prod.units_sold} units sold
                      </Text>
                    </Stack>
                    <Tooltip label={`${prod.revenue_share_pct}% of total sales`}>
                      <Badge size="sm" variant="outline" color="brand">
                        {prod.revenue_share_pct}%
                      </Badge>
                    </Tooltip>
                  </Group>
                </Group>

                {/* Relative Velocity Bar */}
                <Box
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: 'var(--border-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      backgroundColor: rank === 1 ? '#4f46e5' : '#818cf8',
                      borderRadius: 2,
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
