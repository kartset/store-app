import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  Textarea,
  Select,
  Switch,
  NumberInput,
  Text,
  SegmentedControl,
  Paper,
} from '@mantine/core';
import { IconPackage, IconTruckDelivery } from '@tabler/icons-react';
import { useCreateDelivery } from '../api';
import { useOrders } from '../../orders/api';
import { useStores } from '../../stores/api';
import type { DeliveryType } from '../types';

interface CreateDeliveryModalProps {
  opened: boolean;
  onClose: () => void;
  defaultStoreId?: string;
}

export function CreateDeliveryModal({ opened, onClose, defaultStoreId }: CreateDeliveryModalProps) {
  const [mode, setMode] = useState<'order' | 'manual'>('order');
  const [storeId, setStoreId] = useState(defaultStoreId || '');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Manual fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isCod, setIsCod] = useState(false);
  const [codAmount, setCodAmount] = useState<number | string>(0);

  // Logistics & Driver
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('INTERNAL');
  const [deliveryPartner, setDeliveryPartner] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  const { data: stores = [] } = useStores();
  const { data: homeDeliveryOrders = [] } = useOrders({
    store_id: storeId || undefined,
    fulfillment_type: 'HOME_DELIVERY',
  });

  const createDeliveryMutation = useCreateDelivery();

  useEffect(() => {
    if (defaultStoreId) {
      setStoreId(defaultStoreId);
    } else if (stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [defaultStoreId, stores, storeId]);

  // When order is selected in 'order' mode, prefill details
  useEffect(() => {
    if (selectedOrderId && homeDeliveryOrders.length > 0) {
      const order = homeDeliveryOrders.find((o) => o.id === selectedOrderId);
      if (order) {
        setRecipientName(order.customer_name_snapshot || order.customer?.name || '');
        setRecipientPhone(order.customer_phone_snapshot || order.customer?.mobile_number || '');
        const addr = [
          order.delivery_address_line1,
          order.delivery_address_line2,
          order.delivery_city,
          order.delivery_state,
          order.delivery_pincode,
        ]
          .filter(Boolean)
          .join(', ');
        setDeliveryAddress(addr);
        setDeliveryNotes(order.delivery_notes || '');
        if (order.payment_status !== 'PAID') {
          setIsCod(true);
          setCodAmount(Number(order.grand_total));
        } else {
          setIsCod(false);
          setCodAmount(0);
        }
      }
    }
  }, [selectedOrderId, homeDeliveryOrders]);

  const resetForm = () => {
    setSelectedOrderId(null);
    setRecipientName('');
    setRecipientPhone('');
    setDeliveryAddress('');
    setDeliveryNotes('');
    setIsCod(false);
    setCodAmount(0);
    setDeliveryType('INTERNAL');
    setDeliveryPartner('');
    setDriverName('');
    setDriverPhone('');
    setVehicleNumber('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;

    createDeliveryMutation.mutate(
      {
        store_id: storeId,
        order_id: mode === 'order' && selectedOrderId ? selectedOrderId : undefined,
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        delivery_notes: deliveryNotes.trim(),
        is_cod: isCod,
        cod_amount_due: isCod ? Number(codAmount) : 0,
        delivery_type: deliveryType,
        delivery_partner: deliveryType === 'INTERNAL' ? 'Internal Fleet' : deliveryPartner.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        vehicle_number: vehicleNumber.trim(),
      },
      {
        onSuccess: () => {
          resetForm();
          onClose();
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
          <IconPackage size={20} color="var(--brand-primary)" />
          <Text fw={700} size="md">
            Dispatch Package / Create Delivery
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <SegmentedControl
            value={mode}
            onChange={(val) => setMode(val as 'order' | 'manual')}
            data={[
              { label: 'From Home Delivery Order', value: 'order' },
              { label: 'Manual Shipment Dispatch', value: 'manual' },
            ]}
            fullWidth
          />

          <Select
            label="Origin Store"
            data={stores.map((s) => ({ value: s.id, label: s.name }))}
            value={storeId}
            onChange={(val) => {
              setStoreId(val || '');
              setSelectedOrderId(null);
            }}
            required
          />

          {mode === 'order' && (
            <Select
              label="Select Pending Home Delivery Order"
              placeholder={
                homeDeliveryOrders.length === 0
                  ? 'No home delivery orders found for store'
                  : 'Choose order to dispatch'
              }
              data={homeDeliveryOrders.map((o) => ({
                value: o.id,
                label: `${o.order_number} — ${o.customer_name_snapshot || 'Customer'} (₹${Number(o.grand_total).toFixed(2)}) [${o.status}]`,
              }))}
              value={selectedOrderId}
              onChange={setSelectedOrderId}
              searchable
              clearable
              required
            />
          )}

          <Paper withBorder p="sm" radius="md">
            <Stack gap="xs">
              <Text size="xs" fw={700} c="dimmed">
                RECIPIENT &amp; SHIPPING DESTINATION
              </Text>
              <Group grow>
                <TextInput
                  label="Recipient Full Name"
                  placeholder="e.g. Ananya Roy"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.currentTarget.value)}
                  required
                />
                <TextInput
                  label="Recipient Contact Phone"
                  placeholder="e.g. 9811122233"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.currentTarget.value)}
                  required
                />
              </Group>

              <Textarea
                label="Full Delivery Address"
                placeholder="House / Flat No, Street, Locality, City, State, PIN Code"
                minRows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.currentTarget.value)}
                required
              />

              <TextInput
                label="Special Delivery Instructions"
                placeholder="e.g. Ring bell twice, leave at reception if unavailable"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.currentTarget.value)}
              />

              <Group justify="space-between" mt="xs">
                <Switch
                  label="Cash-on-Delivery (COD)"
                  description="Courier agent must collect payment upon handover"
                  checked={isCod}
                  onChange={(e) => setIsCod(e.currentTarget.checked)}
                  color="orange"
                />
                {isCod && (
                  <NumberInput
                    label="COD Amount Due (₹)"
                    value={codAmount}
                    onChange={(val) => setCodAmount(val || 0)}
                    min={0}
                    step={1}
                    required
                    style={{ width: '160px' }}
                  />
                )}
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder p="sm" radius="md">
            <Stack gap="xs">
              <Text size="xs" fw={700} c="dimmed">
                DRIVER &amp; LOGISTICS ALLOCATION (OPTIONAL)
              </Text>
              <Select
                label="Logistics Channel"
                data={[
                  { value: 'INTERNAL', label: 'Store Fleet / Internal Driver' },
                  { value: 'DUNZO', label: 'Dunzo Direct' },
                  { value: 'SHADOWFAX', label: 'Shadowfax Courier' },
                  { value: 'PORTER', label: 'Porter Logistics' },
                  { value: 'BLUEDART', label: 'Blue Dart Express' },
                  { value: 'DELHIVERY', label: 'Delhivery' },
                  { value: 'OTHER', label: 'Other Third-Party Courier' },
                ]}
                value={deliveryType}
                onChange={(val) => setDeliveryType((val as DeliveryType) || 'INTERNAL')}
              />

              {deliveryType !== 'INTERNAL' && (
                <TextInput
                  label="Partner Name / Tracking Reference"
                  placeholder="e.g. Porter City Rush / AWB"
                  value={deliveryPartner}
                  onChange={(e) => setDeliveryPartner(e.currentTarget.value)}
                />
              )}

              <Group grow>
                <TextInput
                  label="Driver Name"
                  placeholder="e.g. Suresh Kumar"
                  value={driverName}
                  onChange={(e) => setDriverName(e.currentTarget.value)}
                />
                <TextInput
                  label="Driver Mobile"
                  placeholder="e.g. 9811223344"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.currentTarget.value)}
                />
              </Group>

              <TextInput
                label="Vehicle Registration"
                placeholder="e.g. KA-01-MJ-9988"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.currentTarget.value)}
              />
            </Stack>
          </Paper>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="brand"
              loading={createDeliveryMutation.isPending}
              leftSection={<IconTruckDelivery size={16} />}
            >
              Create &amp; Dispatch Package
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
