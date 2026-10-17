import {
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Badge,
  Box,
  ThemeIcon,
  SimpleGrid,
  Alert,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBuildingWarehouse,
  IconCheck,
  IconCoins,
  IconExclamationMark,
} from '@tabler/icons-react';
import type { InventoryHealthData } from '../types';

interface InventoryHealthCardProps {
  data?: InventoryHealthData;
  isLoading: boolean;
}

export function InventoryHealthCard({ data, isLoading }: InventoryHealthCardProps) {
  if (isLoading || !data) {
    return (
      <Card padding="lg" radius="md" withBorder style={{ minHeight: 340 }}>
        <Group justify="space-between" mb="md">
          <Skeleton height={20} width={180} />
          <Skeleton height={24} width={120} />
        </Group>
        <SimpleGrid cols={3} mb="md">
          <Skeleton height={60} />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </SimpleGrid>
        <Skeleton height={140} width="100%" />
      </Card>
    );
  }

  const {
    total_skus = 0,
    total_valuation = 0,
    healthy_count = 0,
    low_stock_count = 0,
    out_of_stock_count = 0,
    healthy_pct = 0,
    critical_items = [],
  } = data;

  return (
    <Card padding="lg" radius="md" withBorder style={{ minHeight: 340 }}>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Stack gap={2}>
          <Group gap="xs">
            <IconBuildingWarehouse size={20} color="var(--brand-primary)" />
            <Text fw={700} size="md">
              Inventory Health & Stock Valuation
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Catalog stock levels & replenishment risk monitoring
          </Text>
        </Stack>

        <Group gap="xs">
          <Badge color="gray" variant="outline">
            {total_skus} SKUs
          </Badge>
          <Badge color="brand" variant="light" leftSection={<IconCoins size={14} />}>
            Valuation: ₹{Number(total_valuation).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Badge>
          <Badge color={healthy_pct >= 80 ? 'teal' : 'orange'} variant="filled">
            {healthy_pct}% Optimal
          </Badge>
        </Group>
      </Group>

      {/* Stock Health Grid */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mb="md">
        <Card padding="xs" radius="sm" withBorder style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="teal.9">
              Healthy Stock
            </Text>
            <ThemeIcon size={22} radius="xl" color="teal">
              <IconCheck size={14} />
            </ThemeIcon>
          </Group>
          <Text size="lg" fw={800} c="teal.9" mt={4}>
            {healthy_count} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>SKUs</span>
          </Text>
        </Card>

        <Card padding="xs" radius="sm" withBorder style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="yellow.9">
              Low Stock Warnings
            </Text>
            <ThemeIcon size={22} radius="xl" color="yellow">
              <IconAlertTriangle size={14} />
            </ThemeIcon>
          </Group>
          <Text size="lg" fw={800} c="yellow.9" mt={4}>
            {low_stock_count} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>SKUs</span>
          </Text>
        </Card>

        <Card padding="xs" radius="sm" withBorder style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="red.9">
              Out of Stock
            </Text>
            <ThemeIcon size={22} radius="xl" color="red">
              <IconExclamationMark size={14} />
            </ThemeIcon>
          </Group>
          <Text size="lg" fw={800} c="red.9" mt={4}>
            {out_of_stock_count} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>SKUs</span>
          </Text>
        </Card>
      </SimpleGrid>

      {/* Critical Replenishment Alerts */}
      <Box mt="xs">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
          Critical Replenishment Watchlist ({critical_items.length})
        </Text>

        {critical_items.length === 0 ? (
          <Alert color="teal" variant="light" title="All Stocks Healthy" icon={<IconCheck size={16} />}>
            No SKUs are currently below the critical threshold across active stores.
          </Alert>
        ) : (
          <Stack gap={6}>
            {critical_items.slice(0, 4).map((item) => (
              <Box
                key={item.id}
                p="xs"
                style={{
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: item.current_stock === 0 ? '#fef2f2' : 'var(--bg-surface)',
                }}
              >
                <Group justify="space-between">
                  <Box>
                    <Group gap="xs">
                      <Text size="xs" fw={700}>
                        {item.product_name}
                      </Text>
                      <Badge size="xs" variant="outline" color="gray">
                        {item.sku}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ fontSize: '0.7rem' }}>
                      Branch: {item.store_name} • Retail: ₹{Number(item.retail_price).toLocaleString('en-IN')}
                    </Text>
                  </Box>

                  <Group gap="xs">
                    <Badge
                      size="sm"
                      color={item.current_stock === 0 ? 'red' : 'yellow'}
                      variant={item.current_stock === 0 ? 'filled' : 'light'}
                    >
                      {item.current_stock} / min {item.min_stock_threshold}
                    </Badge>
                  </Group>
                </Group>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Card>
  );
}
