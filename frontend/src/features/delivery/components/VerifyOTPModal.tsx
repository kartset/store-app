import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  Select,
  Text,
  Badge,
  Paper,
  Alert,
  NumberInput,
} from '@mantine/core';
import { IconShieldCheck, IconAlertCircle, IconCheck, IconCoins } from '@tabler/icons-react';
import { useVerifyOTP } from '../api';
import type { Delivery } from '../types';

interface VerifyOTPModalProps {
  opened: boolean;
  onClose: () => void;
  delivery: Delivery | null;
}

export function VerifyOTPModal({ opened, onClose, delivery }: VerifyOTPModalProps) {
  const [otpCode, setOtpCode] = useState('');
  const [codAmount, setCodAmount] = useState<number | string>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verifyOtpMutation = useVerifyOTP();

  useEffect(() => {
    if (delivery) {
      setOtpCode('');
      setErrorMessage(null);
      setCodAmount(Number(delivery.cod_amount_due) || 0);
      setPaymentMethod('CASH');
    }
  }, [delivery]);

  if (!delivery) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (otpCode.length !== 4) {
      setErrorMessage('Please enter the 4-digit OTP provided to the customer.');
      return;
    }

    verifyOtpMutation.mutate(
      {
        id: delivery.id,
        data: {
          otp_code: otpCode.trim(),
          cod_amount_collected: delivery.is_cod ? Number(codAmount) : undefined,
          cod_payment_method: delivery.is_cod ? paymentMethod : undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: any) => {
          const detail =
            err.response?.data?.error ||
            err.response?.data?.otp_code?.[0] ||
            'Invalid OTP code. Please verify with recipient.';
          setErrorMessage(detail);
        },
      }
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconShieldCheck size={20} color="var(--brand-primary)" />
          <Text fw={700} size="md">
            Customer Handover & OTP Verification
          </Text>
        </Group>
      }
      size="md"
      radius="md"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Paper withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={600}>
                  TRACKING ID
                </Text>
                <Badge variant="outline" color="brand" size="sm">
                  {delivery.tracking_id}
                </Badge>
              </Group>
              <Text size="sm" fw={700}>
                {delivery.recipient_name} ({delivery.recipient_phone})
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {delivery.delivery_address}
              </Text>
              {delivery.driver_name && (
                <Text size="xs" c="dimmed" mt={4}>
                  Assigned Driver: <strong>{delivery.driver_name}</strong> ({delivery.driver_phone || 'No phone'})
                </Text>
              )}
            </Stack>
          </Paper>

          {delivery.is_cod && (
            <Paper
              withBorder
              p="sm"
              radius="md"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderColor: 'var(--mantine-color-orange-4)',
              }}
            >
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap={6}>
                    <IconCoins size={18} color="var(--mantine-color-orange-6)" />
                    <Text size="sm" fw={700} c="orange.8">
                      Cash-on-Delivery (COD) Settlement
                    </Text>
                  </Group>
                  <Badge color="orange" size="md">
                    Due: ₹{Number(delivery.cod_amount_due).toFixed(2)}
                  </Badge>
                </Group>

                <NumberInput
                  label="Amount Collected (₹)"
                  value={codAmount}
                  onChange={(val) => setCodAmount(val || 0)}
                  min={0}
                  step={1}
                  required
                />

                <Select
                  label="Collection Payment Method"
                  data={[
                    { value: 'CASH', label: 'Cash Currency' },
                    { value: 'UPI', label: 'UPI / QR Code' },
                    { value: 'CARD', label: 'Card Swiped on Delivery POS' },
                  ]}
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val || 'CASH')}
                  required
                />
              </Stack>
            </Paper>
          )}

          <Stack gap={4}>
            <TextInput
              label="Customer 4-Digit Handover OTP"
              description="Ask the customer for the verification code sent to their phone / order invoice"
              placeholder="e.g. 4821"
              maxLength={4}
              value={otpCode}
              onChange={(e) => setOtpCode(e.currentTarget.value.replace(/[^0-9]/g, ''))}
              required
              autoFocus
              styles={{
                input: {
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                },
              }}
            />
          </Stack>

          {errorMessage && (
            <Alert icon={<IconAlertCircle size={16} />} title="Verification Error" color="red">
              {errorMessage}
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="green"
              loading={verifyOtpMutation.isPending}
              leftSection={<IconCheck size={16} />}
            >
              Verify OTP & Complete Delivery
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
