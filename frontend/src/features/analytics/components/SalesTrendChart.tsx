import { useState } from 'react';
import {
  Card,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Badge,
  Box,
} from '@mantine/core';
import { IconTrendingUp } from '@tabler/icons-react';
import type { SalesTrendAnalytics, SalesTrendPoint } from '../types';

interface SalesTrendChartProps {
  data?: SalesTrendAnalytics;
  isLoading: boolean;
  granularity: 'day' | 'week' | 'month';
  onGranularityChange: (granularity: 'day' | 'week' | 'month') => void;
}

export function SalesTrendChart({
  data,
  isLoading,
  granularity,
  onGranularityChange,
}: SalesTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<SalesTrendPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  if (isLoading || !data) {
    return (
      <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
        <Group justify="space-between" mb="md">
          <Skeleton height={20} width={180} />
          <Skeleton height={28} width={140} />
        </Group>
        <Skeleton height={260} width="100%" />
      </Card>
    );
  }

  const points = data.trend || [];
  const maxVal = Math.max(...points.map((p) => Math.max(p.gross_sales, p.net_sales, 100)), 1000);

  // Chart dimensions
  const svgWidth = 800;
  const svgHeight = 240;
  const paddingX = 45;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const getCoordinates = (index: number, value: number) => {
    const x = paddingX + (points.length > 1 ? (index / (points.length - 1)) * chartWidth : chartWidth / 2);
    const y = paddingTop + chartHeight - (value / maxVal) * chartHeight;
    return { x, y };
  };

  // Generate SVG path for Gross Sales & Net Sales
  const netCoords = points.map((p, i) => getCoordinates(i, p.net_sales));
  const grossCoords = points.map((p, i) => getCoordinates(i, p.gross_sales));

  const createPath = (coords: Array<{ x: number; y: number }>) => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    return coords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      // Smooth cubic bezier
      const prev = coords[idx - 1];
      const cx1 = prev.x + (curr.x - prev.x) / 3;
      const cy1 = prev.y;
      const cx2 = prev.x + ((curr.x - prev.x) * 2) / 3;
      const cy2 = curr.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
    }, '');
  };

  const netLinePath = createPath(netCoords);
  const grossLinePath = createPath(grossCoords);

  const netAreaPath =
    netCoords.length > 0
      ? `${netLinePath} L ${netCoords[netCoords.length - 1].x} ${paddingTop + chartHeight} L ${netCoords[0].x} ${paddingTop + chartHeight} Z`
      : '';

  // Y-axis grid increments
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Stack gap={2}>
          <Group gap="xs">
            <IconTrendingUp size={20} color="var(--brand-primary)" />
            <Text fw={700} size="md">
              Revenue & Sales Trajectory
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Daily, weekly & monthly gross sales vs net realization
          </Text>
        </Stack>

        <Group gap="sm">
          <Group gap={6} display={{ base: 'none', md: 'flex' }}>
            <Badge size="sm" variant="dot" color="indigo">
              Net Sales
            </Badge>
            <Badge size="sm" variant="dot" color="violet">
              Gross Sales
            </Badge>
          </Group>

          <SegmentedControl
            size="xs"
            value={granularity}
            onChange={(val) => onGranularityChange(val as 'day' | 'week' | 'month')}
            data={[
              { label: 'Daily', value: 'day' },
              { label: 'Weekly', value: 'week' },
              { label: 'Monthly', value: 'month' },
            ]}
          />
        </Group>
      </Group>

      {points.length === 0 ? (
        <Box py={60} style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="sm">
            No transaction records found for the selected timeframe.
          </Text>
        </Box>
      ) : (
        <Box style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', minHeight: 220, display: 'block' }}
          >
            <defs>
              <linearGradient id="netSalesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="grossSalesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines & scale labels */}
            {gridSteps.map((fraction, i) => {
              const y = paddingTop + chartHeight - fraction * chartHeight;
              const stepValue = Math.round(maxVal * fraction);
              return (
                <g key={i}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={paddingX + chartWidth}
                    y2={y}
                    stroke="var(--border-subtle)"
                    strokeDasharray={fraction > 0 && fraction < 1 ? '3 3' : 'none'}
                    strokeWidth="1"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 3}
                    fill="var(--text-muted)"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    ₹{stepValue >= 1000 ? `${(stepValue / 1000).toFixed(0)}k` : stepValue}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {netAreaPath && <path d={netAreaPath} fill="url(#netSalesGradient)" />}

            {/* Lines */}
            {grossLinePath && (
              <path
                d={grossLinePath}
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            {netLinePath && (
              <path
                d={netLinePath}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Data Point Dots and Interactive Hover */}
            {netCoords.map((coord, i) => {
              const point = points[i];
              const isHovered = hoveredPoint?.date === point.date;
              return (
                <g key={point.date}>
                  {/* Vertical hover indicator */}
                  {isHovered && (
                    <line
                      x1={coord.x}
                      y1={paddingTop}
                      x2={coord.x}
                      y2={paddingTop + chartHeight}
                      stroke="#4f46e5"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Dot */}
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={isHovered ? 6 : 3.5}
                    fill="#ffffff"
                    stroke="#4f46e5"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{ transition: 'r 0.15s ease' }}
                  />

                  {/* Hit target for hover */}
                  <rect
                    x={coord.x - (points.length > 1 ? chartWidth / (points.length * 2) : 20)}
                    y={paddingTop}
                    width={points.length > 1 ? chartWidth / points.length : 40}
                    height={chartHeight}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {
                      setHoveredPoint(point);
                      setTooltipPos({
                        x: (coord.x / svgWidth) * 100,
                        y: (coord.y / svgHeight) * 100,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredPoint(null);
                      setTooltipPos(null);
                    }}
                  />

                  {/* X-axis labels (filtered to avoid overlap) */}
                  {(points.length <= 10 || i % Math.ceil(points.length / 8) === 0 || i === points.length - 1) && (
                    <text
                      x={coord.x}
                      y={paddingTop + chartHeight + 16}
                      fill="var(--text-muted)"
                      fontSize="10"
                      textAnchor="middle"
                      fontFamily="var(--font-sans)"
                    >
                      {point.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip Card */}
          {hoveredPoint && tooltipPos && (
            <Card
              padding="xs"
              radius="sm"
              shadow="md"
              withBorder
              style={{
                position: 'absolute',
                top: `${tooltipPos.y}%`,
                left: `clamp(10%, ${tooltipPos.x}%, 85%)`,
                transform: 'translate(-50%, -115%)',
                pointerEvents: 'none',
                zIndex: 10,
                backgroundColor: 'var(--bg-surface)',
                minWidth: 160,
              }}
            >
              <Text size="xs" fw={700} c="brand">
                {hoveredPoint.label} ({hoveredPoint.date})
              </Text>
              <Group justify="space-between" mt={4}>
                <Text size="xs" c="dimmed">
                  Net Sales:
                </Text>
                <Text size="xs" fw={700}>
                  ₹{Number(hoveredPoint.net_sales).toLocaleString('en-IN')}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Gross:
                </Text>
                <Text size="xs" fw={600}>
                  ₹{Number(hoveredPoint.gross_sales).toLocaleString('en-IN')}
                </Text>
              </Group>
              {hoveredPoint.returns > 0 && (
                <Group justify="space-between">
                  <Text size="xs" c="orange.7">
                    Returns:
                  </Text>
                  <Text size="xs" fw={600} c="orange.7">
                    ₹{Number(hoveredPoint.returns).toLocaleString('en-IN')}
                  </Text>
                </Group>
              )}
              <Group justify="space-between" mt={2}>
                <Text size="xs" c="dimmed">
                  Invoices:
                </Text>
                <Text size="xs" fw={600}>
                  {hoveredPoint.invoice_count}
                </Text>
              </Group>
            </Card>
          )}
        </Box>
      )}
    </Card>
  );
}
