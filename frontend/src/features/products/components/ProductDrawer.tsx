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
  Modal,
} from '@mantine/core';
import {
  IconPackage,
  IconBarcode,
  IconSparkles,
  IconAlertCircle,
  IconPercentage,
  IconCash,
  IconFolderPlus,
  IconEye,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import {
  useCategories,
  useOrganizationCategories,
  useBrands,
  useCreateProduct,
  useUpdateProduct,
  useSubcategories,
  useCreateSubcategory,
} from '../api';
import { useOrganizations } from '../../organizations/api';
import type { CreateProductPayload, Product, UnitOfMeasure } from '../types';

interface ProductDrawerProps {
  opened: boolean;
  onClose: () => void;
  product: Product | null;
  defaultOrgId?: string;
  isReadOnly?: boolean;
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
  isReadOnly?: boolean;
  onClose: () => void;
}

function ProductDrawerForm({
  product,
  defaultOrgId,
  organizations,
  isReadOnly = false,
  onClose,
}: ProductDrawerFormProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    product?.organization_id || defaultOrgId || organizations?.[0]?.id || ''
  );

  const { data: orgCategories, isLoading: orgCatsLoading } = useOrganizationCategories(selectedOrgId || undefined);
  const { data: platformCategories, isLoading: platformCatsLoading } = useCategories(undefined, selectedOrgId || undefined);

  const mappedCategories = useMemo(() => {
    if (orgCategories && orgCategories.length > 0) {
      return orgCategories
        .filter((oc) => oc.is_active && oc.category)
        .map((oc) => ({
          id: oc.category.id,
          name: oc.category.name,
        }));
    }
    if (platformCategories && platformCategories.length > 0) {
      return platformCategories
        .filter((c) => c.is_active)
        .map((c) => ({
          id: c.id,
          name: c.name,
        }));
    }
    return [];
  }, [orgCategories, platformCategories]);

  const { data: brands } = useBrands(selectedOrgId || undefined);

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const createSubMutation = useCreateSubcategory();

  // Form State
  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [categoryId, setCategoryId] = useState<string | null>(product?.category_id || null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(product?.subcategory_id || null);
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

  // Subcategories query scoped to selected org and category
  const { data: subcategories } = useSubcategories(
    selectedOrgId && categoryId ? { organization_id: selectedOrgId, category_id: categoryId } : undefined
  );

  // Inline Subcategory Creation Modal State
  const [newSubModalOpen, setNewSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubSlug, setNewSubSlug] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [subError, setSubError] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Category selection and auto-populate defaults
  const handleCategoryChange = (val: string | null) => {
    setCategoryId(val);
    setSubcategoryId(null); // Reset subcategory when parent category changes
    if (val) {
      const selected =
        orgCategories?.find((oc) => oc.category?.id === val)?.category ||
        platformCategories?.find((c) => c.id === val);
      if (selected) {
        if (selected.default_hsn_code) setHsnCode(selected.default_hsn_code);
        if (selected.default_tax_slab !== null && selected.default_tax_slab !== undefined) {
          setTaxSlab(Number(selected.default_tax_slab));
        }
      }
    }
  };

  // Quick Inline Subcategory creation
  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubError(null);
    if (!newSubName.trim() || !selectedOrgId || !categoryId) {
      setSubError('Subcategory name is required.');
      return;
    }

    try {
      const created = await createSubMutation.mutateAsync({
        organization_id: selectedOrgId,
        category_id: categoryId,
        name: newSubName.trim(),
        slug: newSubSlug.trim() || undefined,
        description: newSubDesc.trim() || undefined,
      });
      setSubcategoryId(created.id);
      setNewSubModalOpen(false);
      setNewSubName('');
      setNewSubSlug('');
      setNewSubDesc('');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: Record<string, string | string[]> } };
      if (errObj.response?.data) {
        const details = Object.entries(errObj.response.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join(' | ');
        setSubError(details);
      } else {
        setSubError('Failed to create subcategory.');
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
    if (isReadOnly) return;
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
      subcategory_id: subcategoryId || null,
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
        {isReadOnly && (
          <Alert icon={<IconEye size={16} />} title="Store Staff Read-Only Access" color="teal" radius="md">
            Product catalog records are centrally managed by Organization Admins. Store personnel have view-only access for inventory lookups and thermal sticker printing.
          </Alert>
        )}

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
          disabled={!!product || isReadOnly}
        />

        {/* Basic Identifiers */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Product Title"
            placeholder="e.g. Amul Butter 500g"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            disabled={isReadOnly}
          />

          <TextInput
            label="SKU Code"
            placeholder="e.g. SKU-AMUL-500"
            required
            value={sku}
            onChange={(e) => setSku(e.currentTarget.value)}
            disabled={isReadOnly}
            rightSection={
              !isReadOnly ? (
                <Tooltip label="Auto-generate SKU from name">
                  <ActionIcon variant="subtle" size="sm" onClick={handleGenerateSku}>
                    <IconSparkles size={14} />
                  </ActionIcon>
                </Tooltip>
              ) : null
            }
          />
        </SimpleGrid>

        {/* Category & Brand Selectors */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label="Category (Platform Master)"
            placeholder={
              orgCatsLoading || platformCatsLoading
                ? 'Loading categories...'
                : mappedCategories.length === 0
                ? 'No categories mapped to this organization'
                : 'Select category mapped to org'
            }
            data={mappedCategories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={handleCategoryChange}
            clearable={!isReadOnly}
            searchable
            disabled={isReadOnly}
            nothingFoundMessage="No categories found"
          />

          <Select
            label="Brand"
            placeholder={brands?.length ? 'Select brand' : 'No brands created for this org'}
            data={brands?.map((b) => ({ value: b.id, label: b.name })) || []}
            value={brandId}
            onChange={setBrandId}
            clearable={!isReadOnly}
            searchable
            disabled={isReadOnly}
          />
        </SimpleGrid>

        {/* Subcategory (Org-Defined) with Inline Creator */}
        <Box>
          <Group justify="space-between" mb={4}>
            <Text component="label" size="sm" fw={500}>
              Subcategory (Org-Defined)
            </Text>
            {!isReadOnly && categoryId && (
              <Button
                variant="subtle"
                size="compact-xs"
                color="brand"
                leftSection={<IconFolderPlus size={14} />}
                onClick={() => setNewSubModalOpen(true)}
              >
                + New Subcategory
              </Button>
            )}
          </Group>
          <Select
            placeholder={
              !categoryId
                ? 'Select a platform category first'
                : subcategories?.length
                ? 'Select subcategory (e.g. Jeans, Juices)'
                : 'No subcategories yet — click + New Subcategory'
            }
            data={subcategories?.map((s) => ({ value: s.id, label: s.name })) || []}
            value={subcategoryId}
            onChange={setSubcategoryId}
            disabled={isReadOnly || !categoryId}
            clearable={!isReadOnly}
            searchable
          />
        </Box>

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
            disabled={isReadOnly}
          />

          <TextInput
            label="Internal Store Sticker Barcode"
            description="In-store generated thermal barcode sticker"
            placeholder="e.g. STK-998811"
            value={internalBarcode}
            onChange={(e) => setInternalBarcode(e.currentTarget.value)}
            disabled={isReadOnly}
            rightSection={
              !isReadOnly ? (
                <Tooltip label="Generate random sticker barcode">
                  <ActionIcon variant="light" size="sm" color="brand" onClick={handleGenerateInternalBarcode}>
                    <IconSparkles size={14} />
                  </ActionIcon>
                </Tooltip>
              ) : null
            }
          />
        </SimpleGrid>

        <Divider label="Tax & Commercial Pricing" labelPosition="left" />

        {/* Financials & GST Tax Slabs */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <NumberInput
            label="Cost Price (₹)"
            description="Wholesale purchase rate"
            min={0}
            decimalScale={2}
            fixedDecimalScale
            value={costPrice}
            onChange={(val) => setCostPrice(val || 0)}
            leftSection={<IconCash size={16} />}
            disabled={isReadOnly}
          />

          <NumberInput
            label="Base MRP (₹)"
            description="Maximum Retail Price"
            min={0}
            decimalScale={2}
            fixedDecimalScale
            value={baseMrp}
            onChange={(val) => setBaseMrp(val || 0)}
            leftSection={<IconCash size={16} />}
            disabled={isReadOnly}
          />

          <Box>
            <Text size="sm" fw={500} mb={4}>
              Gross Margin %
            </Text>
            <Badge
              size="xl"
              radius="md"
              variant="light"
              color={Number(marginPercentage) >= 20 ? 'teal' : Number(marginPercentage) > 0 ? 'yellow' : 'red'}
              style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <IconPercentage size={16} style={{ marginRight: '6px' }} />
              {marginPercentage}% Margin
            </Badge>
          </Box>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Select
            label="GST Tax Slab (%)"
            description="Applicable GST rate"
            data={TAX_SLABS.map((slab) => ({ value: String(slab), label: `${slab}% GST` }))}
            value={String(taxSlab)}
            onChange={(val) => setTaxSlab(Number(val) || 0)}
            disabled={isReadOnly}
          />

          <TextInput
            label="HSN Code"
            description="Harmonized System of Nomenclature"
            placeholder="e.g. 0401"
            value={hsnCode}
            onChange={(e) => setHsnCode(e.currentTarget.value)}
            disabled={isReadOnly}
          />

          <Select
            label="Unit of Measure (UOM)"
            description="Inventory counting unit"
            data={UOM_OPTIONS}
            value={uom}
            onChange={(val) => setUom((val as UnitOfMeasure) || 'PCS')}
            disabled={isReadOnly}
          />
        </SimpleGrid>

        <Divider label="Inventory & Logistics Attributes" labelPosition="left" />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <NumberInput
            label="Low Stock Alert Threshold"
            description="Minimum units before low-stock warning"
            min={0}
            value={lowStockThreshold}
            onChange={(val) => setLowStockThreshold(val || 0)}
            disabled={isReadOnly}
          />

          <Box />
        </SimpleGrid>

        {/* Item Flags */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Switch
            label="Perishable"
            checked={isPerishable}
            onChange={(e) => setIsPerishable(e.currentTarget.checked)}
            disabled={isReadOnly}
          />
          <Switch
            label="Has Expiry"
            checked={hasExpiry}
            onChange={(e) => setHasExpiry(e.currentTarget.checked)}
            disabled={isReadOnly}
          />
          <Switch
            label="Returnable"
            checked={isReturnable}
            onChange={(e) => setIsReturnable(e.currentTarget.checked)}
            disabled={isReadOnly}
          />
          <Switch
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
            disabled={isReadOnly}
          />
        </SimpleGrid>

        <Textarea
          label="Product Description / Specs"
          placeholder="Ingredient list, shelf-life instructions, dimensions..."
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          disabled={isReadOnly}
        />

        {/* Actions */}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose} disabled={isSaving}>
            {isReadOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isReadOnly && (
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
          )}
        </Group>
      </Stack>

      {/* Inline Modal for quick Subcategory creation */}
      <Modal
        opened={newSubModalOpen}
        onClose={() => setNewSubModalOpen(false)}
        title={
          <Group gap="xs">
            <IconFolderPlus size={20} color="var(--brand-primary)" />
            <Text fw={700}>Add Custom Subcategory</Text>
          </Group>
        }
        centered
        radius="md"
      >
        <Stack gap="sm">
          {subError && (
            <Alert icon={<IconAlertCircle size={16} />} title="Notice" color="red" radius="md">
              {subError}
            </Alert>
          )}

          <Text size="xs" c="dimmed">
            Organization-defined subcategory under{' '}
            <Text component="span" fw={700} c="brand">
              {mappedCategories.find((c) => c.id === categoryId)?.name || 'selected category'}
            </Text>
          </Text>

          <TextInput
            label="Subcategory Name"
            placeholder="e.g. Jeans, T-Shirts, Packaged Milk"
            required
            value={newSubName}
            onChange={(e) => setNewSubName(e.currentTarget.value)}
            autoFocus
          />

          <TextInput
            label="Slug (Optional)"
            placeholder="e.g. jeans"
            value={newSubSlug}
            onChange={(e) => setNewSubSlug(e.currentTarget.value)}
          />

          <Textarea
            label="Description (Optional)"
            placeholder="Notes on this merchandising group"
            rows={2}
            value={newSubDesc}
            onChange={(e) => setNewSubDesc(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setNewSubModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubcategory}
              loading={createSubMutation.isPending}
              style={{ background: 'var(--brand-gradient)' }}
            >
              Create Subcategory
            </Button>
          </Group>
        </Stack>
      </Modal>
    </form>
  );
}

export function ProductDrawer({
  opened,
  onClose,
  product,
  defaultOrgId,
  isReadOnly = false,
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
            <Group gap="xs" align="center">
              <Text fw={700} size="md">
                {isReadOnly
                  ? 'Product Specifications'
                  : product
                  ? 'Edit Catalog Product'
                  : 'Create Master Product'}
              </Text>
              {isReadOnly && (
                <Badge variant="light" color="teal" size="sm">
                  Store Staff View
                </Badge>
              )}
            </Group>
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
          isReadOnly={isReadOnly}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
}
