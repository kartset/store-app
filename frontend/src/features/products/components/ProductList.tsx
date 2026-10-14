import {
  Table,
  Title,
  Card,
  Text,
  Loader,
  Center,
  Badge,
  Group,
  Stack,
  TextInput,
  Button,
  SimpleGrid,
  ThemeIcon,
  Box,
  ActionIcon,
  Tooltip,
  Select,
  SegmentedControl,
  Menu,
} from '@mantine/core';
import {
  IconPackage,
  IconSearch,
  IconPlus,
  IconBarcode,
  IconPrinter,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconTags,
  IconPercentage,
  IconTrendingUp,
  IconCopy,
  IconCheck,
  IconBuildingSkyscraper,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useProducts, useCategories, useBrands, useDeleteProduct } from '../api';
import { useOrganizations } from '../../organizations/api';
import { ProductDrawer } from './ProductDrawer';
import { BarcodeStickerModal } from './BarcodeStickerModal';
import type { Product } from '../types';

export function ProductList() {
  const { data: organizations } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // Default to first org when loaded
  const activeOrgId = useMemo(() => {
    if (selectedOrgId) return selectedOrgId;
    return organizations?.[0]?.id || '';
  }, [selectedOrgId, organizations]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch products, categories, brands
  const { data: products, isLoading, error } = useProducts({
    organization_id: activeOrgId || undefined,
  });
  const { data: categories } = useCategories();
  const { data: brands } = useBrands(activeOrgId || undefined);
  const deleteMutation = useDeleteProduct();

  // Modals state
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [stickerModalOpened, setStickerModalOpened] = useState(false);
  const [stickerProduct, setStickerProduct] = useState<Product | null>(null);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filter products locally for instantaneous UI responsiveness
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((prod) => {
      // Category filter
      if (categoryFilter && prod.category_id !== categoryFilter) return false;
      // Brand filter
      if (brandFilter && prod.brand_id !== brandFilter) return false;
      // Status filter
      if (statusFilter === 'active' && !prod.is_active) return false;
      if (statusFilter === 'inactive' && prod.is_active) return false;

      // Text Search across Name, SKU, Barcode, Internal Barcode
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = prod.name?.toLowerCase().includes(q);
        const matchesSku = prod.sku?.toLowerCase().includes(q);
        const matchesBarcode = prod.barcode?.toLowerCase().includes(q);
        const matchesInternal = prod.internal_barcode?.toLowerCase().includes(q);
        const matchesHsn = prod.hsn_code?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesInternal && !matchesHsn) {
          return false;
        }
      }

      return true;
    });
  }, [products, categoryFilter, brandFilter, statusFilter, searchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    if (!products || products.length === 0) {
      return { total: 0, active: 0, avgMargin: 0, categoriesCount: 0 };
    }
    const total = products.length;
    const active = products.filter((p) => p.is_active).length;
    const margins = products
      .map((p) => {
        const mrp = Number(p.base_mrp) || 0;
        const cost = Number(p.cost_price) || 0;
        return mrp > 0 ? ((mrp - cost) / mrp) * 100 : 0;
      })
      .filter((m) => m > 0);
    const avgMargin = margins.length ? (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(1) : 0;
    const uniqueCats = new Set(products.map((p) => p.category_id).filter(Boolean)).size;

    return { total, active, avgMargin, categoriesCount: uniqueCats };
  }, [products]);

  const activeOrg = organizations?.find((o) => o.id === activeOrgId);

  return (
    <Box>
      {/* Page Header */}
      <Group justify="space-between" align="flex-end" mb="xl">
        <div>
          <Badge variant="light" color="brand" size="sm" radius="sm" mb={6}>
            Master Product Catalog
          </Badge>
          <Title order={1} fw={800} style={{ letterSpacing: '-0.02em' }}>
            Products & Barcodes
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Centralized SKU ledger, dual barcodes (manufacturer EAN & in-store sticker), pricing, and GST tax slabs.
          </Text>
        </div>

        <Group gap="sm">
          {/* Organization Tenant Switcher */}
          {organizations && organizations.length > 1 && (
            <Select
              placeholder="Organization"
              leftSection={<IconBuildingSkyscraper size={16} />}
              data={organizations.map((o) => ({ value: o.id, label: o.name }))}
              value={activeOrgId}
              onChange={(val) => setSelectedOrgId(val || '')}
              w={200}
            />
          )}

          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditingProduct(null);
              setDrawerOpened(true);
            }}
            style={{
              background: 'var(--brand-gradient)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Add Product
          </Button>
        </Group>
      </Group>

      {/* KPI Metric Cards */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md" mb="xl">
        {/* Total Products */}
        <Card
          p="lg"
          radius="lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Master Products
            </Text>
            <ThemeIcon size={34} radius="md" color="brand" variant="light">
              <IconPackage size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1}>
            {stats.total}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Across {stats.categoriesCount} active categories
          </Text>
        </Card>

        {/* Active SKUs */}
        <Card
          p="lg"
          radius="lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Active on POS
            </Text>
            <ThemeIcon size={34} radius="md" color="teal" variant="light">
              <IconBarcode size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1} c="teal">
            {stats.active}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% available for billing
          </Text>
        </Card>

        {/* Average Gross Margin */}
        <Card
          p="lg"
          radius="lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Est. Gross Margin
            </Text>
            <ThemeIcon size={34} radius="md" color="indigo" variant="light">
              <IconTrendingUp size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1} c="indigo">
            {stats.avgMargin}%
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Weighted selling spread
          </Text>
        </Card>

        {/* GST Tax Compliance */}
        <Card
          p="lg"
          radius="lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Tax Classified
            </Text>
            <ThemeIcon size={34} radius="md" color="violet" variant="light">
              <IconPercentage size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1} c="violet">
            100%
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Automated GST slab & HSN tagging
          </Text>
        </Card>
      </SimpleGrid>

      {/* Filter & Live Search Toolbar */}
      <Card
        p="md"
        radius="lg"
        mb="lg"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
          {/* Live Search */}
          <TextInput
            placeholder="Search by Name, SKU, Barcode, HSN..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />

          {/* Category Filter */}
          <Select
            placeholder="All Categories"
            leftSection={<IconTags size={16} />}
            data={categories?.map((c) => ({ value: c.id, label: c.name })) || []}
            value={categoryFilter}
            onChange={setCategoryFilter}
            clearable
            searchable
          />

          {/* Brand Filter */}
          <Select
            placeholder="All Brands"
            data={brands?.map((b) => ({ value: b.id, label: b.name })) || []}
            value={brandFilter}
            onChange={setBrandFilter}
            clearable
            searchable
          />

          {/* Active / Inactive Status */}
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
          />
        </SimpleGrid>
      </Card>

      {/* Product Master Data Table */}
      <Card
        p={0}
        radius="lg"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        {isLoading ? (
          <Center h={320}>
            <Group gap="md">
              <Loader size="md" color="brand" />
              <Text size="sm" c="dimmed" fw={600}>
                Synchronizing product catalog...
              </Text>
            </Group>
          </Center>
        ) : error ? (
          <Center h={200} p="xl">
            <Text c="red" fw={600}>
              Failed to load product catalog. Please verify backend service status.
            </Text>
          </Center>
        ) : filteredProducts.length === 0 ? (
          <Center h={280} p="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                <IconPackage size={24} />
              </ThemeIcon>
              <Text fw={700} size="md">
                No products found
              </Text>
              <Text size="xs" c="dimmed" ta="center" maw={320}>
                {searchQuery || categoryFilter || brandFilter
                  ? 'No products matched your search or filters. Try clearing your search parameters.'
                  : 'Get started by creating your first catalog product with barcodes and pricing.'}
              </Text>
              <Button
                size="xs"
                variant="light"
                color="brand"
                mt="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setEditingProduct(null);
                  setDrawerOpened(true);
                }}
              >
                Add Product
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
              <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                <Table.Tr>
                  <Table.Th style={{ width: '280px' }}>Product & SKU</Table.Th>
                  <Table.Th>Category / Brand</Table.Th>
                  <Table.Th>Barcodes (EAN / Sticker)</Table.Th>
                  <Table.Th>Cost & MRP</Table.Th>
                  <Table.Th>Tax Slab</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {filteredProducts.map((prod) => {
                  const cost = Number(prod.cost_price) || 0;
                  const mrp = Number(prod.base_mrp) || 0;
                  const margin = mrp > 0 ? (((mrp - cost) / mrp) * 100).toFixed(0) : '0';

                  return (
                    <Table.Tr key={prod.id}>
                      {/* Product Name & SKU */}
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon size={34} radius="md" color="brand" variant="light">
                            <IconPackage size={18} />
                          </ThemeIcon>
                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" fw={700} lineClamp={1}>
                              {prod.name}
                            </Text>
                            <Group gap={6} mt={2}>
                              <Badge size="xs" variant="outline" color="gray" radius="sm">
                                {prod.sku}
                              </Badge>
                              {prod.is_perishable && (
                                <Badge size="xs" color="orange" variant="light">
                                  Perishable
                                </Badge>
                              )}
                              <Text size="11px" c="dimmed">
                                {prod.uom}
                              </Text>
                            </Group>
                          </Box>
                        </Group>
                      </Table.Td>

                      {/* Category & Brand */}
                      <Table.Td>
                        <Stack gap={2}>
                          {prod.category?.name ? (
                            <Badge size="xs" color="indigo" variant="light">
                              {prod.category.name}
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Uncategorized
                            </Text>
                          )}
                          {prod.brand?.name && (
                            <Text size="11px" fw={600} c="dimmed">
                              Brand: {prod.brand.name}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* Barcodes */}
                      <Table.Td>
                        <Stack gap={4}>
                          {prod.barcode ? (
                            <Group gap={4}>
                              <Tooltip label="Global Manufacturer EAN-13">
                                <Badge size="xs" color="blue" variant="dot">
                                  {prod.barcode}
                                </Badge>
                              </Tooltip>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                onClick={() => handleCopy(prod.barcode!)}
                              >
                                {copiedCode === prod.barcode ? <IconCheck size={12} color="teal" /> : <IconCopy size={12} />}
                              </ActionIcon>
                            </Group>
                          ) : null}

                          {prod.internal_barcode ? (
                            <Group gap={4}>
                              <Tooltip label="In-Store Sticker Barcode">
                                <Badge size="xs" color="violet" variant="outline">
                                  {prod.internal_barcode}
                                </Badge>
                              </Tooltip>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                onClick={() => handleCopy(prod.internal_barcode!)}
                              >
                                {copiedCode === prod.internal_barcode ? <IconCheck size={12} color="teal" /> : <IconCopy size={12} />}
                              </ActionIcon>
                            </Group>
                          ) : null}

                          {!prod.barcode && !prod.internal_barcode && (
                            <Text size="xs" c="dimmed">
                              No barcode set
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* Cost & MRP */}
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={800}>
                            ₹{mrp.toFixed(2)}
                          </Text>
                          <Group gap={6} mt={2}>
                            <Text size="11px" c="dimmed">
                              Cost: ₹{cost.toFixed(2)}
                            </Text>
                            <Badge size="xs" color={Number(margin) >= 20 ? 'teal' : 'gray'} variant="light">
                              {margin}% margin
                            </Badge>
                          </Group>
                        </div>
                      </Table.Td>

                      {/* Tax Slab */}
                      <Table.Td>
                        <div>
                          <Badge size="sm" color="cyan" variant="light">
                            {Number(prod.tax_slab)}% GST
                          </Badge>
                          {prod.hsn_code && (
                            <Text size="10px" c="dimmed" mt={2}>
                              HSN: {prod.hsn_code}
                            </Text>
                          )}
                        </div>
                      </Table.Td>

                      {/* Status */}
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="dot"
                          color={prod.is_active ? 'teal' : 'gray'}
                        >
                          {prod.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </Table.Td>

                      {/* Actions */}
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Group gap="xs" justify="flex-end">
                          <Tooltip label="Print Thermal Barcode Sticker">
                            <ActionIcon
                              variant="light"
                              color="brand"
                              size="sm"
                              onClick={() => {
                                setStickerProduct(prod);
                                setStickerModalOpened(true);
                              }}
                            >
                              <IconPrinter size={16} />
                            </ActionIcon>
                          </Tooltip>

                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" size="sm">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconEdit size={14} />}
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setDrawerOpened(true);
                                }}
                              >
                                Edit Product
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconPrinter size={14} />}
                                onClick={() => {
                                  setStickerProduct(prod);
                                  setStickerModalOpened(true);
                                }}
                              >
                                Print Barcode Sticker
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete '${prod.name}'?`)) {
                                    deleteMutation.mutate(prod.id);
                                  }
                                }}
                              >
                                Delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Product Drawer */}
      <ProductDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        product={editingProduct}
        defaultOrgId={activeOrgId}
      />

      {/* Barcode Thermal Sticker Modal */}
      <BarcodeStickerModal
        opened={stickerModalOpened}
        onClose={() => setStickerModalOpened(false)}
        product={stickerProduct}
        storeName={activeOrg?.name || 'STORE MASTER'}
      />
    </Box>
  );
}
