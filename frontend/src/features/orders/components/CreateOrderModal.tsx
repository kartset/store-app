import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconPlus,
  IconShoppingCart,
  IconTrash,
} from '@tabler/icons-react';
import { useCreateOrder } from '../api';
import { useCustomers } from '../../customers/api';
import { useProducts } from '../../products/api';
import type { FulfillmentType, Order, OrderItemInput } from '../types';

interface CreateOrderModalProps {
  opened: boolean;
  onClose: () => void;
  storeId: string;
  onSuccess: (order: Order) => void;
}

export function CreateOrderModal({
  opened,
  onClose,
  storeId,
  onSuccess,
}: CreateOrderModalProps) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('STORE_PICKUP');

  // Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Items
  const [items, setItems] = useState<Array<OrderItemInput & { name: string; price: number }>>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDiscount, setItemDiscount] = useState<number>(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts({ is_active: true });
  const createMutation = useCreateOrder();

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.name || 'Unknown'} (${c.mobile_number})`,
  }));

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name} (SKU: ${p.sku}) - ₹${Number(p.base_mrp || 0).toFixed(2)}`,
  }));

  const handleCustomerChange = (val: string | null) => {
    setCustomerId(val);
    if (val) {
      const selected = customers.find((c) => c.id === val);
      if (selected) {
        setCustomerName(selected.name || '');
        setCustomerPhone(selected.mobile_number || '');
        setCustomerEmail(selected.email || '');
        setAddressLine1(selected.address_line1 || '');
        setAddressLine2(selected.address_line2 || '');
        setCity(selected.city || '');
        setState(selected.state || '');
        setPincode(selected.pincode || '');
      }
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const unitPrice = Number(prod.base_mrp || 0);
    const existingIndex = items.findIndex((i) => i.product_id === selectedProductId);

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += itemQuantity;
      updated[existingIndex].discount = (updated[existingIndex].discount || 0) + itemDiscount;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          product_id: selectedProductId,
          name: prod.name,
          price: unitPrice,
          quantity: itemQuantity,
          discount: itemDiscount,
        },
      ]);
    }

    setSelectedProductId(null);
    setItemQuantity(1);
    setItemDiscount(0);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const grandTotal = Math.max(0, subtotal - totalDiscount);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!storeId) {
      setErrorMsg('Store context is required to place an order.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one product to the order.');
      return;
    }

    try {
      const payload = {
        store_id: storeId,
        customer_id: customerId,
        fulfillment_type: fulfillmentType,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        delivery_address_line1: addressLine1,
        delivery_address_line2: addressLine2,
        delivery_city: city,
        delivery_state: state,
        delivery_pincode: pincode,
        delivery_notes: deliveryNotes,
        notes: orderNotes,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          discount: i.discount || 0,
        })),
      };

      const newOrder = await createMutation.mutateAsync(payload);
      onSuccess(newOrder);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          'Failed to create order. Please check inputs.'
      );
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size={28} radius="md" color="brand" variant="light">
            <IconShoppingCart size={16} />
          </ThemeIcon>
          <Text fw={700} size="md">
            Place New Customer Order
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        {errorMsg && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Validation Error"
            color="red"
            variant="filled"
            withCloseButton
            onClose={() => setErrorMsg(null)}
          >
            {errorMsg}
          </Alert>
        )}

        {/* Fulfillment Type Selection */}
        <Select
          label="Fulfillment Type"
          data={[
            { value: 'STORE_PICKUP', label: 'Store Pickup / Click & Collect' },
            { value: 'HOME_DELIVERY', label: 'Home Delivery' },
            { value: 'COUNTER_HOLD', label: 'Counter Hold / Reserve' },
          ]}
          value={fulfillmentType}
          onChange={(val) => setFulfillmentType((val as FulfillmentType) || 'STORE_PICKUP')}
          required
        />

        {/* Customer Information */}
        <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-gray-0)">
          <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase' }}>
            Customer Details
          </Text>

          <Select
            label="Registered Customer"
            placeholder="Search customer by name or phone..."
            data={customerOptions}
            value={customerId}
            onChange={handleCustomerChange}
            searchable
            clearable
            mb="xs"
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <TextInput
              label="Recipient Name"
              placeholder="e.g. Rahul Sharma"
              value={customerName}
              onChange={(e) => setCustomerName(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Phone Number"
              placeholder="10-digit mobile"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.currentTarget.value)}
              required
            />
          </SimpleGrid>
        </Paper>

        {/* Home Delivery Address Fields */}
        {fulfillmentType === 'HOME_DELIVERY' && (
          <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-gray-0)">
            <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase' }}>
              Shipping Address
            </Text>
            <Stack gap="xs">
              <TextInput
                label="Address Line 1"
                placeholder="House / Flat / Street"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.currentTarget.value)}
                required
              />
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                <TextInput
                  label="City"
                  placeholder="e.g. Bengaluru"
                  value={city}
                  onChange={(e) => setCity(e.currentTarget.value)}
                />
                <TextInput
                  label="State"
                  placeholder="e.g. Karnataka"
                  value={state}
                  onChange={(e) => setState(e.currentTarget.value)}
                />
                <TextInput
                  label="Pincode"
                  placeholder="e.g. 560038"
                  value={pincode}
                  onChange={(e) => setPincode(e.currentTarget.value)}
                />
              </SimpleGrid>
              <TextInput
                label="Delivery Instructions"
                placeholder="e.g. Call upon arrival, leave with security"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.currentTarget.value)}
              />
            </Stack>
          </Paper>
        )}

        {/* Product Picker */}
        <Paper p="sm" radius="md" withBorder>
          <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase' }}>
            Add Products to Order
          </Text>

          <Group align="flex-end" mb="sm">
            <Select
              style={{ flex: 1 }}
              label="Select Product"
              placeholder="Search product..."
              data={productOptions}
              value={selectedProductId}
              onChange={setSelectedProductId}
              searchable
              clearable
            />
            <NumberInput
              style={{ width: 90 }}
              label="Quantity"
              min={1}
              value={itemQuantity}
              onChange={(val) => setItemQuantity(typeof val === 'number' ? val : 1)}
            />
            <NumberInput
              style={{ width: 100 }}
              label="Discount (₹)"
              min={0}
              value={itemDiscount}
              onChange={(val) => setItemDiscount(typeof val === 'number' ? val : 0)}
            />
            <Button
              color="brand"
              leftSection={<IconPlus size={16} />}
              onClick={handleAddItem}
              disabled={!selectedProductId}
            >
              Add
            </Button>
          </Group>

          {/* Items Table */}
          {items.length > 0 ? (
            <Table striped withTableBorder style={{ fontSize: '12px' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td>{item.name}</Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>{item.quantity}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>₹{item.price.toFixed(2)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ₹{(item.price * item.quantity - (item.discount || 0)).toFixed(2)}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="compact-xs"
                        color="red"
                        variant="subtle"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <IconTrash size={14} />
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="xs" c="dimmed" ta="center" py="sm">
              No products added yet.
            </Text>
          )}

          {items.length > 0 && (
            <Group justify="flex-end" mt="sm">
              <Box style={{ textAlign: 'right' }}>
                <Text size="xs" c="dimmed">
                  Order Total
                </Text>
                <Text size="lg" fw={800} c="brand">
                  ₹{grandTotal.toFixed(2)}
                </Text>
              </Box>
            </Group>
          )}
        </Paper>

        <Textarea
          label="Internal Notes"
          placeholder="Optional notes for fulfillment staff..."
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.currentTarget.value)}
          rows={2}
        />

        <Divider />

        <Group justify="space-between">
          <Button variant="default" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="brand"
            leftSection={<IconCheck size={16} />}
            loading={createMutation.isPending}
            onClick={handleSubmit}
            disabled={items.length === 0}
          >
            Create Order
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
