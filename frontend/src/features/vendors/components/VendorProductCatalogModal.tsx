import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Table,
  TextInput,
  NumberInput,
  Select,
  Switch,
  SimpleGrid,
  ThemeIcon,
  Center,
  Loader,
  Alert,
  Paper,
  ActionIcon,
  Tooltip,
  Divider,
} from '@mantine/core';
import {
  IconPackage,
  IconPlus,
  IconTrash,
  IconStar,
  IconStarFilled,
  IconClock,
  IconReceiptTax,
  IconAlertCircle,
} from '@tabler/icons-react';

import { useState, useMemo } from 'react';
import { useProducts } from '../../products/api';
import {
  useVendorProducts,
  useCreateVendorProduct,
  useUpdateVendorProduct,
  useDeleteVendorProduct,
} from '../api';
import type { Vendor } from '../types';

interface VendorProductCatalogModalProps {
  opened: boolean;
  onClose: () => void;
  vendor: Vendor | null;
}

export function VendorProductCatalogModal({
  opened,
  onClose,
  vendor,
}: VendorProductCatalogModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [vendorSku, setVendorSku] = useState('');
  const [negotiatedCostPrice, setNegotiatedCostPrice] = useState<number | string>('');
  const [moq, setMoq] = useState<number | string>(1);
  const [leadTimeDays, setLeadTimeDays] = useState<number | string>(3);
  const [isPrimary, setIsPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Search filter inside modal
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch products mapped to this vendor
  const {
    data: vendorProducts,
    isLoading: isLoadingVP,
    error: vpError,
  } = useVendorProducts(
    vendor?.id
      ? {
          vendor_id: vendor.id,
          search: searchTerm || undefined,
        }
      : undefined
  );

  // Fetch organization's master products for mapping selection
  const { data: allOrgProducts } = useProducts(
    vendor?.organization_id
      ? { organization_id: vendor.organization_id, is_active: true }
      : undefined
  );

  const createVPMutation = useCreateVendorProduct();
  const updateVPMutation = useUpdateVendorProduct();
  const deleteVPMutation = useDeleteVendorProduct();

  // Exclude products already mapped to this vendor
  const availableProducts = useMemo(() => {
    if (!allOrgProducts) return [];
    const mappedProductIds = new Set(vendorProducts?.map((vp) => vp.product_id) || []);
    return allOrgProducts.filter((p) => !mappedProductIds.has(p.id));
  }, [allOrgProducts, vendorProducts]);

  const productSelectData = useMemo(() => {
    return availableProducts.map((p) => ({
      value: p.id,
      label: `${p.name} (SKU: ${p.sku}${p.base_mrp ? ` • MRP: ₹${p.base_mrp}` : ''})`,
    }));
  }, [availableProducts]);

  // Selected product metadata for margin preview
  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !allOrgProducts) return null;
    return allOrgProducts.find((p) => p.id === selectedProductId) || null;
  }, [selectedProductId, allOrgProducts]);

  // Gross margin calculation preview
  const grossMargin = useMemo(() => {
    if (!selectedProduct?.base_mrp) return null;
    const mrp = Number(selectedProduct.base_mrp);
    const cost = Number(negotiatedCostPrice);
    if (mrp <= 0 || cost <= 0) return null;
    const margin = ((mrp - cost) / mrp) * 100;
    return margin.toFixed(1);
  }, [selectedProduct, negotiatedCostPrice]);

  const handleResetForm = () => {
    setSelectedProductId('');
    setVendorSku('');
    setNegotiatedCostPrice('');
    setMoq(1);
    setLeadTimeDays(3);
    setIsPrimary(false);
    setFormError(null);
    setShowAddForm(false);
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!vendor) return;
    if (!selectedProductId) {
      setFormError('Please select a product from the catalog.');
      return;
    }

    const price = Number(negotiatedCostPrice);
    if (!price || price <= 0) {
      setFormError('Negotiated cost price must be strictly greater than zero.');
      return;
    }

    try {
      await createVPMutation.mutateAsync({
        vendor_id: vendor.id,
        product_id: selectedProductId,
        vendor_sku: vendorSku.trim() || undefined,
        negotiated_cost_price: price,
        minimum_order_quantity: Number(moq) || 1,
        lead_time_days: Number(leadTimeDays) || 0,
        is_primary_supplier: isPrimary,
      });
      handleResetForm();
    } catch (err: any) {
      const respData = err?.response?.data;
      if (typeof respData === 'object' && respData !== null) {
        const errorMsg = Object.entries(respData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join(' | ');
        setFormError(errorMsg || 'Failed to map product to vendor.');
      } else {
        setFormError(err?.message || 'Error occurred while saving mapping.');
      }
    }
  };

  const handleTogglePrimary = async (vpId: string, currentVal: boolean) => {
    await updateVPMutation.mutateAsync({
      id: vpId,
      data: { is_primary_supplier: !currentVal },
    });
  };

  const handleDeleteMapping = async (vpId: string) => {
    await deleteVPMutation.mutateAsync(vpId);
  };

  if (!vendor) return null;

  return (
    <Modal
      opened={opened}
      onClose={() => {
        handleResetForm();
        onClose();
      }}
      size="xl"
      title={
        <Group gap="sm">
          <ThemeIcon size={32} radius="md" color="indigo" variant="light">
            <IconPackage size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="md">
              Supplier Catalog & Pricing: {vendor.name}
            </Text>
            <Group gap={6} mt={2}>
              {vendor.vendor_code && (
                <Badge size="xs" variant="outline" color="gray">
                  Code: {vendor.vendor_code}
                </Badge>
              )}
              {vendor.gstin && (
                <Badge size="xs" color="teal" variant="light">
                  GSTIN: {vendor.gstin}
                </Badge>
              )}
              <Badge size="xs" color="indigo" variant="light">
                Terms: {vendor.payment_terms}
              </Badge>
            </Group>
          </div>
        </Group>
      }
      styles={{
        header: {
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '14px',
        },
        body: {
          padding: '20px',
        },
      }}
    >
      <Stack gap="md">
        {/* Top Action Bar */}
        <Group justify="space-between" wrap="wrap">
          <TextInput
            placeholder="Search supplied items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 260 }}
          />

          <Button
            leftSection={<IconPlus size={16} />}
            color="brand"
            variant={showAddForm ? 'light' : 'filled'}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel Mapping' : 'Map Product to Vendor'}
          </Button>
        </Group>

        {/* Collapsible Add Mapping Form */}
        {showAddForm && (
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
            <form onSubmit={handleCreateMapping}>
              <Stack gap="sm">
                <Text fw={700} size="sm">
                  Add Catalog Item to Supplier Price List
                </Text>

                {formError && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    variant="light"
                    withCloseButton
                    onClose={() => setFormError(null)}
                  >
                    {formError}
                  </Alert>
                )}

                <Select
                  label="Catalog Product"
                  placeholder="Select product from master catalog..."
                  data={productSelectData}
                  value={selectedProductId}
                  onChange={(val) => setSelectedProductId(val || '')}
                  searchable
                  required
                />

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <NumberInput
                    label="Negotiated Cost Price (₹ INR)"
                    placeholder="0.00"
                    value={negotiatedCostPrice}
                    onChange={(val) => setNegotiatedCostPrice(val)}
                    min={0.01}
                    decimalScale={2}
                    prefix="₹ "
                    required
                  />

                  <TextInput
                    label="Vendor Item SKU (Optional)"
                    placeholder="e.g. HUL-LUX-ROSE"
                    value={vendorSku}
                    onChange={(e) => setVendorSku(e.target.value)}
                  />

                  <NumberInput
                    label="Minimum Order Qty (MOQ)"
                    placeholder="1"
                    value={moq}
                    onChange={(val) => setMoq(val)}
                    min={1}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <NumberInput
                    label="Lead Time (Days)"
                    placeholder="3"
                    value={leadTimeDays}
                    onChange={(val) => setLeadTimeDays(val)}
                    min={0}
                  />

                  <Group align="flex-end" style={{ height: '100%', paddingBottom: 6 }}>
                    <Switch
                      label="Primary Supplier"
                      description="Use as default vendor for PO replenishment"
                      checked={isPrimary}
                      onChange={(e) => setIsPrimary(e.currentTarget.checked)}
                      color="brand"
                    />
                  </Group>
                </SimpleGrid>

                {grossMargin !== null && (
                  <Group gap="xs" mt={4}>
                    <IconReceiptTax size={16} color="teal" />
                    <Text size="xs" fw={600} c="teal">
                      Projected Gross Margin: {grossMargin}% (MRP: ₹{selectedProduct?.base_mrp} vs Cost: ₹{negotiatedCostPrice})
                    </Text>
                  </Group>
                )}

                <Divider my="xs" />

                <Group justify="flex-end" gap="sm">
                  <Button variant="default" size="sm" onClick={handleResetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" color="brand" loading={createVPMutation.isPending}>
                    Save Mapping
                  </Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        )}

        {/* Mapped Products Table */}
        {isLoadingVP ? (
          <Center py={40}>
            <Stack align="center" gap="xs">
              <Loader size="sm" color="brand" />
              <Text size="xs" c="dimmed">
                Loading vendor catalog...
              </Text>
            </Stack>
          </Center>
        ) : vpError ? (
          <Center py={30}>
            <Text c="red" size="sm">
              Failed to load vendor catalog items.
            </Text>
          </Center>
        ) : !vendorProducts || vendorProducts.length === 0 ? (
          <Center py={40}>
            <Stack align="center" gap="sm">
              <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                <IconPackage size={24} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                No Products Mapped Yet
              </Text>
              <Text size="xs" c="dimmed" maw={320} style={{ textAlign: 'center' }}>
                This vendor has no agreed product pricing or catalog items configured. Map your first product to establish procurement costs.
              </Text>
              {!showAddForm && (
                <Button size="xs" color="brand" onClick={() => setShowAddForm(true)}>
                  Map First Product
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <Table verticalSpacing="xs" striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
              <Table.Tr>
                <Table.Th>Product & SKU</Table.Th>
                <Table.Th>Agreed Cost</Table.Th>
                <Table.Th>MOQ & Lead Time</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {vendorProducts.map((vp) => (
                <Table.Tr key={vp.id}>
                  {/* Product Details */}
                  <Table.Td>
                    <div>
                      <Text fw={700} size="xs">
                        {vp.product?.name || 'Unknown Product'}
                      </Text>
                      <Group gap={6} mt={2}>
                        <Badge size="xs" variant="outline" color="gray">
                          SKU: {vp.product?.sku}
                        </Badge>
                        {vp.vendor_sku && (
                          <Badge size="xs" variant="light" color="blue">
                            Vendor SKU: {vp.vendor_sku}
                          </Badge>
                        )}
                      </Group>
                    </div>
                  </Table.Td>

                  {/* Agreed Cost & Margin */}
                  <Table.Td>
                    <Stack gap={2}>
                      <Text fw={700} size="sm" c="teal.8">
                        ₹{Number(vp.negotiated_cost_price).toFixed(2)}
                      </Text>
                      {vp.product?.base_mrp && (
                        <Text size="11px" c="dimmed">
                          MRP: ₹{vp.product.base_mrp}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>

                  {/* MOQ & Lead Time */}
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="xs" fw={600}>
                        MOQ: {vp.minimum_order_quantity} units
                      </Text>
                      <Group gap={4}>
                        <IconClock size={12} color="gray" />
                        <Text size="11px" c="dimmed">
                          {vp.lead_time_days} days turnaround
                        </Text>
                      </Group>
                    </Stack>
                  </Table.Td>

                  {/* Primary Supplier status */}
                  <Table.Td>
                    <Tooltip
                      label={
                        vp.is_primary_supplier
                          ? 'Primary supplier (Click to demote)'
                          : 'Secondary supplier (Click to promote to primary)'
                      }
                      withArrow
                    >
                      <ActionIcon
                        variant="light"
                        color={vp.is_primary_supplier ? 'amber' : 'gray'}
                        size="sm"
                        onClick={() => handleTogglePrimary(vp.id, vp.is_primary_supplier)}
                      >
                        {vp.is_primary_supplier ? (
                          <IconStarFilled size={14} color="#d97706" />
                        ) : (
                          <IconStar size={14} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>

                  {/* Actions */}
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Tooltip label="Remove from Vendor Catalog" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleDeleteMapping(vp.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Modal>
  );
}
