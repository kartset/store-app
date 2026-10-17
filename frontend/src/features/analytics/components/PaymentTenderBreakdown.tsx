import {
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Badge,
  Box,
  ThemeIcon,
  Progress,
} from '@mantine/core';
import {
  IconCash,
  IconCreditCard,
  IconDeviceMobile,
  IconQrcode,
  IconWallet,
} from '@tabler/icons-react';
import type { PaymentMethodsAnalytics } from '../types';

interface PaymentTenderBreakdownProps {
  data?: PaymentMethodsAnalytics;
  isLoading: boolean;
}

const TENDER_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ size: number }> }
> = {
  CASH: { label: 'Cash', color: '#10b981', icon: IconCash },
  UPI: { label: 'UPI QR', color: '#6366f1', icon: IconQrcode },
  CARD: { label: 'Credit / Debit Card', color: '#3b82f6', icon: IconCreditCard },
  STORE_CREDIT: { label: 'Store Credit', color: '#f59e0b', icon: IconWallet },
  RAZORPAY: { label: 'Online / Gateway', color: '#06b6d4', icon: IconDeviceMobile },
};

export function PaymentTenderBreakdown({ data, isLoading }: PaymentTenderBreakdownProps) {
  if (isLoading || !data) {
    return (
      <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
        <Group justify="space-between" mb="md">
          <Skeleton height={20} width={180} />
          <Skeleton height={24} width={100} />
        </Group>
        <Skeleton height={20} width="100%" mb="lg" />
        <Stack gap="sm">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={42} width="100%" />
          ))}
        </Stack>
      </Card>
    );
  }

  const methods = data.payment_methods || [];
  const total = Number(data.total_collected) || 0;

  return (
    <Card padding="lg" radius="md" withBorder style={{ minHeight: 380 }}>
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Group gap="xs">
            <IconCreditCard size={20} color="var(--brand-primary)" />
            <Text fw={700} size="md">
              Payment Tender Split
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Revenue breakdown across payment methods
          </Text>
        </Stack>
        <Badge variant="light" color="teal">
          ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Total
        </Badge>
      </Group>

      {methods.length === 0 ? (
        <Box py={60} style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="sm">
            No payments recorded for this period.
          </Text>
        </Box>
      ) : (
        <Stack gap="md">
          {/* Stacked Progress Bar */}
          <Progress.Root size="xl" radius="sm">
            {methods.map((pm) => {
              const cfg = TENDER_CONFIG[pm.method] || { color: '#94a3b8' };
              return (
                <Progress.Section
                  key={pm.method}
                  value={pm.percentage}
                  color={cfg.color}
                >
                  <Progress.Label>{pm.percentage >= 8 ? `${pm.percentage}%` : ''}</Progress.Label>
                </Progress.Section>
              );
            })}
          </Progress.Root>

          {/* Detailed Method Items */}
          <Stack gap="xs" mt="xs">
            {methods.map((pm) => {
              const cfg = TENDER_CONFIG[pm.method] || {
                label: pm.label || pm.method,
                color: '#64748b',
                icon: IconCreditCard,
              };
              const IconComp = cfg.icon;

              return (
                <Box
                  key={pm.method}
                  p="xs"
                  style={{
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <Group justify="space-between">
                    <Group gap="xs">
                      <ThemeIcon size={30} radius="md" color={cfg.color} variant="light">
                        <IconComp size={16} />
                      </ThemeIcon>
                      <Box>
                        <Text size="xs" fw={700}>
                          {cfg.label}
                        </Text>
                        <Text size="xs" c="dimmed" style={{ fontSize: '0.7rem' }}>
                          {pm.count} transactions
                        </Text>
                      </Box>
                    </Group>

                    <Group gap="sm" align="flex-end">
                      <Text size="xs" fw={800}>
                        ₹{Number(pm.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                      <Badge size="sm" variant="light" color={cfg.color} style={{ minWidth: 50, textAlign: 'center' }}>
                        {pm.percentage}%
                      </Badge>
                    </Group>
                  </Group>
                </Box>
              );
            })}
          </Stack>
        </Stack>
      )}
    </Card>
  );
}
