import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Paper,
  Tabs,
  NumberInput,
  TextInput,
  Divider,
  Alert,
  Center,
  Image,
} from '@mantine/core';
import {
  IconCash,
  IconQrcode,
  IconCreditCard,
  IconCheck,
  IconReceipt,
  IconArrowRight,
  IconInfoCircle,
  IconSparkles,
} from '@tabler/icons-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useCheckoutInvoice } from '../../invoice/api';
import { DynamicUPIQRModal, useCreatePaymentOrder, type CreateOrderResponse } from '../../payments';
import type { CartItem, CartTaxBreakdown } from '../types';
import type { Customer } from '../../customers/types';
import type { Invoice, PaymentMethod } from '../../invoice/types';
import { playBeep } from '../utils/sound';

interface POSCheckoutModalProps {
  opened: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  storeGstin?: string;
  customer: Customer | null;
  items: CartItem[];
  totals: CartTaxBreakdown;
  loyaltyPointsRedeemed: number;
  onCheckoutSuccess: (createdInvoice: Invoice, changeReturned: number) => void;
}

export function POSCheckoutModal({
  opened,
  onClose,
  storeId,
  storeName,
  customer,
  items,
  totals,
  loyaltyPointsRedeemed,
  onCheckoutSuccess,
}: POSCheckoutModalProps) {
  const checkoutMutation = useCheckoutInvoice();
  const createOrderMutation = useCreatePaymentOrder();

  // Active payment tab
  const [activeTab, setActiveTab] = useState<string>('cash');

  // Split Tender State
  const [cashAmount, setCashAmount] = useState<number>(totals.grandTotal);
  const [cashTendered, setCashTendered] = useState<number>(totals.grandTotal);
  const [upiAmount, setUpiAmount] = useState<number>(0);
  const [upiRef, setUpiRef] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [cardRef, setCardRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Dynamic UPI Order & Modal State
  const [dynamicOrderData, setDynamicOrderData] = useState<CreateOrderResponse | null>(null);
  const [dynamicQRModalOpened, setDynamicQRModalOpened] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const createdInvoiceRef = useRef<Invoice | null>(null);

  // Reset or initialize tenders whenever modal opens or total changes
  useEffect(() => {
    if (opened) {
      setCashAmount(totals.grandTotal);
      setCashTendered(totals.grandTotal);
      setUpiAmount(0);
      setUpiRef('');
      setCardAmount(0);
      setCardRef('');
      setNotes('');
      setActiveTab('cash');
      setDynamicOrderData(null);
      setDynamicQRModalOpened(false);
      setIsGeneratingQR(false);
      createdInvoiceRef.current = null;
    }
  }, [opened, totals.grandTotal]);

  // Total allocated across payment methods
  const totalAllocated = useMemo(() => {
    return Number((cashAmount + upiAmount + cardAmount).toFixed(2));
  }, [cashAmount, upiAmount, cardAmount]);

  // Balance remaining to allocate
  const balanceRemaining = useMemo(() => {
    return Number((totals.grandTotal - totalAllocated).toFixed(2));
  }, [totals.grandTotal, totalAllocated]);

  // Change due on cash transaction
  const changeDue = useMemo(() => {
    if (cashAmount <= 0) return 0;
    return Math.max(0, Number((cashTendered - cashAmount).toFixed(2)));
  }, [cashAmount, cashTendered]);

  // Dynamic UPI Intent URI
  const upiIntentUri = useMemo(() => {
    const amount = upiAmount > 0 ? upiAmount : totals.grandTotal;
    const payeeVpa = 'storecraft.pos@okaxis';
    const cleanStoreName = encodeURIComponent(storeName.replace(/[^a-zA-Z0-9 ]/g, ''));
    return `upi://pay?pa=${payeeVpa}&pn=${cleanStoreName}&am=${amount.toFixed(2)}&cu=INR&tn=Bill%20Payment`;
  }, [upiAmount, totals.grandTotal, storeName]);

  const qrImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiIntentUri)}`;
  }, [upiIntentUri]);

  // Quick cash chips calculation
  const quickCashOptions = useMemo(() => {
    const target = cashAmount > 0 ? cashAmount : totals.grandTotal;
    const options = new Set<number>();
    options.add(target);
    const standardNotes = [50, 100, 200, 500, 1000, 2000];
    for (const note of standardNotes) {
      if (note >= target) {
        options.add(note);
      }
    }
    // Next nearest 100 or 500
    const next100 = Math.ceil(target / 100) * 100;
    const next500 = Math.ceil(target / 500) * 500;
    options.add(next100);
    options.add(next500);

    return Array.from(options).filter((val) => val >= target).sort((a, b) => a - b).slice(0, 5);
  }, [cashAmount, totals.grandTotal]);

  const handleChargeSubmit = async () => {
    if (balanceRemaining !== 0) return;

    const paymentsPayload: {
      method: PaymentMethod;
      amount: number;
      amount_tendered?: number;
      change_returned?: number;
      external_transaction_id?: string;
    }[] = [];

    if (cashAmount > 0) {
      paymentsPayload.push({
        method: 'CASH',
        amount: cashAmount,
        amount_tendered: cashTendered,
        change_returned: changeDue,
      });
    }

    if (upiAmount > 0) {
      paymentsPayload.push({
        method: 'UPI',
        amount: upiAmount,
        external_transaction_id: upiRef.trim() || undefined,
      });
    }

    if (cardAmount > 0) {
      paymentsPayload.push({
        method: 'CARD',
        amount: cardAmount,
        external_transaction_id: cardRef.trim() || undefined,
      });
    }

    try {
      const response = await checkoutMutation.mutateAsync({
        store_id: storeId,
        customer_id: customer?.id,
        customer_name: customer?.name || 'Walk-in Customer',
        customer_phone: customer?.mobile_number || '9999999999',
        customer_gstin: customer?.gstin || undefined,
        type: 'POS',
        is_tax_inclusive: true,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
        })),
        payments: paymentsPayload,
        loyalty_points_to_redeem: loyaltyPointsRedeemed > 0 ? loyaltyPointsRedeemed : undefined,
        notes: notes.trim() || undefined,
      });

      playBeep('success');
      onCheckoutSuccess(response, changeDue);
    } catch (err) {
      playBeep('error');
      console.error('Checkout failed:', err);
    }
  };

  const handleLaunchDynamicQR = async () => {
    setIsGeneratingQR(true);
    try {
      let inv = createdInvoiceRef.current;
      if (!inv) {
        // Create draft invoice with whatever partial non-UPI tenders are set
        const paymentsPayload: {
          method: PaymentMethod;
          amount: number;
          amount_tendered?: number;
          change_returned?: number;
          external_transaction_id?: string;
        }[] = [];

        if (cashAmount > 0 && cashAmount < totals.grandTotal) {
          paymentsPayload.push({
            method: 'CASH',
            amount: cashAmount,
            amount_tendered: cashTendered,
            change_returned: changeDue,
          });
        }
        if (cardAmount > 0 && cardAmount < totals.grandTotal) {
          paymentsPayload.push({
            method: 'CARD',
            amount: cardAmount,
            external_transaction_id: cardRef.trim() || undefined,
          });
        }

        inv = await checkoutMutation.mutateAsync({
          store_id: storeId,
          customer_id: customer?.id,
          customer_name: customer?.name || 'Walk-in Customer',
          customer_phone: customer?.mobile_number || '9999999999',
          customer_gstin: customer?.gstin || undefined,
          type: 'POS',
          is_tax_inclusive: true,
          items: items.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount: it.discount,
          })),
          payments: paymentsPayload,
          loyalty_points_to_redeem: loyaltyPointsRedeemed > 0 ? loyaltyPointsRedeemed : undefined,
          notes: notes.trim() || undefined,
        });

        createdInvoiceRef.current = inv;
      }

      const upiTargetAmount = upiAmount > 0 ? upiAmount : totals.grandTotal;
      const order = await createOrderMutation.mutateAsync({
        invoice_id: inv.id,
        amount: upiTargetAmount,
        method: 'UPI',
      });

      setDynamicOrderData(order);
      setDynamicQRModalOpened(true);
    } catch (err) {
      console.error('Failed to initialize dynamic UPI QR order:', err);
      playBeep('error');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  return (
    <>
      <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconReceipt size={22} color="var(--mantine-color-brand-6)" />
          <Text fw={800} size="lg">
            Counter Checkout & Payment
          </Text>
        </Group>
      }
      size="xl"
      radius="md"
    >
      <Stack gap="md">
        {/* Bill & Customer Header Banner */}
        <Paper p="md" withBorder radius="md" style={{ backgroundColor: 'var(--mantine-color-brand-0)' }}>
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text size="xs" fw={700} c="brand" style={{ textTransform: 'uppercase' }}>
                Total Payable Amount
              </Text>
              <Text fw={900} size="32px" c="brand" lh={1}>
                ₹{totals.grandTotal.toFixed(2)}
              </Text>
              <Text size="xs" c="dimmed">
                {items.reduce((acc, it) => acc + it.quantity, 0)} items in bill
                {totals.loyaltyDiscount > 0 && ` • Loyalty Saved ₹${totals.loyaltyDiscount}`}
              </Text>
            </Stack>

            <Paper p="xs" withBorder radius="sm" style={{ backgroundColor: 'white' }}>
              <Stack gap={2} align="flex-end">
                <Text size="xs" fw={700}>
                  {customer ? customer.name || 'Registered Customer' : 'Walk-in Customer'}
                </Text>
                <Text size="11px" c="dimmed">
                  {customer?.mobile_number || 'No Phone Linked'}
                </Text>
                {customer?.gstin && (
                  <Badge size="xs" color="indigo" variant="light">
                    GSTIN: {customer.gstin}
                  </Badge>
                )}
              </Stack>
            </Paper>
          </Group>
        </Paper>

        {/* Payment Tenders Tabs */}
        <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'cash')} radius="md">
          <Tabs.List grow>
            <Tabs.Tab
              value="cash"
              leftSection={<IconCash size={18} />}
              rightSection={
                cashAmount > 0 ? (
                  <Badge size="xs" color="teal">
                    ₹{cashAmount}
                  </Badge>
                ) : null
              }
            >
              Cash (F1)
            </Tabs.Tab>

            <Tabs.Tab
              value="upi"
              leftSection={<IconQrcode size={18} />}
              rightSection={
                upiAmount > 0 ? (
                  <Badge size="xs" color="teal">
                    ₹{upiAmount}
                  </Badge>
                ) : null
              }
            >
              Dynamic UPI (F3)
            </Tabs.Tab>

            <Tabs.Tab
              value="card"
              leftSection={<IconCreditCard size={18} />}
              rightSection={
                cardAmount > 0 ? (
                  <Badge size="xs" color="teal">
                    ₹{cardAmount}
                  </Badge>
                ) : null
              }
            >
              Card / POS Machine (F5)
            </Tabs.Tab>
          </Tabs.List>

          {/* Cash Tab Content */}
          <Tabs.Panel value="cash" pt="md">
            <Stack gap="sm">
              <Group grow align="flex-start">
                <NumberInput
                  label="Cash Portion to Pay"
                  description="Amount collected in cash"
                  prefix="₹ "
                  value={cashAmount}
                  onChange={(val) => {
                    const num = typeof val === 'number' ? val : 0;
                    setCashAmount(num);
                    if (cashTendered < num) setCashTendered(num);
                  }}
                  min={0}
                  max={totals.grandTotal}
                  size="md"
                />

                <NumberInput
                  label="Cash Tendered by Customer"
                  description="Physical note given"
                  prefix="₹ "
                  value={cashTendered}
                  onChange={(val) => setCashTendered(typeof val === 'number' ? val : 0)}
                  min={cashAmount}
                  size="md"
                />
              </Group>

              {/* Quick Cash Chips */}
              <Stack gap={4}>
                <Text size="xs" fw={600} c="dimmed">
                  Quick Cash Tender Shortcuts:
                </Text>
                <Group gap="xs">
                  {quickCashOptions.map((opt) => (
                    <Button
                      key={opt}
                      size="xs"
                      variant={cashTendered === opt ? 'filled' : 'outline'}
                      color="teal"
                      onClick={() => setCashTendered(opt)}
                    >
                      {opt === cashAmount ? 'Exact (₹' + opt + ')' : '₹' + opt}
                    </Button>
                  ))}
                </Group>
              </Stack>

              {/* Change Return Alert */}
              {changeDue > 0 && (
                <Alert color="teal" icon={<IconCheck size={18} />} title="Change Due to Customer">
                  <Text fw={800} size="xl" c="teal">
                    Return ₹{changeDue.toFixed(2)} to customer
                  </Text>
                </Alert>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Dynamic UPI Tab */}
          <Tabs.Panel value="upi" pt="md">
            <Stack gap="sm">
              <Group grow align="flex-start">
                <NumberInput
                  label="UPI Portion to Pay"
                  description="Amount to generate QR for"
                  prefix="₹ "
                  value={upiAmount}
                  onChange={(val) => setUpiAmount(typeof val === 'number' ? val : 0)}
                  min={0}
                  max={totals.grandTotal}
                  size="md"
                />

                <TextInput
                  label="UPI UTR / Reference No. (Optional)"
                  description="Transaction reference"
                  placeholder="e.g. 429381029384"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  size="md"
                />
              </Group>

              {/* Dynamic QR Code Render */}
              <Paper p="md" withBorder radius="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                <Group justify="center" gap="xl">
                  <Paper p="xs" withBorder radius="md" bg="white" shadow="sm">
                    <Center>
                      <Image
                        src={qrImageUrl}
                        alt="Dynamic UPI QR"
                        w={160}
                        h={160}
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='160' height='160' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3EQR Code%3C/text%3E%3C/svg%3E"
                      />
                    </Center>
                  </Paper>

                  <Stack gap="xs" style={{ maxWidth: 320 }}>
                    <Badge color="green" variant="light" size="sm">
                      Real-time Dynamic UPI
                    </Badge>
                    <Text fw={700} size="sm">
                      Scan to pay ₹{(upiAmount > 0 ? upiAmount : totals.grandTotal).toFixed(2)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Ask the customer to scan using Google Pay, PhonePe, Paytm, or any BHIM UPI app.
                    </Text>

                    <Button
                      size="xs"
                      color="teal"
                      variant="filled"
                      leftSection={<IconSparkles size={14} />}
                      loading={isGeneratingQR}
                      onClick={handleLaunchDynamicQR}
                      fullWidth
                    >
                      ⚡ Open Counter Dynamic QR (Live Polling)
                    </Button>

                    {balanceRemaining > 0 && upiAmount === 0 && (
                      <Button
                        size="xs"
                        variant="light"
                        color="brand"
                        onClick={() => setUpiAmount(balanceRemaining)}
                      >
                        Set UPI Amount to Remaining (₹{balanceRemaining})
                      </Button>
                    )}
                  </Stack>
                </Group>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* Card Tab */}
          <Tabs.Panel value="card" pt="md">
            <Stack gap="sm">
              <Group grow align="flex-start">
                <NumberInput
                  label="Card Portion to Pay"
                  description="Amount swiped on EDC POS machine"
                  prefix="₹ "
                  value={cardAmount}
                  onChange={(val) => setCardAmount(typeof val === 'number' ? val : 0)}
                  min={0}
                  max={totals.grandTotal}
                  size="md"
                />

                <TextInput
                  label="Approval / RRN Code (Optional)"
                  description="From EDC card machine charge slip"
                  placeholder="e.g. 192837"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                  size="md"
                />
              </Group>

              {balanceRemaining > 0 && cardAmount === 0 && (
                <Button
                  size="xs"
                  variant="light"
                  color="brand"
                  onClick={() => setCardAmount(balanceRemaining)}
                >
                  Set Card Amount to Remaining (₹{balanceRemaining})
                </Button>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Divider />

        {/* Tender Balance Reconciliation */}
        <Paper p="sm" withBorder radius="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600}>
                TENDER RECONCILIATION
              </Text>
              <Group gap="xs">
                <Text size="xs">
                  Allocated: <b>₹{totalAllocated.toFixed(2)}</b> / ₹{totals.grandTotal.toFixed(2)}
                </Text>
              </Group>
            </Stack>

            {balanceRemaining === 0 ? (
              <Badge color="teal" size="lg" variant="filled" leftSection={<IconCheck size={14} />}>
                Fully Tendered
              </Badge>
            ) : (
              <Group gap="xs">
                <Badge color="red" size="lg" variant="light">
                  Remaining: ₹{balanceRemaining.toFixed(2)}
                </Badge>
                <Button
                  size="xs"
                  variant="subtle"
                  color="brand"
                  onClick={() => {
                    if (activeTab === 'cash') setCashAmount(totals.grandTotal);
                    else if (activeTab === 'upi') setUpiAmount(totals.grandTotal);
                    else if (activeTab === 'card') setCardAmount(totals.grandTotal);
                  }}
                >
                  Pay in Full on active tab
                </Button>
              </Group>
            )}
          </Group>
        </Paper>

        {/* Optional Bill Notes */}
        <TextInput
          placeholder="Optional cashier notes or customer remarks..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="xs"
        />

        {checkoutMutation.isError && (
          <Alert color="red" icon={<IconInfoCircle size={16} />} title="Checkout Failed">
            {checkoutMutation.error instanceof Error
              ? checkoutMutation.error.message
              : 'Failed to complete transaction. Please check stock and try again.'}
          </Alert>
        )}

        {/* Actions Footer */}
        <Group justify="space-between" pt="sm">
          <Button variant="default" onClick={onClose} disabled={checkoutMutation.isPending}>
            Back to Cart (Esc)
          </Button>

          <Button
            size="md"
            color="brand"
            disabled={balanceRemaining !== 0 || items.length === 0}
            loading={checkoutMutation.isPending}
            leftSection={<IconCheck size={20} />}
            rightSection={<IconArrowRight size={18} />}
            onClick={handleChargeSubmit}
            style={{ fontWeight: 800 }}
          >
            Complete Sale & Print (F9)
          </Button>
        </Group>
      </Stack>
    </Modal>

    <DynamicUPIQRModal
      opened={dynamicQRModalOpened}
      onClose={() => setDynamicQRModalOpened(false)}
      orderData={dynamicOrderData}
      onPaymentSuccess={(_paymentId, _utr) => {
        setDynamicQRModalOpened(false);
        playBeep('success');
        const inv = createdInvoiceRef.current;
        if (inv) {
          onCheckoutSuccess(
            {
              ...inv,
              status: 'PAID',
            },
            changeDue
          );
          onClose();
        }
      }}
    />
  </>
  );
}
