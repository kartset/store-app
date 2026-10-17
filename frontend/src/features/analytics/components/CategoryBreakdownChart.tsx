import { useState, useMemo } from 'react';
import {
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Badge,
  Box,
  SimpleGrid,
} from '@mantine/core';
import { IconCategory } from '@tabler/icons-react';
import type { CategoryBreakdownAnalytics } from '../types';

interface CategoryBreakdownChartProps {
  data?: CategoryBreakdownAnalytics;
  isLoading: boolean;
}

const CATEGORY_COLORS = [
  '#4f46e5', // indigo
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#ec4899', // pink
  '#3b82f6', // blue
  '#14b8a6', // teal
];

export function CategoryBreakdownChart({ data, isLoading }: CategoryBreakdownChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const categories = data?.categories || [];
  const totalRev = Number(data?.total_revenue) || 0;

  // Donut geometry
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const slices = useMemo(() => {
    let offset = 0;
    return categories.map((cat, i) => {
      const share = totalRev > 0 ? cat.revenue / totalRev : 0;
      const strokeDasharray = `${share * circumference} ${circumference}`;
      const strokeDashoffset = -offset * circumference;
      offset += share;
      const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
      return {
        cat,
        color,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categories, totalRev, circumference]);

  if (isLoading || !data) {
    return (
      <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
        <Skeleton height={20} width={180} mb="md" />
        <Skeleton height={260} width="100%" />
      </Card>
    );
  }

  return (
    <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Group gap="xs">
            <IconCategory size={20} color="var(--brand-primary)" />
            <Text fw={700} size="md">
              Category Revenue Share
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Product revenue distribution across catalog hierarchy
          </Text>
        </Stack>
        <Badge variant="light" color="brand">
          {categories.length} Categories
        </Badge>
      </Group>

      {categories.length === 0 ? (
        <Box py={60} style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="sm">
            No category transactions recorded for this period.
          </Text>
        </Box>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mt="sm">
          {/* Donut SVG */}
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Box style={{ position: 'relative', width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background Ring */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="var(--border-subtle)"
                  strokeWidth={strokeWidth}
                />

                {/* Slices */}
                {slices.map((slice, i) => {
                  const isHovered = hoveredIdx === i;

                  return (
                    <circle
                      key={slice.cat.category_id || i}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      transform={`rotate(-90 ${size / 2} ${size / 2})`}
                      style={{
                        cursor: 'pointer',
                        transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                        opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                      }}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    />
                  );
                })}
              </svg>

              {/* Center Total / Hover Label */}
              <Box
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  {hoveredIdx !== null ? categories[hoveredIdx].category_name : 'Total'}
                </Text>
                <Text size="sm" fw={800}>
                  ₹{Number(hoveredIdx !== null ? categories[hoveredIdx].revenue : totalRev).toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </Text>
                {hoveredIdx !== null && (
                  <Badge size="xs" color="brand" variant="light" mt={2}>
                    {categories[hoveredIdx].revenue_share_pct}%
                  </Badge>
                )}
              </Box>
            </Box>
          </Box>

          {/* List Breakdown */}
          <Stack gap="xs" justify="center">
            {categories.slice(0, 6).map((cat, i) => {
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              const isHovered = hoveredIdx === i;
              return (
                <Box
                  key={cat.category_id || i}
                  p="xs"
                  style={{
                    borderRadius: 8,
                    backgroundColor: isHovered ? 'var(--bg-surface-subtle)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <Group justify="space-between" mb={3}>
                    <Group gap="xs">
                      <Box
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: color,
                        }}
                      />
                      <Text size="xs" fw={isHovered ? 700 : 500}>
                        {cat.category_name}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" fw={700}>
                        ₹{Number(cat.revenue).toLocaleString('en-IN')}
                      </Text>
                      <Badge size="xs" variant="outline" color="gray">
                        {cat.revenue_share_pct}%
                      </Badge>
                    </Group>
                  </Group>

                  {/* Micro Progress Bar */}
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
                        width: `${cat.revenue_share_pct}%`,
                        backgroundColor: color,
                        borderRadius: 2,
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </SimpleGrid>
      )}
    </Card>
  );
}
