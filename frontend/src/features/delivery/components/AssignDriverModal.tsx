import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  Select,
  Switch,
  Text,
  Badge,
  Paper,
} from '@mantine/core';
import { IconSteeringWheel, IconTruckDelivery } from '@tabler/icons-react';
import { useAssignDriver } from '../api';
import type { Delivery, DeliveryType } from '../types';

interface AssignDriverModalProps {
  opened: boolean;
  onClose: () => void;
  delivery: Delivery | null;
}

export function AssignDriverModal({ opened, onClose, delivery }: AssignDriverModalProps) {
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('INTERNAL');
  const [deliveryPartner, setDeliveryPartner] = useState('');
  const [markOutForDelivery, setMarkOutForDelivery] = useState(true);

  const assignDriverMutation = useAssignDriver();

  useEffect(() => {
    if (delivery) {
      setDriverName(delivery.driver_name || '');
      setDriverPhone(delivery.driver_phone || '');
      setVehicleNumber(delivery.vehicle_number || '');
      setDeliveryType(delivery.delivery_type || 'INTERNAL');
      setDeliveryPartner(delivery.delivery_partner || '');
      setMarkOutForDelivery(delivery.status === 'PENDING');
    }
  }, [delivery]);

  if (!delivery) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return;

    assignDriverMutation.mutate(
      {
        id: delivery.id,
        data: {
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          vehicle_number: vehicleNumber.trim(),
          delivery_partner: deliveryType === 'INTERNAL' ? 'Internal Fleet' : deliveryPartner.trim(),
          delivery_type: deliveryType,
          mark_out_for_delivery: markOutForDelivery,
        },
      },
      {
        onSuccess: () => {
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
          <IconSteeringWheel size={20} color="var(--brand-primary)" />
          <Text fw={700} size="md">
            Assign Driver & Dispatch — {delivery.tracking_id}
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
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" fw={600}>
                  RECIPIENT & DESTINATION
                </Text>
                <Text size="sm" fw={700}>
                  {delivery.recipient_name} ({delivery.recipient_phone})
                </Text>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {delivery.delivery_address}
                </Text>
              </div>
              {delivery.is_cod && (
                <Badge color="orange" variant="light" size="sm">
                  COD: ₹{Number(delivery.cod_amount_due).toFixed(2)}
                </Badge>
              )}
            </Group>
          </Paper>

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
            required
          />

          {deliveryType !== 'INTERNAL' && (
            <TextInput
              label="Courier Partner Name / AWB"
              placeholder="e.g. Shadowfax Express / Tracking #"
              value={deliveryPartner}
              onChange={(e) => setDeliveryPartner(e.currentTarget.value)}
            />
          )}

          <TextInput
            label="Driver / Courier Agent Name"
            placeholder="e.g. Ramesh Kumar"
            value={driverName}
            onChange={(e) => setDriverName(e.currentTarget.value)}
            required
            autoFocus
          />

          <TextInput
            label="Driver Mobile Phone"
            placeholder="e.g. 9876543210"
            value={driverPhone}
            onChange={(e) => setDriverPhone(e.currentTarget.value)}
          />

          <TextInput
            label="Vehicle Registration Number"
            placeholder="e.g. KA-03-HA-1234"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.currentTarget.value)}
          />

          <Switch
            label="Dispatch immediately (Mark Out for Delivery)"
            description="Driver picks up shipment package now"
            checked={markOutForDelivery}
            onChange={(e) => setMarkOutForDelivery(e.currentTarget.checked)}
            color="brand"
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="brand"
              loading={assignDriverMutation.isPending}
              leftSection={<IconTruckDelivery size={16} />}
            >
              Assign & Update
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
