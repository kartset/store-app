import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  NumberInput,
  Select,
  Text,
  Badge,
  Alert,
  Box,
  Divider,
  Paper,
  SimpleGrid,
  ScrollArea,
  Card,
  ThemeIcon,
  Loader,
  Center,
  Switch,
} from '@mantine/core';
import {
  IconSearch,
  IconBarcode,
  IconWorld,
  IconSparkles,
  IconCheck,
  IconAlertCircle,
  IconPackage,
  IconBuildingStore,
  IconCash,
  IconArrowRight,
} from '@tabler/icons-react';

import { useState, useMemo } from 'react';
import {
  useCatalogueItems,
  lookupGlobalCatalogue,
  useAdoptCatalogueItem,
  useCategories,
  useOrganizationCategories,
  useBrands,
  useSubcategories,
} from '../api';
import type { CatalogueItem, AdoptCataloguePayload } from '../types';

interface AdoptCatalogueModalProps {
  opened: boolean;
  onClose: () => void;
  organizationId: string;
  storeId?: string;
  onSuccess?: () => void;
}

export function AdoptCatalogueModal({
  opened,
  onClose,
  organizationId,
  storeId,
  onSuccess,
}: AdoptCatalogueModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedItem, setSelectedItem] = useState<CatalogueItem | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [adoptSuccessMsg, setAdoptSuccessMsg] = useState<string | null>(null);
  const [adoptErrorMsg, setAdoptErrorMsg] = useState<string | null>(null);

  // Adoption Form State
  const [costPrice, setCostPrice] = useState<number>(0);
  const [baseMrp, setBaseMrp] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [assignToStore, setAssignToStore] = useState<boolean>(Boolean(storeId));
  const [initialStock, setInitialStock] = useState<number>(0);
  const [storePrice, setStorePrice] = useState<number | undefined>(undefined);

  // Data fetching
  const { data: catalogueItems, isLoading: isCatalogueLoading } = useCatalogueItems({
    search: searchQuery || undefined,
  });

  const { data: platformCategories } = useCategories();
  const { data: orgCategories } = useOrganizationCategories(organizationId);
  const { data: brands } = useBrands(organizationId);
  const { data: subcategories } = useSubcategories(
    organizationId ? { organization_id: organizationId, category_id: categoryId || undefined } : undefined
  );




  const adoptMutation = useAdoptCatalogueItem();

  // Categories list mapped to org
  const categoryOptions = useMemo(() => {
    if (orgCategories && orgCategories.length > 0) {
      return orgCategories
        .filter((oc) => oc.is_active && oc.category)
        .map((oc) => ({
          value: oc.category.id,
          label: oc.category.name,
        }));
    }
    return (platformCategories || []).map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));
  }, [orgCategories, platformCategories]);

  const subcategoryOptions = useMemo(() => {
    return (subcategories || [])
      .filter((sub) => sub.is_active)
      .map((sub) => ({
        value: sub.id,
        label: sub.name,
      }));
  }, [subcategories]);

  const brandOptions = useMemo(() => {
    return (brands || [])
      .filter((b) => b.is_active)
      .map((b) => ({
        value: b.id,
        label: b.name,
      }));
  }, [brands]);

  // Select an item for configuration
  const handleSelectItem = (item: CatalogueItem) => {
    setSelectedItem(item);
    setCostPrice(0);
    setBaseMrp(item.suggested_mrp ? Number(item.suggested_mrp) : 0);
    setStorePrice(item.suggested_mrp ? Number(item.suggested_mrp) : undefined);
    setAdoptErrorMsg(null);
    setAdoptSuccessMsg(null);
  };

  // Direct Barcode Lookup
  const handleBarcodeLookup = async () => {
    if (!barcodeInput.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const item = await lookupGlobalCatalogue(barcodeInput.trim());
      if (item) {
        handleSelectItem(item);
      } else {
        setLookupError(`No product found in Global Catalogue with barcode "${barcodeInput}".`);
      }
    } catch {
      setLookupError('Failed to lookup barcode in Global Catalogue.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Submit Adoption
  const handleAdopt = async () => {
    if (!selectedItem || !organizationId) return;
    setAdoptErrorMsg(null);
    setAdoptSuccessMsg(null);

    const payload: AdoptCataloguePayload = {
      organization_id: organizationId,
      cost_price: costPrice,
      base_mrp: baseMrp,
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      brand_id: brandId || null,
      low_stock_threshold: lowStockThreshold,
    };

    if (assignToStore && storeId) {
      payload.store_id = storeId;
      payload.initial_stock = initialStock;
      if (storePrice !== undefined) {
        payload.store_price = storePrice;
      }
    }

    try {
      const res = await adoptMutation.mutateAsync({
        id: selectedItem.id,
        data: payload,
      });
      setAdoptSuccessMsg(res.message || `Adopted "${selectedItem.name}" successfully!`);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSelectedItem(null);
        setAdoptSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Failed to adopt catalogue item into organization.';
      setAdoptErrorMsg(msg);
    }
  };

  const handleClose = () => {
    setSelectedItem(null);
    setSearchQuery('');
    setBarcodeInput('');
    setAdoptErrorMsg(null);
    setAdoptSuccessMsg(null);
    setLookupError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="xl"
      radius="md"
      title={
        <Group gap="xs">
          <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'indigo', to: 'violet' }}>
            <IconWorld size={20} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="md">
              Adopt from Global Product Register
            </Text>
            <Text size="xs" c="dimmed">
              Search universal FMCG &amp; retail products or scan a barcode to 1-click fork into your organization
            </Text>
          </div>
        </Group>
      }
      styles={{
        header: { borderBottom: '1px solid var(--mantine-color-default-border)', paddingBottom: 12 },
        body: { paddingTop: 16 },
      }}
    >
      <Stack gap="md">
        {adoptSuccessMsg && (
          <Alert icon={<IconCheck size={18} />} color="teal" radius="md" title="Adoption Complete">
            {adoptSuccessMsg}
          </Alert>
        )}

        {adoptErrorMsg && (
          <Alert icon={<IconAlertCircle size={18} />} color="red" radius="md" title="Adoption Error">
            {adoptErrorMsg}
          </Alert>
        )}

        {/* Barcode Quick Scanner Bar */}
        <Paper p="sm" withBorder radius="md" bg="var(--mantine-color-gray-0)">
          <Group gap="xs" align="flex-end">
            <TextInput
              label="Quick Barcode Scanner (EAN-13 / UPC)"
              placeholder="Scan or type 13-digit barcode..."
              leftSection={<IconBarcode size={16} />}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcodeLookup();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              variant="light"
              color="indigo"
              onClick={handleBarcodeLookup}
              loading={lookupLoading}
              leftSection={<IconSearch size={16} />}
            >
              Lookup Barcode
            </Button>
          </Group>
          {lookupError && (
            <Text size="xs" c="red.6" mt={6}>
              {lookupError}
            </Text>
          )}
        </Paper>

        {/* Selected Product Adoption Configuration Pane */}
        {selectedItem ? (
          <Paper p="md" withBorder radius="md" bg="indigo.0">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Badge color="indigo" variant="filled">
                      Selected for Adoption
                    </Badge>
                    <Badge color="gray" variant="outline">
                      Global SKU: {selectedItem.sku}
                    </Badge>
                    {selectedItem.barcode && (
                      <Badge color="teal" variant="light" leftSection={<IconBarcode size={12} />}>
                        {selectedItem.barcode}
                      </Badge>
                    )}
                  </Group>
                  <Text fw={700} size="lg" c="indigo.9">
                    {selectedItem.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedItem.brand_name || 'Standard Brand'} &bull; {selectedItem.category_name || 'General Category'} &bull; Tax Slab: {selectedItem.tax_slab}% GST &bull; UOM: {selectedItem.uom}
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => setSelectedItem(null)}
                >
                  Change Selection
                </Button>
              </Group>

              <Divider my={4} />

              <Text fw={600} size="sm">
                Organization Product Attributes
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <NumberInput
                  label="Purchase Cost Price (₹)"
                  placeholder="0.00"
                  min={0}
                  decimalScale={2}
                  value={costPrice}
                  onChange={(v) => setCostPrice(Number(v) || 0)}
                  leftSection={<IconCash size={16} />}
                />

                <NumberInput
                  label="Selling MRP (₹)"
                  placeholder="Recommended price"
                  min={0}
                  decimalScale={2}
                  value={baseMrp}
                  onChange={(v) => setBaseMrp(Number(v) || 0)}
                  description={selectedItem.suggested_mrp ? `Suggested: ₹${selectedItem.suggested_mrp}` : undefined}
                  leftSection={<IconCash size={16} />}
                />

                <Select
                  label="Organization Category"
                  placeholder="Map to category"
                  data={categoryOptions}
                  value={categoryId}
                  onChange={(val) => {
                    setCategoryId(val);
                    setSubcategoryId(null);
                  }}
                  clearable
                  searchable
                />

                <Select
                  label="Organization Subcategory"
                  placeholder={categoryId ? "Select subcategory" : "Pick a category first"}
                  data={subcategoryOptions}
                  value={subcategoryId}
                  onChange={setSubcategoryId}
                  disabled={!categoryId || subcategoryOptions.length === 0}
                  clearable
                  searchable
                />

                <Select
                  label="Organization Brand"
                  placeholder="Map to brand"
                  data={brandOptions}
                  value={brandId}
                  onChange={setBrandId}
                  clearable
                  searchable
                />

                <NumberInput
                  label="Low Stock Alert Threshold"
                  min={1}
                  value={lowStockThreshold}
                  onChange={(v) => setLowStockThreshold(Number(v) || 10)}
                />
              </SimpleGrid>

              {/* Optional Store Inventory Setup */}
              {storeId && (
                <Box mt="xs">
                  <Divider my="xs" />
                  <Switch
                    label="Stock in active store immediately"
                    description="Automatically creates a store inventory record and opening stock"
                    checked={assignToStore}
                    onChange={(e) => setAssignToStore(e.currentTarget.checked)}
                  />

                  {assignToStore && (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="sm">
                      <NumberInput
                        label="Initial Opening Stock (Units)"
                        min={0}
                        value={initialStock}
                        onChange={(v) => setInitialStock(Number(v) || 0)}
                        leftSection={<IconPackage size={16} />}
                      />
                      <NumberInput
                        label="Store Selling Price Override (₹)"
                        placeholder={`Defaults to ₹${baseMrp || 0}`}
                        min={0}
                        decimalScale={2}
                        value={storePrice}
                        onChange={(v) => setStorePrice(v ? Number(v) : undefined)}
                        leftSection={<IconBuildingStore size={16} />}
                      />
                    </SimpleGrid>
                  )}
                </Box>
              )}

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setSelectedItem(null)}>
                  Back to List
                </Button>
                <Button
                  color="indigo"
                  onClick={handleAdopt}
                  loading={adoptMutation.isPending}
                  leftSection={<IconSparkles size={16} />}
                >
                  Adopt &amp; Fork into Products
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : (
          /* Catalogue Items Browser */
          <Stack gap="xs">
            <TextInput
              placeholder="Search catalogue by Name, Brand, SKU, or Barcode..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />

            <ScrollArea.Autosize mah={400} type="scroll">
              {isCatalogueLoading ? (
                <Center p="xl">
                  <Loader size="md" color="indigo" />
                </Center>
              ) : !catalogueItems || catalogueItems.length === 0 ? (
                <Center p="xl">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={44} radius="xl" color="gray" variant="light">
                      <IconPackage size={24} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed">
                      {searchQuery
                        ? `No items found matching "${searchQuery}".`
                        : 'No items currently in the Global Catalogue.'}
                    </Text>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="xs">
                  {catalogueItems.map((item) => (
                    <Card
                      key={item.id}
                      withBorder
                      radius="md"
                      p="sm"
                      style={{
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease, border-color 0.1s ease',
                      }}
                      onClick={() => handleSelectItem(item)}
                    >
                      <Group justify="space-between" align="center">
                        <Stack gap={2} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Text fw={600} size="sm">
                              {item.name}
                            </Text>
                            {item.brand_name && (
                              <Badge size="xs" variant="outline" color="indigo">
                                {item.brand_name}
                              </Badge>
                            )}
                            <Badge size="xs" variant="light" color="gray">
                              {item.category_name || 'General'}
                            </Badge>
                          </Group>
                          <Group gap="sm">
                            <Text size="xs" c="dimmed">
                              SKU: <span style={{ fontFamily: 'monospace' }}>{item.sku}</span>
                            </Text>
                            {item.barcode && (
                              <Text size="xs" c="teal.7">
                                Barcode: <span style={{ fontFamily: 'monospace' }}>{item.barcode}</span>
                              </Text>
                            )}
                            {item.hsn_code && (
                              <Text size="xs" c="dimmed">
                                HSN: {item.hsn_code}
                              </Text>
                            )}
                            <Text size="xs" c="dimmed">
                              Tax: {item.tax_slab}% GST
                            </Text>
                            <Text size="xs" c="dimmed">
                              UOM: {item.uom}
                            </Text>
                          </Group>
                        </Stack>

                        <Group gap="sm">
                          {item.suggested_mrp && (
                            <Stack gap={0} align="flex-end">
                              <Text size="xs" c="dimmed">
                                Suggested MRP
                              </Text>
                              <Text fw={700} size="sm" c="emerald.7">
                                ₹{Number(item.suggested_mrp).toFixed(2)}
                              </Text>
                            </Stack>
                          )}
                          <Button
                            size="xs"
                            variant="light"
                            color="indigo"
                            rightSection={<IconArrowRight size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectItem(item);
                            }}
                          >
                            Adopt
                          </Button>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </ScrollArea.Autosize>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
