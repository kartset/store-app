import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Paper,
  Center,
  Image,
  Loader,
  Divider,
  Alert,
  TextInput,
  Collapse,
} from '@mantine/core';
import {
  IconQrcode,
  IconCheck,
  IconAlertCircle,
  IconSparkles,
} from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import { usePaymentStatus, useVerifyPayment } from '../api';
import type { CreateOrderResponse } from '../types';

interface DynamicUPIQRModalProps {
  opened: boolean;
  onClose: () => void;
  orderData: CreateOrderResponse | null;
  onPaymentSuccess: (paymentId: string, utr?: string) => void;
}

export function DynamicUPIQRModal({
  opened,
  onClose,
  orderData,
  onPaymentSuccess,
}: DynamicUPIQRModalProps) {
  const [manualUtr, setManualUtr] = useState('');
  const [showManualUtr, setShowManualUtr] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const verifyMutation = useVerifyPayment();

  // Poll status every 3 seconds while modal is open and order exists
  const { data: paymentStatus } = usePaymentStatus({
    gatewayOrderId: orderData?.gateway_order_id,
    paymentId: orderData?.payment_id,
    enabled: opened && Boolean(orderData?.gateway_order_id),
    refetchInterval: 3000,
  });

  // Watch for successful payment from webhook or background capture
  useEffect(() => {
    if (paymentStatus?.status === 'SUCCESS' && orderData) {
      onPaymentSuccess(paymentStatus.id, paymentStatus.external_transaction_id || undefined);
      onClose();
    }
  }, [paymentStatus?.status, orderData, onPaymentSuccess, onClose]);

  const qrImageUrl = useMemo(() => {
    if (!orderData?.intent_uri) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      orderData.intent_uri
    )}`;
  }, [orderData?.intent_uri]);

  const handleSimulatePayment = async () => {
    if (!orderData) return;
    setIsVerifying(true);
    setErrorMsg(null);

    const mockPayId = `pay_mock_${Date.now().toString().slice(-8)}`;
    const mockSig = `mock_sig_${orderData.gateway_order_id}_${mockPayId}`;

    try {
      await verifyMutation.mutateAsync({
        invoice_id: orderData.invoice_id,
        payment_id: orderData.payment_id,
        razorpay_order_id: orderData.gateway_order_id,
        razorpay_payment_id: mockPayId,
        razorpay_signature: mockSig,
      });

      onPaymentSuccess(orderData.payment_id, mockPayId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualUtrSubmit = async () => {
    if (!orderData) return;
    if (!manualUtr.trim()) {
      setErrorMsg('Please enter a valid 12-digit UPI UTR number.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    const utr = manualUtr.trim();
    const sig = `mock_sig_${orderData.gateway_order_id}_${utr}`;

    try {
      await verifyMutation.mutateAsync({
        invoice_id: orderData.invoice_id,
        payment_id: orderData.payment_id,
        razorpay_order_id: orderData.gateway_order_id,
        razorpay_payment_id: utr,
        razorpay_signature: sig,
      });

      onPaymentSuccess(orderData.payment_id, utr);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!orderData) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconQrcode size={22} color="#059669" />
          <Text fw={800} size="md">
            Scan & Pay via Dynamic UPI
          </Text>
        </Group>
      }
      size="md"
      radius="md"
    >
      <Stack gap="md" align="center">
        {/* Payable Amount Highlight */}
        <Paper
          p="sm"
          withBorder
          radius="md"
          w="100%"
          style={{
            backgroundColor: 'rgba(5, 150, 105, 0.06)',
            borderColor: 'rgba(5, 150, 105, 0.25)',
            textAlign: 'center',
          }}
        >
          <Text size="xs" c="dimmed" fw={600}>
            EXACT PAYABLE AMOUNT
          </Text>
          <Text size="28px" fw={900} c="teal">
            ₹{parseFloat(orderData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <Text size="11px" c="dimmed">
            Bill Ref: <b>{orderData.invoice_number}</b> • VPA: <b>{orderData.vpa}</b>
          </Text>
        </Paper>

        {errorMsg && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Error" w="100%">
            {errorMsg}
          </Alert>
        )}

        {/* Dynamic QR Code Render */}
        <Paper p="md" withBorder radius="lg" shadow="sm" bg="white">
          <Center>
            <Image
              src={qrImageUrl}
              alt="Dynamic UPI QR Code"
              w={200}
              h={200}
              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14'%3EGenerating QR...%3C/text%3E%3C/svg%3E"
            />
          </Center>
        </Paper>

        {/* Real-time Polling Status */}
        <Group gap="xs" justify="center">
          <Loader size="xs" color="teal" />
          <Text size="xs" fw={600} c="teal">
            Awaiting customer payment on UPI app...
          </Text>
        </Group>

        {/* Accepted Apps Banner */}
        <Group gap={6} justify="center">
          <Badge size="xs" variant="light" color="blue">
            Google Pay
          </Badge>
          <Badge size="xs" variant="light" color="indigo">
            PhonePe
          </Badge>
          <Badge size="xs" variant="light" color="cyan">
            Paytm
          </Badge>
          <Badge size="xs" variant="light" color="orange">
            BHIM
          </Badge>
          <Badge size="xs" variant="light" color="grape">
            CRED
          </Badge>
        </Group>

        <Divider my="xs" w="100%" />

        {/* Cashier Quick Actions */}
        <Group justify="space-between" w="100%">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => setShowManualUtr((prev) => !prev)}
          >
            {showManualUtr ? 'Hide Manual UTR' : 'Enter UTR Manually'}
          </Button>

          <Button
            size="xs"
            color="teal"
            variant="light"
            loading={isVerifying}
            leftSection={<IconSparkles size={14} />}
            onClick={handleSimulatePayment}
          >
            Simulate / Confirm Payment
          </Button>
        </Group>

        <Collapse expanded={showManualUtr} w="100%">
          <Paper p="xs" withBorder radius="sm" style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <Group align="flex-end" gap="xs">
              <TextInput
                label="Customer 12-Digit UPI Ref / UTR"
                placeholder="e.g. 429381029384"
                size="xs"
                style={{ flex: 1 }}
                value={manualUtr}
                onChange={(e) => setManualUtr(e.target.value)}
              />
              <Button
                size="xs"
                color="teal"
                loading={isVerifying}
                leftSection={<IconCheck size={14} />}
                onClick={handleManualUtrSubmit}
              >
                Confirm UTR
              </Button>
            </Group>
          </Paper>
        </Collapse>
      </Stack>
    </Modal>
  );
}
