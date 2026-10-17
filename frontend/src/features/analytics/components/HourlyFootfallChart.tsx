import { useState } from 'react';
import {
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Badge,
  Box,
} from '@mantine/core';
import { IconClock, IconFlame } from '@tabler/icons-react';
import type { HourlyFootfallAnalytics, HourlyFootfallItem } from '../types';

interface HourlyFootfallChartProps {
  data?: HourlyFootfallAnalytics;
  isLoading: boolean;
}

export function HourlyFootfallChart({ data, isLoading }: HourlyFootfallChartProps) {
  const [hoveredHour, setHoveredHour] = useState<HourlyFootfallItem | null>(null);

  if (isLoading || !data) {
    return (
      <Card padding="lg" radius="md" withBorder style={{ minHeight: 340 }}>
        <Group justify="space-between" mb="md">
          <Skeleton height={20} width={180} />
          <Skeleton height={24} width={100} />
        </Group>
        <Skeleton height={220} width="100%" />
      </Card>
    );
  }

  const hours = data.hourly_distribution || [];
  const maxTxns = Math.max(...hours.map((h) => h.transaction_count), 5);

  const svgWidth = 750;
  const svgHeight = 180;
  const paddingX = 30;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const barSlotWidth = chartWidth / 24;
  const barWidth = Math.max(barSlotWidth * 0.65, 8);

  return (
    <Card padding="lg" radius="md" withBorder style={{ minHeight: 340 }}>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Stack gap={2}>
          <Group gap="xs">
            <IconClock size={20} color="var(--brand-primary)" />
            <Text fw={700} size="md">
              24-Hour Footfall & Peak Hours
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Hourly transaction frequency and customer checkout velocity
          </Text>
        </Stack>

        {data.peak_hour_label && (
          <Badge
            color="orange"
            variant="filled"
            leftSection={<IconFlame size={14} />}
            size="md"
          >
            Peak Hour: {data.peak_hour_label}
          </Badge>
        )}
      </Group>

      {data.total_transactions === 0 ? (
        <Box py={50} style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="sm">
            No checkout transactions recorded for this timeframe.
          </Text>
        </Box>
      ) : (
        <Box style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', minHeight: 180, display: 'block' }}
          >
            {/* Horizontal baseline */}
            <line
              x1={paddingX}
              y1={paddingTop + chartHeight}
              x2={paddingX + chartWidth}
              y2={paddingTop + chartHeight}
              stroke="var(--border-subtle)"
              strokeWidth="1"
            />

            {/* 24 Hour Bars */}
            {hours.map((item, idx) => {
              const xCenter = paddingX + idx * barSlotWidth + barSlotWidth / 2;
              const barHeight = (item.transaction_count / maxTxns) * chartHeight;
              const y = paddingTop + chartHeight - barHeight;
              const isHovered = hoveredHour?.hour === item.hour;
              const isPeak = item.is_peak && item.transaction_count > 0;

              return (
                <g key={item.hour}>
                  {/* Column Bar */}
                  <rect
                    x={xCenter - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 2)}
                    rx={3}
                    fill={isPeak ? '#f59e0b' : isHovered ? '#6366f1' : '#a5b4fc'}
                    style={{
                      cursor: 'pointer',
                      transition: 'fill 0.15s ease, y 0.2s ease, height 0.2s ease',
                      opacity: hoveredHour && !isHovered ? 0.6 : 1,
                    }}
                  />

                  {/* Invisible Hitbox */}
                  <rect
                    x={xCenter - barSlotWidth / 2}
                    y={paddingTop}
                    width={barSlotWidth}
                    height={chartHeight + paddingBottom}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredHour(item)}
                    onMouseLeave={() => setHoveredHour(null)}
                  />

                  {/* Hour tick marks every 3 hours */}
                  {item.hour % 3 === 0 && (
                    <text
                      x={xCenter}
                      y={paddingTop + chartHeight + 16}
                      fill="var(--text-muted)"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {String(item.hour).padStart(2, '0')}:00
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip display below */}
          <Box
            p="xs"
            mt="xs"
            style={{
              borderRadius: 6,
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}
          >
            {hoveredHour ? (
              <Group justify="center" gap="lg">
                <Text size="xs" fw={700}>
                  Time Window: <span style={{ color: 'var(--brand-primary)' }}>{hoveredHour.time_label}</span>
                </Text>
                <Text size="xs" fw={700}>
                  Transactions: {hoveredHour.transaction_count}
                </Text>
                <Text size="xs" fw={700}>
                  Revenue: ₹{Number(hoveredHour.revenue).toLocaleString('en-IN')}
                </Text>
                {hoveredHour.is_peak && hoveredHour.transaction_count > 0 && (
                  <Badge size="xs" color="orange" variant="light">
                    Store Peak Velocity
                  </Badge>
                )}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">
                Hover over any hour column to view checkout volume & transaction value.
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Card>
  );
}
