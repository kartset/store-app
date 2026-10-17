import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Paper,
  TextInput,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconTrash,
  IconClock,
  IconShoppingCart,
  IconUser,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { CartItem, ParkedCart } from '../types';
import type { Customer } from '../../customers/types';

interface ParkedCartsModalProps {
  opened: boolean;
  onClose: () => void;
  parkedCarts: ParkedCart[];
  activeCartItems: CartItem[];
  activeCustomer: Customer | null;
  activeLoyaltyPoints: number;
  activeLoyaltyDiscount: number;
  activeSubtotal: number;
  activeGrandTotal: number;
  onParkCurrentCart: (label: string) => void;
  onResumeCart: (cart: ParkedCart) => void;
  onDeleteParkedCart: (id: string) => void;
}

export function ParkedCartsModal({
  opened,
  onClose,
  parkedCarts,
  activeCartItems,
  onParkCurrentCart,
  onResumeCart,
  onDeleteParkedCart,
}: ParkedCartsModalProps) {
  const [parkLabel, setParkLabel] = useState('');

  const handleParkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLabel = parkLabel.trim() || `Cart #${parkedCarts.length + 1}`;
    onParkCurrentCart(finalLabel);
    setParkLabel('');
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconShoppingCart size={20} color="var(--mantine-color-brand-6)" />
          <Text fw={700} size="md">
            Parked / On-Hold Carts ({parkedCarts.length})
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        {/* Park Active Cart Section */}
        {activeCartItems.length > 0 && (
          <Paper p="sm" withBorder radius="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
            <form onSubmit={handleParkSubmit}>
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                  Hold Current Active Cart ({activeCartItems.length} items)
                </Text>
                <Group gap="xs">
                  <TextInput
                    placeholder="Reference label (e.g., Customer fetching cash, Table 4)..."
                    value={parkLabel}
                    onChange={(e) => setParkLabel(e.target.value)}
                    style={{ flex: 1 }}
                    size="sm"
                  />
                  <Button
                    type="submit"
                    leftSection={<IconDeviceFloppy size={16} />}
                    color="brand"
                    size="sm"
                  >
                    Hold Cart (F8)
                  </Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        )}

        {/* List of Held Carts */}
        {parkedCarts.length === 0 ? (
          <Paper p="xl" withBorder radius="md" style={{ textAlign: 'center' }}>
            <IconClock size={36} color="var(--mantine-color-gray-4)" style={{ margin: '0 auto 8px' }} />
            <Text fw={600} size="sm" c="dimmed">
              No parked carts on hold
            </Text>
            <Text size="xs" c="dimmed">
              You can hold an in-progress transaction when a customer needs to pick another item.
            </Text>
          </Paper>
        ) : (
          <Stack gap="sm">
            {parkedCarts.map((cart) => (
              <Paper
                key={cart.id}
                p="md"
                withBorder
                radius="md"
                style={{
                  transition: 'all 0.15s ease',
                  borderLeft: '4px solid var(--mantine-color-brand-6)',
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text fw={700} size="sm">
                        {cart.label}
                      </Text>
                      <Badge size="xs" variant="light" color="blue">
                        {cart.items.reduce((acc, it) => acc + it.quantity, 0)} items
                      </Badge>
                      <Badge size="xs" variant="outline" color="gray">
                        {new Date(cart.parked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    </Group>

                    {cart.customer && (
                      <Group gap={6}>
                        <IconUser size={13} color="gray" />
                        <Text size="xs" c="dimmed">
                          {cart.customer.name || 'Customer'} ({cart.customer.mobile_number})
                        </Text>
                      </Group>
                    )}

                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {cart.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                    </Text>
                  </Stack>

                  <Group gap="sm" align="center">
                    <Stack gap={0} align="flex-end">
                      <Text size="10px" c="dimmed" fw={600}>
                        AMOUNT
                      </Text>
                      <Text fw={800} size="md" c="brand">
                        ₹{cart.grandTotal.toFixed(2)}
                      </Text>
                    </Stack>

                    <Button
                      size="xs"
                      color="teal"
                      leftSection={<IconPlayerPlay size={14} />}
                      onClick={() => onResumeCart(cart)}
                    >
                      Resume
                    </Button>

                    <Tooltip label="Discard parked cart">
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        size="md"
                        onClick={() => onDeleteParkedCart(cart.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
