import {
  Card,
  Group,
  Stack,
  TextInput,
  Text,
  Badge,
  Button,
  ActionIcon,
  Avatar,
  NumberInput,
  Switch,
  Paper,
  Loader,
  Tooltip,
} from '@mantine/core';
import {
  IconPhone,
  IconSparkles,
  IconX,
  IconUserPlus,
  IconReceiptTax,
  IconCurrencyRupee,
} from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import { useCustomerLookup } from '../api';
import { QuickAddCustomerModal } from './QuickAddCustomerModal';
import type { Customer } from '../types';

export interface POSCustomerLookupProps {
  storeId?: string;
  billTotal?: number;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onLoyaltyDiscountChange?: (discountAmount: number, pointsRedeemed: number) => void;
  pointsToRupeeRate?: number;
}

export function POSCustomerLookup({
  storeId,
  billTotal = 0,
  selectedCustomer,
  onSelectCustomer,
  onLoyaltyDiscountChange,
  pointsToRupeeRate = 1.0,
}: POSCustomerLookupProps) {
  const [mobileInput, setMobileInput] = useState('');
  const [debouncedMobile, setDebouncedMobile] = useState('');
  const [quickAddOpened, setQuickAddOpened] = useState(false);

  // Loyalty Redemption State
  const [redeemPointsActive, setRedeemPointsActive] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  // Clean phone input
  const cleanPhone = useMemo(() => {
    return mobileInput.replace(/[\s\-()+]/g, '');
  }, [mobileInput]);

  // Debounce phone lookup by 250ms
  useEffect(() => {
    const handler = setTimeout(() => {
      if (cleanPhone.length >= 10) {
        setDebouncedMobile(cleanPhone);
      } else {
        setDebouncedMobile('');
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [cleanPhone]);

  // Execute lookup query
  const { data: lookupResult, isFetching: isSearching } = useCustomerLookup(
    debouncedMobile,
    storeId
  );

  // Auto-select customer if lookup found and not already selected
  useEffect(() => {
    if (lookupResult?.found && lookupResult.customer && !selectedCustomer) {
      onSelectCustomer(lookupResult.customer);
      setMobileInput('');
      setDebouncedMobile('');
    }
  }, [lookupResult, selectedCustomer, onSelectCustomer]);

  // Calculate available loyalty points for selected customer
  const availableLoyaltyPoints = useMemo(() => {
    if (!selectedCustomer) return 0;
    // Prefer store specific points from store_mappings if storeId is supplied
    if (storeId && selectedCustomer.store_mappings) {
      const mapping = selectedCustomer.store_mappings.find((m) => m.store_id === storeId);
      if (mapping) return mapping.loyalty_points || 0;
    }
    return selectedCustomer.total_loyalty_points || 0;
  }, [selectedCustomer, storeId]);

  // Maximum points that can be redeemed (capped by points balance & bill total)
  const maxRedeemablePoints = useMemo(() => {
    if (!redeemPointsActive) return 0;
    const maxByBill = billTotal > 0 ? Math.floor(billTotal / pointsToRupeeRate) : availableLoyaltyPoints;
    return Math.min(availableLoyaltyPoints, maxByBill);
  }, [availableLoyaltyPoints, billTotal, pointsToRupeeRate, redeemPointsActive]);

  // Sync loyalty discount changes to parent component
  useEffect(() => {
    if (redeemPointsActive && pointsToRedeem > 0) {
      const discount = Math.min(pointsToRedeem * pointsToRupeeRate, billTotal > 0 ? billTotal : Infinity);
      onLoyaltyDiscountChange?.(discount, pointsToRedeem);
    } else {
      onLoyaltyDiscountChange?.(0, 0);
    }
  }, [redeemPointsActive, pointsToRedeem, pointsToRupeeRate, billTotal, onLoyaltyDiscountChange]);

  // Reset redemption when customer changes
  useEffect(() => {
    setRedeemPointsActive(false);
    setPointsToRedeem(0);
  }, [selectedCustomer]);

  const handleClearCustomer = () => {
    onSelectCustomer(null);
    setMobileInput('');
    setDebouncedMobile('');
    setRedeemPointsActive(false);
    setPointsToRedeem(0);
  };

  const handleQuickAddSuccess = (newCustomer: Customer) => {
    onSelectCustomer(newCustomer);
    setMobileInput('');
    setDebouncedMobile('');
  };

  const handleRedeemMax = () => {
    setPointsToRedeem(maxRedeemablePoints);
  };

  const initials = selectedCustomer?.name
    ? selectedCustomer.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : selectedCustomer?.mobile_number?.slice(-2) || 'CU';

  return (
    <Card withBorder padding="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
      {selectedCustomer ? (
        /* Selected Customer Card */
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Avatar
                radius="xl"
                size="md"
                color={selectedCustomer.customer_type === 'B2B' ? 'indigo' : 'cyan'}
                style={{ fontWeight: 700 }}
              >
                {initials}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={700} truncate>
                    {selectedCustomer.name || 'Unnamed Customer'}
                  </Text>
                  <Badge
                    size="xs"
                    color={selectedCustomer.customer_type === 'B2B' ? 'indigo' : 'cyan'}
                    variant="light"
                  >
                    {selectedCustomer.customer_type === 'B2B' ? 'B2B' : 'Retail'}
                  </Badge>
                </Group>
                <Group gap={6} wrap="nowrap">
                  <IconPhone size={12} color="var(--mantine-color-dimmed)" />
                  <Text size="xs" fw={600}>
                    {selectedCustomer.mobile_number}
                  </Text>
                  {selectedCustomer.gstin && (
                    <Group gap={3} wrap="nowrap">
                      <IconReceiptTax size={12} color="var(--mantine-color-indigo-6)" />
                      <Text size="11px" c="indigo" fw={600}>
                        {selectedCustomer.gstin}
                      </Text>
                    </Group>
                  )}
                </Group>
              </div>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Badge color="yellow" variant="light" size="sm" leftSection={<IconSparkles size={12} />}>
                {availableLoyaltyPoints} pts
              </Badge>
              <Tooltip label="Remove customer (Walk-in)">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleClearCustomer}>
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Loyalty Points Redemption Panel (Active if customer has points) */}
          {availableLoyaltyPoints > 0 && (
            <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <Group justify="space-between" wrap="nowrap">
                <Switch
                  size="xs"
                  color="yellow"
                  label={
                    <Text size="xs" fw={600}>
                      Redeem Points ({availableLoyaltyPoints} available)
                    </Text>
                  }
                  checked={redeemPointsActive}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setRedeemPointsActive(checked);
                    if (checked) {
                      setPointsToRedeem(maxRedeemablePoints);
                    } else {
                      setPointsToRedeem(0);
                    }
                  }}
                />

                {redeemPointsActive && (
                  <Group gap={6}>
                    <NumberInput
                      size="xs"
                      min={0}
                      max={maxRedeemablePoints}
                      value={pointsToRedeem}
                      onChange={(val) => setPointsToRedeem(Number(val) || 0)}
                      style={{ width: 90 }}
                    />
                    <Button size="compact-xs" variant="light" color="yellow" onClick={handleRedeemMax}>
                      Max
                    </Button>
                    <Badge color="green" size="sm" variant="light" leftSection={<IconCurrencyRupee size={12} />}>
                      -₹{(pointsToRedeem * pointsToRupeeRate).toFixed(2)}
                    </Badge>
                  </Group>
                )}
              </Group>
            </Paper>
          )}
        </Stack>
      ) : (
        /* Walk-in Search Input Mode */
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Customer / Loyalty (POS)
            </Text>
            <Badge size="xs" variant="outline" color="gray">
              Walk-in Shopper
            </Badge>
          </Group>

          <TextInput
            placeholder="Type 10-digit mobile number for instant lookup..."
            leftSection={
              isSearching ? (
                <Loader size={14} color="brand" />
              ) : (
                <IconPhone size={16} />
              )
            }
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            maxLength={14}
            rightSection={
              mobileInput ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setMobileInput('');
                    setDebouncedMobile('');
                  }}
                >
                  <IconX size={12} />
                </ActionIcon>
              ) : null
            }
          />

          {/* Customer not found prompt & Quick Register Action */}
          {debouncedMobile.length >= 10 && lookupResult && !lookupResult.found && (
            <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" fw={600} c="orange.8">
                    Unregistered Mobile: {debouncedMobile}
                  </Text>
                  <Text size="11px" c="dimmed">
                    Register to accrue loyalty points on this purchase
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="filled"
                  color="brand"
                  leftSection={<IconUserPlus size={14} />}
                  onClick={() => setQuickAddOpened(true)}
                >
                  Quick Register
                </Button>
              </Group>
            </Paper>
          )}
        </Stack>
      )}

      {/* Quick Add Counter Modal */}
      <QuickAddCustomerModal
        opened={quickAddOpened}
        onClose={() => setQuickAddOpened(false)}
        initialMobile={debouncedMobile || cleanPhone}
        onSuccess={handleQuickAddSuccess}
      />
    </Card>
  );
}
