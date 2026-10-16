import {
  Drawer,
  Stack,
  Text,
  Group,
  TextInput,
  Button,
  Alert,
  Paper,
  Table,
  ActionIcon,
  NumberInput,
  Select,
  Box,
  Divider,
  Badge,
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconTruckLoading,
  IconTruckDelivery,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconReceiptTax,
  IconBuildingWarehouse,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useReceiveGoods } from '../api';
import { useProducts } from '../../products/api';
import { useVendors, useVendorProducts } from '../../vendors/api';
import type { ReceiveGoodsItemPayload } from '../types';

interface ReceiveGoodsDrawerProps {
  opened: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  organizationId: string;
}

export function ReceiveGoodsDrawer({
  opened,
  onClose,
  storeId,
  storeName,
  organizationId,
}: ReceiveGoodsDrawerProps) {
  const { mutateAsync: receiveGoods, isPending } = useReceiveGoods();
  const { data: products } = useProducts({ organization_id: organizationId });
  const { data: vendors } = useVendors({ organization_id: organizationId, is_active: true });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      vendor_id: '',
      reference_id: '',
      notes: '',
      items: [
        {
          product_id: '',
          quantity: 1,
          store_price: '',
          batch_number: '',
        },
      ],
    },
    validate: {
      reference_id: (val) => (!val.trim() ? 'Invoice or PO reference number is required' : null),
      items: {
        product_id: (val) => (!val ? 'Please select a product' : null),
        quantity: (val) => (val <= 0 ? 'Quantity must be ≥ 1' : null),
      },
    },
  });

  const selectedVendorId = form.values.vendor_id;
  const { data: vendorProducts } = useVendorProducts(
    selectedVendorId ? { vendor_id: selectedVendorId } : undefined
  );

  const vendorProductsMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof vendorProducts>[number]>();
    if (vendorProducts) {
      for (const vp of vendorProducts) {
        map.set(vp.product_id, vp);
      }
    }
    return map;
  }, [vendorProducts]);

  const selectedVendor = useMemo(() => {
    return vendors?.find((v) => v.id === selectedVendorId);
  }, [vendors, selectedVendorId]);

  const vendorOptions = useMemo(() => {
    if (!vendors) return [];
    return vendors.map((v) => ({
      value: v.id,
      label: `${v.name} (${v.vendor_code || v.payment_terms})`,
    }));
  }, [vendors]);

  const productsMap = useMemo(() => {
    const map = new Map();
    if (products) {
      for (const p of products) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [products]);

  const productOptions = useMemo(() => {
    if (!products) return [];
    return products.map((p) => {
      const vp = vendorProductsMap.get(p.id);
      const priceTag = vp ? ` • Negotiated: ₹${vp.negotiated_cost_price}` : p.cost_price ? ` • Base Cost: ₹${p.cost_price}` : '';
      return {
        value: p.id,
        label: `${p.name} (${p.sku})${priceTag}`,
      };
    });
  }, [products, vendorProductsMap]);

  const handleProductSelect = (index: number, productId: string) => {
    form.setFieldValue(`items.${index}.product_id`, productId);
    const vp = vendorProductsMap.get(productId);
    const prod = productsMap.get(productId);

    // Auto-prefill purchase price from negotiated vendor catalog or base cost
    if (vp && vp.negotiated_cost_price !== undefined) {
      form.setFieldValue(`items.${index}.store_price`, String(vp.negotiated_cost_price));
      if (vp.minimum_order_quantity && form.values.items[index].quantity < vp.minimum_order_quantity) {
        form.setFieldValue(`items.${index}.quantity`, vp.minimum_order_quantity);
      }
    } else if (prod && prod.cost_price) {
      form.setFieldValue(`items.${index}.store_price`, String(prod.cost_price));
    }
  };

  const handleClose = () => {
    form.reset();
    setErrorMessage(null);
    onClose();
  };

  const handleAddLine = () => {
    form.insertListItem('items', {
      product_id: '',
      quantity: 1,
      store_price: '',
      batch_number: '',
    });
  };

  const handleRemoveLine = (index: number) => {
    if (form.values.items.length > 1) {
      form.removeListItem('items', index);
    }
  };

  const consignmentTotal = useMemo(() => {
    return form.values.items.reduce((sum, item) => {
      const vp = vendorProductsMap.get(item.product_id);
      const prod = productsMap.get(item.product_id);
      const price = item.store_price
        ? Number(item.store_price)
        : vp?.negotiated_cost_price
        ? Number(vp.negotiated_cost_price)
        : prod?.cost_price
        ? Number(prod.cost_price)
        : 0;
      return sum + (Number(item.quantity) || 0) * price;
    }, 0);
  }, [form.values.items, vendorProductsMap, productsMap]);

  const handleSubmit = async (values: typeof form.values) => {
    setErrorMessage(null);

    const formattedItems: ReceiveGoodsItemPayload[] = values.items.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      store_price: item.store_price ? Number(item.store_price) : null,
      batch_number: item.batch_number ? item.batch_number.trim() : null,
    }));

    try {
      await receiveGoods({
        store_id: storeId,
        vendor_id: values.vendor_id || null,
        reference_id: values.reference_id.trim(),
        notes: values.notes.trim(),
        items: formattedItems,
      });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to receive goods';
      setErrorMessage(msg);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconTruckLoading size={22} color="var(--brand-primary)" />
          <div>
            <Text fw={700} size="md">
              Inward Stock (Goods Receipt Note)
            </Text>
            <Text size="xs" c="dimmed">
              Store: {storeName}
            </Text>
          </div>
        </Group>
      }
      position="right"
      size="xl"
      padding="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {errorMessage && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" title="Inwarding Failed">
              {errorMessage}
            </Alert>
          )}

          {/* Supplier & Header Consignment Details */}
          <Paper p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Select
                  label="Delivering Supplier / Vendor"
                  placeholder="Select supplier..."
                  data={vendorOptions}
                  searchable
                  clearable
                  leftSection={<IconTruckDelivery size={16} />}
                  {...form.getInputProps('vendor_id')}
                />
                <TextInput
                  label="Invoice / PO Reference #"
                  placeholder="e.g. PO-2026-991, INV-DL-4482"
                  required
                  {...form.getInputProps('reference_id')}
                />
              </SimpleGrid>

              <TextInput
                label="Auditor / Receiver Notes"
                placeholder="e.g. Delivered via Apex Freight, seal intact and verified"
                {...form.getInputProps('notes')}
              />

              {/* Vendor metadata badge card if vendor selected */}
              {selectedVendor && (
                <Paper p="xs" radius="sm" style={{ backgroundColor: 'var(--mantine-color-indigo-light)', border: '1px solid var(--mantine-color-indigo-light-hover)' }}>
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <IconBuildingWarehouse size={16} color="var(--mantine-color-indigo-7)" />
                      <Text size="xs" fw={700} c="indigo">
                        {selectedVendor.name} {selectedVendor.vendor_code && `(${selectedVendor.vendor_code})`}
                      </Text>
                      {selectedVendor.gstin && (
                        <Badge size="xs" variant="outline" color="indigo">
                          GST: {selectedVendor.gstin}
                        </Badge>
                      )}
                      <Badge size="xs" variant="light" color="indigo">
                        Terms: {selectedVendor.payment_terms}
                      </Badge>
                    </Group>
                    <Text size="11px" fw={600} c="indigo">
                      {vendorProducts?.length || 0} pre-negotiated items in catalog
                    </Text>
                  </Group>
                </Paper>
              )}
            </Stack>
          </Paper>

          {/* Line items section */}
          <Box>
            <Group justify="space-between" mb="xs">
              <div>
                <Text fw={700} size="sm">
                  Consignment Line Items
                </Text>
                <Text size="xs" c="dimmed">
                  Specify products, quantities, batch lot numbers, and store price overrides.
                </Text>
              </div>
              <Button
                variant="light"
                color="brand"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={handleAddLine}
              >
                Add Line Item
              </Button>
            </Group>

            <Paper radius="md" style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <Table verticalSpacing="xs" striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                  <Table.Tr>
                    <Table.Th style={{ width: '38%' }}>Product</Table.Th>
                    <Table.Th style={{ width: '20%' }}>Quantity</Table.Th>
                    <Table.Th style={{ width: '20%' }}>Purchase Price (₹)</Table.Th>
                    <Table.Th style={{ width: '18%' }}>Batch / Lot #</Table.Th>
                    <Table.Th style={{ width: '4%' }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {form.values.items.map((item, index) => {
                    const vp = vendorProductsMap.get(item.product_id);
                    const prod = productsMap.get(item.product_id);
                    const isBelowMOQ = vp?.minimum_order_quantity && item.quantity < vp.minimum_order_quantity;

                    return (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Select
                            placeholder="Select product..."
                            data={productOptions}
                            searchable
                            required
                            size="xs"
                            value={item.product_id}
                            onChange={(val) => handleProductSelect(index, val || '')}
                          />
                          {vp && (
                            <Group gap={4} mt={3}>
                              <Badge size="xs" color="teal" variant="light">
                                Procured @ ₹{vp.negotiated_cost_price}
                              </Badge>
                              {vp.vendor_sku && (
                                <Text size="10px" c="dimmed">
                                  Vendor SKU: {vp.vendor_sku}
                                </Text>
                              )}
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            min={1}
                            required
                            size="xs"
                            {...form.getInputProps(`items.${index}.quantity`)}
                          />
                          {vp?.minimum_order_quantity && (
                            <Group gap={4} mt={3}>
                              {isBelowMOQ ? (
                                <Group gap={2}>
                                  <IconAlertTriangle size={12} color="var(--mantine-color-orange-6)" />
                                  <Text size="10px" c="orange" fw={600}>
                                    Below MOQ ({vp.minimum_order_quantity})
                                  </Text>
                                </Group>
                              ) : (
                                <Text size="10px" c="dimmed">
                                  MOQ: {vp.minimum_order_quantity} • Lead: {vp.lead_time_days || 0}d
                                </Text>
                              )}
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            placeholder={vp ? `₹${vp.negotiated_cost_price}` : prod?.cost_price ? `₹${prod.cost_price}` : 'Auto'}
                            min={0}
                            decimalScale={2}
                            size="xs"
                            {...form.getInputProps(`items.${index}.store_price`)}
                          />
                          <Text size="10px" c="dimmed" mt={3}>
                            {item.store_price
                              ? 'Overridden'
                              : vp
                              ? 'From vendor contract'
                              : prod?.cost_price
                              ? 'From product cost'
                              : 'Standard MRP'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            placeholder="LOT-2026-X"
                            size="xs"
                            {...form.getInputProps(`items.${index}.batch_number`)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            size="sm"
                            disabled={form.values.items.length <= 1}
                            onClick={() => handleRemoveLine(index)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Paper>

            {/* Valuation Summary Card */}
            <Paper p="sm" mt="xs" radius="md" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <IconReceiptTax size={18} color="var(--mantine-color-gray-6)" />
                  <Text size="xs" c="dimmed">
                    Estimated Consignment Valuation ({form.values.items.length} line item{form.values.items.length > 1 ? 's' : ''}):
                  </Text>
                </Group>
                <Text fw={800} size="md" c="brand">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(consignmentTotal)}
                </Text>
              </Group>
            </Paper>
          </Box>

          <Divider />

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="brand"
              leftSection={<IconCheck size={16} />}
              loading={isPending}
            >
              Inward {form.values.items.length} Item{form.values.items.length > 1 ? 's' : ''} to Inventory
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
