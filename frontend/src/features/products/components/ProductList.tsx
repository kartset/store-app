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
  IconEye,
  IconCategory,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import {
  useProducts,
  useCategories,
  useBrands,
  useSubcategories,
  useDeleteProduct,
} from '../api';
import { useOrganizations } from '../../organizations/api';
import { ProductDrawer } from './ProductDrawer';
import { BarcodeStickerModal } from './BarcodeStickerModal';
import type { Product } from '../types';

export function ProductList() {
  const { data: organizations } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // Read authenticated user & active store role from localStorage
  const user = useMemo(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const currentStore = useMemo(() => {
    try {
      const stored = localStorage.getItem('current_store');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Determine if current user has Org Admin rights
  const isOrgAdmin = useMemo(() => {
    if (user?.is_org_admin) return true;
    if (currentStore?.role === 'ORG_ADMIN') return true;
    if (user?.organizations?.some((o: { role?: string }) => o.role === 'ORG_ADMIN')) return true;
    return false;
  }, [user, currentStore]);

  // Default to user's current store organization or first org
  const activeOrgId = useMemo(() => {
    if (selectedOrgId) return selectedOrgId;
    if (currentStore?.organization_id) return currentStore.organization_id;
    if (user?.organizations?.[0]?.id) return user.organizations[0].id;
    return organizations?.[0]?.id || '';
  }, [selectedOrgId, currentStore, user, organizations]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch products, categories, subcategories, brands
  const { data: products, isLoading, error } = useProducts({
    organization_id: activeOrgId || undefined,
  });
  const { data: categories } = useCategories();
  const { data: subcategories } = useSubcategories(
    activeOrgId ? { organization_id: activeOrgId, category_id: categoryFilter || undefined } : undefined
  );
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

  // Reset subcategory filter when category filter changes
  const handleCategoryFilterChange = (val: string | null) => {
    setCategoryFilter(val);
    setSubcategoryFilter(null);
  };

  // Filter products locally for instantaneous UI responsiveness
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((prod) => {
      // Category filter
      if (categoryFilter && prod.category_id !== categoryFilter) return false;
      // Subcategory filter
      if (subcategoryFilter && prod.subcategory_id !== subcategoryFilter) return false;
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
        const matchesSub = prod.subcategory?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesInternal && !matchesHsn && !matchesSub) {
          return false;
        }
      }

      return true;
    });
  }, [products, categoryFilter, subcategoryFilter, brandFilter, statusFilter, searchQuery]);

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
          <Group gap="xs" mb={6}>
            <Badge variant="light" color="brand" size="sm" radius="sm">
              Master Product Catalog
            </Badge>
            {isOrgAdmin ? (
              <Badge variant="gradient" gradient={{ from: 'indigo', to: 'violet' }} size="sm" radius="sm">
                HQ Merchandising Governance
              </Badge>
            ) : (
              <Badge variant="light" color="teal" size="sm" radius="sm">
                Store Staff (Read Only)
              </Badge>
            )}
          </Group>
          <Title order={1} fw={800} style={{ letterSpacing: '-0.02em' }}>
            Products & Barcodes
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Centralized SKU ledger, platform categories, org subcategories, dual barcodes, and GST tax slabs.
          </Text>
        </div>

        <Group gap="sm">
          {/* Organization Tenant Switcher (Only if user is Org Admin and multiple orgs exist) */}
          {organizations && organizations.length > 1 && isOrgAdmin && (
            <Select
              placeholder="Organization"
              leftSection={<IconBuildingSkyscraper size={16} />}
              data={organizations.map((o) => ({ value: o.id, label: o.name }))}
              value={activeOrgId}
              onChange={(val) => setSelectedOrgId(val || '')}
              w={200}
            />
          )}

          {isOrgAdmin ? (
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
          ) : (
            <Tooltip label="Only Org Admins can add or delete master catalog products. Store personnel have inventory & barcode lookup rights.">
              <Badge
                size="lg"
                radius="md"
                variant="light"
                color="teal"
                leftSection={<IconEye size={14} />}
                style={{ padding: '8px 14px' }}
              >
                Store Staff View
              </Badge>
            </Tooltip>
          )}
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
            {stats.active} items active in catalog
          </Text>
        </Card>

        {/* Categories Covered */}
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
              Taxonomy Mix
            </Text>
            <ThemeIcon size={34} radius="md" color="teal" variant="light">
              <IconTags size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1} c="teal">
            {stats.categoriesCount}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Active Category classifications
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
              Avg Gross Margin
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
        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
          {/* Live Search */}
          <TextInput
            placeholder="Search Name, SKU, Barcode, Subcategory..."
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
            onChange={handleCategoryFilterChange}
            clearable
            searchable
          />

          {/* Subcategory Filter */}
          <Select
            placeholder={categoryFilter ? 'All Subcategories' : 'Subcategories'}
            leftSection={<IconCategory size={16} />}
            data={subcategories?.map((s) => ({ value: s.id, label: s.name })) || []}
            value={subcategoryFilter}
            onChange={setSubcategoryFilter}
            clearable
            searchable
            disabled={!categoryFilter && (!subcategories || subcategories.length === 0)}
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
          <Center py={60}>
            <Stack align="center" gap="xs">
              <Loader color="brand" size="md" />
              <Text size="sm" c="dimmed">
                Loading master products...
              </Text>
            </Stack>
          </Center>
        ) : error ? (
          <Center py={60}>
            <Text c="red" size="sm">
              Failed to load catalog products. Please check server connectivity.
            </Text>
          </Center>
        ) : filteredProducts.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                <IconPackage size={24} />
              </ThemeIcon>
              <Text fw={600} size="md">
                No products found
              </Text>
              <Text size="sm" c="dimmed" maw={360} ta="center">
                {searchQuery || categoryFilter || subcategoryFilter || brandFilter
                  ? 'No items match your active search filters.'
                  : 'Start by creating your first master product in this organization.'}
              </Text>
              {isOrgAdmin && !searchQuery && (
                <Button
                  size="xs"
                  mt="xs"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => {
                    setEditingProduct(null);
                    setDrawerOpened(true);
                  }}
                  style={{ background: 'var(--brand-gradient)' }}
                >
                  Create Product
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={950}>
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
              <Table.Thead style={{ backgroundColor: 'var(--bg-surface-hover)' }}>
                <Table.Tr>
                  <Table.Th>Product Details</Table.Th>
                  <Table.Th>Category & Subcategory</Table.Th>
                  <Table.Th>Dual Barcodes / SKU</Table.Th>
                  <Table.Th>Commercials & MRP</Table.Th>
                  <Table.Th>GST Slab</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredProducts.map((prod) => {
                  const mrp = Number(prod.base_mrp) || 0;
                  const cost = Number(prod.cost_price) || 0;
                  const margin = mrp > 0 ? (((mrp - cost) / mrp) * 100).toFixed(1) : 0;

                  return (
                    <Table.Tr key={prod.id}>
                      {/* Product Name & Brand */}
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon size={34} radius="md" color="brand" variant="light">
                            <IconPackage size={18} />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={700}>
                              {prod.name}
                            </Text>
                            <Group gap={6} mt={2}>
                              {prod.brand && (
                                <Badge size="xs" variant="outline" color="gray" radius="sm">
                                  {prod.brand.name}
                                </Badge>
                              )}
                              <Badge size="xs" variant="light" color="indigo" radius="sm">
                                {prod.uom}
                              </Badge>
                              {prod.is_perishable && (
                                <Badge size="xs" color="orange" variant="dot">
                                  Perishable
                                </Badge>
                              )}
                            </Group>
                          </div>
                        </Group>
                      </Table.Td>

                      {/* Category & Org Subcategory */}
                      <Table.Td>
                        <Stack gap={4}>
                          <Text size="sm" fw={600}>
                            {prod.category?.name || 'Uncategorized'}
                          </Text>
                          {prod.subcategory ? (
                            <Badge size="xs" variant="light" color="indigo" radius="sm" leftSection={<IconCategory size={10} />}>
                              {prod.subcategory.name}
                            </Badge>
                          ) : (
                            <Text size="11px" c="dimmed">
                              No Subcategory
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* SKU & Barcodes */}
                      <Table.Td>
                        <Stack gap={3}>
                          <Group gap={4}>
                            <Text size="xs" c="dimmed" fw={600}>
                              SKU:
                            </Text>
                            <Text size="xs" fw={700} style={{ fontFamily: 'monospace' }}>
                              {prod.sku}
                            </Text>
                            <Tooltip label={copiedCode === prod.sku ? 'Copied!' : 'Copy SKU'}>
                              <ActionIcon
                                variant="subtle"
                                size="xs"
                                color="gray"
                                onClick={() => handleCopy(prod.sku)}
                              >
                                {copiedCode === prod.sku ? <IconCheck size={12} color="green" /> : <IconCopy size={12} />}
                              </ActionIcon>
                            </Tooltip>
                          </Group>

                          {prod.barcode ? (
                            <Group gap={4}>
                              <IconBarcode size={13} color="var(--brand-primary)" />
                              <Text size="11px" fw={600} style={{ fontFamily: 'monospace' }}>
                                {prod.barcode}
                              </Text>
                              <Tooltip label={copiedCode === prod.barcode ? 'Copied!' : 'Copy EAN Barcode'}>
                                <ActionIcon
                                  variant="subtle"
                                  size="xs"
                                  color="gray"
                                  onClick={() => handleCopy(prod.barcode!)}
                                >
                                  {copiedCode === prod.barcode ? <IconCheck size={12} color="green" /> : <IconCopy size={12} />}
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          ) : (
                            <Text size="10px" c="dimmed">
                              No EAN Barcode
                            </Text>
                          )}

                          {prod.internal_barcode && (
                            <Badge size="xs" variant="outline" color="teal" radius="sm">
                              Sticker: {prod.internal_barcode}
                            </Badge>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* Commercial Pricing & Margin */}
                      <Table.Td>
                        <Stack gap={2}>
                          <Group gap={6}>
                            <Text size="sm" fw={800} c="brand">
                              ₹{Number(prod.base_mrp).toFixed(2)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              MRP
                            </Text>
                          </Group>
                          <Group gap={6}>
                            <Text size="xs" c="dimmed">
                              Cost: ₹{Number(prod.cost_price).toFixed(2)}
                            </Text>
                            <Text
                              size="xs"
                              fw={700}
                              c={Number(margin) >= 20 ? 'teal' : Number(margin) > 0 ? 'yellow' : 'red'}
                            >
                              ({margin}%)
                            </Text>
                          </Group>
                        </Stack>
                      </Table.Td>

                      {/* GST Tax Slab */}
                      <Table.Td>
                        <Stack gap={2}>
                          <Badge variant="light" color="violet" size="sm">
                            {Number(prod.tax_slab)}% GST
                          </Badge>
                          {prod.hsn_code && (
                            <Text size="10px" c="dimmed" style={{ fontFamily: 'monospace' }}>
                              HSN: {prod.hsn_code}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* Active Status */}
                      <Table.Td>
                        <Badge variant="dot" color={prod.is_active ? 'green' : 'gray'} size="sm">
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
                              {isOrgAdmin ? (
                                <>
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
                                </>
                              ) : (
                                <>
                                  <Menu.Item
                                    leftSection={<IconEye size={14} />}
                                    onClick={() => {
                                      setEditingProduct(prod);
                                      setDrawerOpened(true);
                                    }}
                                  >
                                    View Specifications
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
                                </>
                              )}
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
        isReadOnly={!isOrgAdmin}
      />

      {/* Thermal Barcode Sticker Generator Modal */}
      {stickerProduct && (
        <BarcodeStickerModal
          opened={stickerModalOpened}
          onClose={() => {
            setStickerModalOpened(false);
            setStickerProduct(null);
          }}
          product={stickerProduct}
          storeName={activeOrg?.name || 'RETAIL STORE'}
        />
      )}
    </Box>
  );
}
