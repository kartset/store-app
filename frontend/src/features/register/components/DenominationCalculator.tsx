import {
  Card,
  Grid,
  Group,
  NumberInput,
  Paper,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconRotateClockwise, IconCash } from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import type { DenominationCounts } from '../types';

interface DenominationCalculatorProps {
  initialCounts?: Partial<DenominationCounts>;
  onChange: (counts: DenominationCounts, total: number) => void;
}

const DENOMINATIONS: { key: keyof DenominationCounts; label: string; value: number }[] = [
  { key: '2000', label: '₹2,000 Note', value: 2000 },
  { key: '500', label: '₹500 Note', value: 500 },
  { key: '200', label: '₹200 Note', value: 200 },
  { key: '100', label: '₹100 Note', value: 100 },
  { key: '50', label: '₹50 Note', value: 50 },
  { key: '20', label: '₹20 Note', value: 20 },
  { key: '10', label: '₹10 Note', value: 10 },
  { key: '5', label: '₹5 Note / Coin', value: 5 },
  { key: 'coins', label: 'Loose Coins / Mixed', value: 1 },
];

export function DenominationCalculator({
  initialCounts,
  onChange,
}: DenominationCalculatorProps) {
  const [counts, setCounts] = useState<DenominationCounts>({
    '2000': initialCounts?.['2000'] || 0,
    '500': initialCounts?.['500'] || 0,
    '200': initialCounts?.['200'] || 0,
    '100': initialCounts?.['100'] || 0,
    '50': initialCounts?.['50'] || 0,
    '20': initialCounts?.['20'] || 0,
    '10': initialCounts?.['10'] || 0,
    '5': initialCounts?.['5'] || 0,
    coins: initialCounts?.coins || 0,
  });

  const totals = useMemo(() => {
    let sum = 0;
    let pieceCount = 0;

    DENOMINATIONS.forEach(({ key, value }) => {
      const count = Number(counts[key]) || 0;
      sum += count * value;
      pieceCount += count;
    });

    return { totalAmount: sum, totalPieces: pieceCount };
  }, [counts]);

  useEffect(() => {
    onChange(counts, totals.totalAmount);
  }, [counts, totals.totalAmount, onChange]);

  const handleCountChange = (key: keyof DenominationCounts, val: number | string) => {
    const num = typeof val === 'number' ? Math.max(0, val) : 0;
    setCounts((prev) => ({
      ...prev,
      [key]: num,
    }));
  };

  const handleReset = () => {
    const blank: DenominationCounts = {
      '2000': 0,
      '500': 0,
      '200': 0,
      '100': 0,
      '50': 0,
      '20': 0,
      '10': 0,
      '5': 0,
      coins: 0,
    };
    setCounts(blank);
  };

  return (
    <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-subtle)' }}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconCash size={18} color="#059669" />
          <Text fw={700} size="sm">
            Cash Denomination Breakdown
          </Text>
        </Group>

        <Group gap="xs">
          <Badge color="teal" variant="light" size="sm">
            {totals.totalPieces} Pieces
          </Badge>
          <Tooltip label="Reset all counts to 0">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={handleReset}>
              <IconRotateClockwise size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Grid>
        {DENOMINATIONS.map(({ key, label, value }) => {
          const count = counts[key] || 0;
          const subtotal = count * value;

          return (
            <Grid.Col span={{ base: 6, sm: 4 }} key={key}>
              <Paper withBorder p="xs" radius="sm" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" fw={600} c="dimmed">
                    {label}
                  </Text>
                  <Text size="xs" fw={700} c={subtotal > 0 ? 'teal' : 'dimmed'}>
                    ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Group>
                <NumberInput
                  size="xs"
                  placeholder="0"
                  min={0}
                  step={1}
                  value={counts[key] === 0 ? '' : counts[key]}
                  onChange={(val) => handleCountChange(key, val)}
                  rightSection={
                    <Text size="10px" c="dimmed" pr="xs">
                      pcs
                    </Text>
                  }
                />
              </Paper>
            </Grid.Col>
          );
        })}
      </Grid>

      <Paper
        withBorder
        p="xs"
        mt="sm"
        radius="sm"
        style={{
          backgroundColor: 'rgba(5, 150, 105, 0.08)',
          borderColor: 'rgba(5, 150, 105, 0.3)',
        }}
      >
        <Group justify="space-between">
          <Text size="xs" fw={700} c="teal">
            Calculated Physical Cash Total:
          </Text>
          <Text size="md" fw={900} c="teal">
            ₹{totals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </Group>
      </Paper>
    </Card>
  );
}
