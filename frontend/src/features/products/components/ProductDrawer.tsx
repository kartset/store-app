import {
  Drawer,
  Button,
  Group,
  Stack,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Switch,
  SimpleGrid,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Alert,
  Box,
  Divider,
} from '@mantine/core';
import {
  IconPackage,
  IconBarcode,
  IconSparkles,
  IconAlertCircle,
  IconPercentage,
  IconCash,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useCategories, useBrands, useCreateProduct, useUpdateProduct } from '../api';
import { useOrganizations } from '../../organizations/api';
import type { CreateProductPayload, Product, UnitOfMeasure } from '../types';

interface ProductDrawerProps {
  opened: boolean;
  onClose: () => void;
  product: Product | null;
  defaultOrgId?: string;
}

const UOM_OPTIONS: { value: UnitOfMeasure; label: string }[] = [
  { value: 'PCS', label: 'Pieces (PCS)' },
  { value: 'KG', label: 'Kilograms (KG)' },
  { value: 'G', label: 'Grams (G)' },
  { value: 'LITRE', label: 'Litres (LITRE)' },
  { value: 'ML', label: 'Millilitres (ML)' },
  { value: 'BOX', label: 'Box' },
  { value: 'PACKET', label: 'Packet' },
  { value: 'METER', label: 'Meters' },
];

const TAX_SLABS = [0, 5, 12, 18, 28];

interface ProductDrawerFormProps {
  product: Product | null;
  defaultOrgId?: string;
  organizations?: { id: string; name: string }[];
  onClose: () => void;
}

function ProductDrawerForm({
  product,
  defaultOrgId,
  organizations,
  onClose,
}: ProductDrawerFormProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    product?.organization_id || defaultOrgId || organizations?.[0]?.id || ''
  );

  const { data: categories } = useCategories();
  const { data: brands } = useBrands(selectedOrgId || undefined);

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  // Initialized directly from props without effect
  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [categoryId, setCategoryId] = useState<string | null>(product?.category_id || null);
  const [brandId, setBrandId] = useState<string | null>(product?.brand_id || null);
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [internalBarcode, setInternalBarcode] = useState(product?.internal_barcode || '');
  const [hsnCode, setHsnCode] = useState(product?.hsn_code || '');
  const [taxSlab, setTaxSlab] = useState<number | string>(product ? Number(product.tax_slab) : 18);
  const [costPrice, setCostPrice] = useState<number | string>(product ? Number(product.cost_price) : 0);
  const [baseMrp, setBaseMrp] = useState<number | string>(product ? Number(product.base_mrp) : 0);
  const [uom, setUom] = useState<UnitOfMeasure>(product?.uom || 'PCS');
  const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(product?.low_stock_threshold ?? 10);
  const [description, setDescription] = useState(product?.description || '');
  const [isPerishable, setIsPerishable] = useState(product?.is_perishable ?? false);
  const [hasExpiry, setHasExpiry] = useState(product?.has_expiry ?? false);
  const [isReturnable, setIsReturnable] = useState(product?.is_returnable ?? true);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Category selection and auto-populate defaults
  const handleCategoryChange = (val: string | null) => {
    setCategoryId(val);
    if (val && categories) {
      const selected = categories.find((c) => c.id === val);
      if (selected) {
        if (selected.default_hsn_code) setHsnCode(selected.default_hsn_code);
        if (selected.default_tax_slab !== null && selected.default_tax_slab !== undefined) {
          setTaxSlab(Number(selected.default_tax_slab));
        }
      }
    }
  };

  // Generate unique in-store barcode sticker code
  const handleGenerateInternalBarcode = () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    setInternalBarcode(`STK-${randomSuffix}`);
  };

  // Generate auto SKU based on name
  const handleGenerateSku = () => {
    if (!name.trim()) return;
    const prefix = name
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase())
      .join('')
      .slice(0, 4);
    const num = Math.floor(1000 + Math.random() * 9000);
    setSku(`SKU-${prefix}-${num}`);
  };

  // Calculate gross margin %
  const marginPercentage = useMemo(() => {
    const cost = Number(costPrice) || 0;
    const mrp = Number(baseMrp) || 0;
    if (mrp <= 0) return 0;
    return (((mrp - cost) / mrp) * 100).toFixed(1);
  }, [costPrice, baseMrp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedOrgId) {
      setErrorMessage('Please select an organization.');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Product Name is required.');
      return;
    }
    if (!sku.trim()) {
      setErrorMessage('Product SKU is required.');
      return;
    }

    const payload: CreateProductPayload = {
      organization_id: selectedOrgId,
      category_id: categoryId || null,
      brand_id: brandId || null,
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim() || null,
      internal_barcode: internalBarcode.trim() || null,
      hsn_code: hsnCode.trim() || null,
      tax_slab: Number(taxSlab) || 0,
      cost_price: Number(costPrice) || 0,
      base_mrp: Number(baseMrp) || 0,
      uom,
      low_stock_threshold: Number(lowStockThreshold) || 10,
      description: description.trim() || null,
      is_perishable: isPerishable,
      has_expiry: hasExpiry,
      is_returnable: isReturnable,
      is_active: isActive,
    };

    try {
      if (product) {
        await updateMutation.mutateAsync({ id: product.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: Record<string, string | string[]> } };
      if (errObj.response?.data) {
        const details = Object.entries(errObj.response.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join(' | ');
        setErrorMessage(details);
      } else {
        setErrorMessage('Failed to save product. Please verify connectivity.');
      }
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md" pt="sm">
        {errorMessage && (
          <Alert icon={<IconAlertCircle size={16} />} title="Validation Notice" color="red" radius="md">
            {errorMessage}
          </Alert>
        )}

        {/* Organization Selection */}
        <Select
          label="Organization Tenant"
          placeholder="Select owning organization"
          required
          data={organizations?.map((o) => ({ value: o.id, label: o.name })) || []}
          value={selectedOrgId}
          onChange={(val) => setSelectedOrgId(val || '')}
          disabled={!!product}
        />

        {/* Basic Identifiers */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Product Title"
            placeholder="e.g. Amul Butter 500g"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          <TextInput
            label="SKU Code"
            placeholder="e.g. SKU-AMUL-500"
            required
            value={sku}
            onChange={(e) => setSku(e.currentTarget.value)}
            rightSection={
              <Tooltip label="Auto-generate SKU from name">
                <ActionIcon variant="subtle" size="sm" onClick={handleGenerateSku}>
                  <IconSparkles size={14} />
                </ActionIcon>
              </Tooltip>
            }
          />
        </SimpleGrid>

        {/* Category & Brand Selectors */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label="Product Category"
            placeholder="Select category"
            data={categories?.map((c) => ({ value: c.id, label: c.name })) || []}
            value={categoryId}
            onChange={handleCategoryChange}
            clearable
            searchable
          />

          <Select
            label="Brand"
            placeholder={brands?.length ? 'Select brand' : 'No brands created for this org'}
            data={brands?.map((b) => ({ value: b.id, label: b.name })) || []}
            value={brandId}
            onChange={setBrandId}
            clearable
            searchable
          />
        </SimpleGrid>

        <Divider label="Dual Barcode Architecture" labelPosition="left" />

        {/* Barcode Dual Configuration */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Manufacturer Barcode (Global)"
            description="EAN-13, UPC from manufacturer packaging"
            placeholder="e.g. 8901262010099"
            value={barcode}
            onChange={(e) => setBarcode(e.currentTarget.value)}
            leftSection={<IconBarcode size={16} />}
          />

          <TextInput
            label="In-Store Sticker Barcode"
            description="Custom sticker barcode for POS scanning"
            placeholder="e.g. STK-554433"
            value={internalBarcode}
            onChange={(e) => setInternalBarcode(e.currentTarget.value)}
            leftSection={<IconBarcode size={16} />}
            rightSection={
              <Tooltip label="Generate new in-store sticker barcode">
                <ActionIcon variant="light" color="brand" size="sm" onClick={handleGenerateInternalBarcode}>
                  <IconSparkles size={14} />
                </ActionIcon>
              </Tooltip>
            }
          />
        </SimpleGrid>

        <Divider label="Valuation & Taxation" labelPosition="left" />

        {/* Pricing, Cost, Tax Slab */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <NumberInput
            label="Cost Price (₹)"
            description="Purchase / wholesale cost"
            value={costPrice}
            onChange={setCostPrice}
            min={0}
            decimalScale={2}
            leftSection={<IconCash size={16} />}
          />

          <NumberInput
            label="Maximum Retail Price (₹)"
            description="Standard selling MRP"
            value={baseMrp}
            onChange={setBaseMrp}
            min={0}
            decimalScale={2}
            required
            leftSection={<IconCash size={16} />}
          />

          <Box>
            <Text size="xs" fw={500} mb={4}>
              Gross Margin Indicator
            </Text>
            <Badge
              size="lg"
              variant="light"
              color={Number(marginPercentage) >= 20 ? 'teal' : Number(marginPercentage) > 0 ? 'orange' : 'gray'}
              h={36}
              fullWidth
            >
              {marginPercentage}% Est. Margin
            </Badge>
          </Box>
        </SimpleGrid>

        {/* Tax Slabs & HSN */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <div>
            <NumberInput
              label="GST Tax Slab (%)"
              value={taxSlab}
              onChange={setTaxSlab}
              min={0}
              max={100}
              decimalScale={2}
              leftSection={<IconPercentage size={16} />}
            />
            <Group gap={4} mt={6}>
              {TAX_SLABS.map((rate) => (
                <Button
                  key={rate}
                  size="compact-xs"
                  variant={taxSlab === rate ? 'filled' : 'light'}
                  color="brand"
                  onClick={() => setTaxSlab(rate)}
                >
                  {rate}%
                </Button>
              ))}
            </Group>
          </div>

          <TextInput
            label="HSN / SAC Code"
            description="Harmonized System of Nomenclature"
            placeholder="e.g. 0401"
            value={hsnCode}
            onChange={(e) => setHsnCode(e.currentTarget.value)}
          />
        </SimpleGrid>

        <Divider label="Inventory & Fulfillment" labelPosition="left" />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label="Unit of Measure (UOM)"
            data={UOM_OPTIONS}
            value={uom}
            onChange={(val) => setUom(val as UnitOfMeasure)}
            required
          />

          <NumberInput
            label="Low Stock Alert Threshold"
            description="Triggers replenishment warnings"
            value={lowStockThreshold}
            onChange={setLowStockThreshold}
            min={1}
          />
        </SimpleGrid>

        {/* Toggles */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Switch
            label="Perishable"
            checked={isPerishable}
            onChange={(e) => setIsPerishable(e.currentTarget.checked)}
          />
          <Switch
            label="Has Expiry"
            checked={hasExpiry}
            onChange={(e) => setHasExpiry(e.currentTarget.checked)}
          />
          <Switch
            label="Returnable"
            checked={isReturnable}
            onChange={(e) => setIsReturnable(e.currentTarget.checked)}
          />
          <Switch
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
        </SimpleGrid>

        <Textarea
          label="Product Description / Specs"
          placeholder="Ingredient list, shelf-life instructions, dimensions..."
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />

        {/* Actions */}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSaving}
            style={{
              background: 'var(--brand-gradient)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {product ? 'Save Changes' : 'Create Product'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function ProductDrawer({
  opened,
  onClose,
  product,
  defaultOrgId,
}: ProductDrawerProps) {
  const { data: organizations } = useOrganizations();

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group gap="xs">
          <IconPackage size={22} color="var(--brand-primary)" />
          <div>
            <Text fw={700} size="md">
              {product ? 'Edit Catalog Product' : 'Create Master Product'}
            </Text>
            <Text size="xs" c="dimmed">
              Organization Master Catalog Entry
            </Text>
          </div>
        </Group>
      }
      styles={{
        header: { borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' },
      }}
    >
      {opened && (
        <ProductDrawerForm
          key={product?.id || 'new'}
          product={product}
          defaultOrgId={defaultOrgId}
          organizations={organizations}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
}
