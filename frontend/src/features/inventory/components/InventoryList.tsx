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
  IconBuildingWarehouse,
  IconSearch,
  IconTruckLoading,
  IconHistory,
  IconAlertTriangle,
  IconCircleCheck,
  IconCurrencyRupee,
  IconArrowsExchange,
  IconDotsVertical,
  IconBuildingStore,
  IconPackage,
  IconBarcode,
  IconPlus,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useInventory, useInventorySummary } from '../api';
import { useStores } from '../../stores/api';
import { useOrganizations } from '../../organizations/api';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { ReceiveGoodsDrawer } from './ReceiveGoodsDrawer';
import { StockMovementsDrawer } from './StockMovementsDrawer';
import type { InventoryItem } from '../types';

export function InventoryList() {
  const { data: stores } = useStores();
  const { data: organizations } = useOrganizations();

  const currentStore = useMemo(() => {
    try {
      const stored = localStorage.getItem('current_store');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Determine active store
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const activeStoreId = useMemo(() => {
    if (selectedStoreId) return selectedStoreId;
    if (currentStore?.id) return currentStore.id;
    return stores?.[0]?.id || '';
  }, [selectedStoreId, currentStore, stores]);

  const activeStore = useMemo(() => {
    return stores?.find((s) => s.id === activeStoreId) || currentStore;
  }, [stores, activeStoreId, currentStore]);

  const activeOrgId = useMemo(() => {
    return activeStore?.organization_id || organizations?.[0]?.id || '';
  }, [activeStore, organizations]);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Modals & Drawers
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [adjustOpened, setAdjustOpened] = useState<boolean>(false);
  const [receiveDrawerOpened, setReceiveDrawerOpened] = useState<boolean>(false);
  const [movementsDrawerOpened, setMovementsDrawerOpened] = useState<boolean>(false);
  const [movementTargetProduct, setMovementTargetProduct] = useState<{ id: string; name: string } | undefined>(undefined);

  // Queries
  const { data: inventory, isLoading } = useInventory({
    store_id: activeStoreId || undefined,
    is_low_stock: statusFilter === 'LOW_STOCK' ? true : undefined,
    is_out_of_stock: statusFilter === 'OUT_OF_STOCK' ? true : undefined,
    search: search.trim() || undefined,
  });

  const { data: summary } = useInventorySummary(activeStoreId || undefined);

  const storeOptions = useMemo(() => {
    if (!stores) return [];
    return stores.map((s) => ({
      value: s.id,
      label: s.name,
    }));
  }, [stores]);

  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustTarget(item);
    setAdjustOpened(true);
  };

  const handleOpenProductHistory = (item: InventoryItem) => {
    setMovementTargetProduct(item.product ? { id: item.product.id, name: item.product.name } : undefined);
    setMovementsDrawerOpened(true);
  };

  const handleOpenStoreHistory = () => {
    setMovementTargetProduct(undefined);
    setMovementsDrawerOpened(true);
  };

  return (
    <Stack gap="xl">
      {/* Page Header */}
      <Box style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon
              size={48}
              radius="md"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              }}
            >
              <IconBuildingWarehouse size={28} color="#fff" />
            </ThemeIcon>
            <div>
              <Title order={2} fw={800} style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Store Inventory & Stock Levels
              </Title>
              <Text size="sm" c="dimmed">
                Real-time physical store stock, batch lots, low-stock alerts, and ledger history.
              </Text>
            </div>
          </Group>

          {/* Action Buttons & Store Switcher */}
          <Group gap="xs" wrap="wrap">
            {storeOptions.length > 1 && (
              <Select
                placeholder="Switch store..."
                data={storeOptions}
                value={activeStoreId}
                onChange={(val) => setSelectedStoreId(val || '')}
                leftSection={<IconBuildingStore size={16} />}
                size="sm"
                w={200}
              />
            )}

            <Button
              variant="default"
              size="sm"
              leftSection={<IconHistory size={16} />}
              onClick={handleOpenStoreHistory}
            >
              Audit Trail
            </Button>

            <Button
              variant="filled"
              color="brand"
              size="sm"
              leftSection={<IconTruckLoading size={16} />}
              onClick={() => setReceiveDrawerOpened(true)}
            >
              Inward Stock (GRN)
            </Button>
          </Group>
        </Group>
      </Box>

      {/* KPI Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card withBorder radius="md" p="md" className="kpi-card">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stocked Products
              </Text>
              <Text size="28px" fw={800} mt={4}>
                {summary?.total_products ?? '—'}
              </Text>
            </div>
            <ThemeIcon size={44} radius="md" color="indigo" variant="light">
              <IconPackage size={24} />
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            SKUs registered at this store
          </Text>
        </Card>

        <Card withBorder radius="md" p="md" className="kpi-card">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Units on Shelf
              </Text>
              <Text size="28px" fw={800} mt={4} c="teal">
                {summary?.total_units_in_stock?.toLocaleString() ?? '—'}
              </Text>
            </div>
            <ThemeIcon size={44} radius="md" color="teal" variant="light">
              <IconCircleCheck size={24} />
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            Total physical inventory units
          </Text>
        </Card>

        <Card withBorder radius="md" p="md" className="kpi-card">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Low Stock Alerts
              </Text>
              <Text size="28px" fw={800} mt={4} c={summary?.low_stock_count ? 'orange' : 'dimmed'}>
                {summary?.low_stock_count ?? '—'}
              </Text>
            </div>
            <ThemeIcon size={44} radius="md" color="orange" variant="light">
              <IconAlertTriangle size={24} />
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            At or below reorder threshold
          </Text>
        </Card>

        <Card withBorder radius="md" p="md" className="kpi-card">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Inventory Valuation
              </Text>
              <Text size="28px" fw={800} mt={4} c="brand">
                ₹{Number(summary?.total_inventory_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </div>
            <ThemeIcon size={44} radius="md" color="brand" variant="light">
              <IconCurrencyRupee size={24} />
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            Estimated wholesale cost basis
          </Text>
        </Card>
      </SimpleGrid>

      {/* Toolbar & Filters */}
      <Card withBorder radius="md" p="sm">
        <Group justify="space-between" wrap="wrap" gap="md">
          <TextInput
            placeholder="Search by product name, SKU, barcode, batch..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 260 }}
          />

          <SegmentedControl
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            data={[
              { label: 'All Items', value: 'ALL' },
              { label: `Low Stock (${summary?.low_stock_count || 0})`, value: 'LOW_STOCK' },
              { label: `Out of Stock (${summary?.out_of_stock_count || 0})`, value: 'OUT_OF_STOCK' },
            ]}
          />
        </Group>
      </Card>

      {/* Inventory Table */}
      <Card withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Center py={60}>
            <Loader size="md" color="brand" />
          </Center>
        ) : !inventory || inventory.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <ThemeIcon size={54} radius="xl" color="gray" variant="light">
                <IconBuildingWarehouse size={28} />
              </ThemeIcon>
              <Text fw={700} size="md">
                No inventory records for this store
              </Text>
              <Text size="xs" c="dimmed">
                Use "Inward Stock (GRN)" to receive your initial consignment of items.
              </Text>
              <Button
                variant="light"
                color="brand"
                size="xs"
                mt="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setReceiveDrawerOpened(true)}
              >
                Inward First Consignment
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table verticalSpacing="sm" horizontalSpacing="md" striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
              <Table.Tr>
                <Table.Th>Product Details</Table.Th>
                <Table.Th>Stock Level</Table.Th>
                <Table.Th>Store Price vs MRP</Table.Th>
                <Table.Th>Batch Lot</Table.Th>
                <Table.Th>Last Restocked</Table.Th>
                <Table.Th style={{ width: 80, textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {inventory.map((item) => {
                const isOutOfStock = item.stock_quantity <= 0;
                const isLowStock = !isOutOfStock && item.is_low_stock;
                const hasPriceOverride = item.store_price !== null && item.store_price !== undefined;

                return (
                  <Table.Tr key={item.id}>
                    {/* Product Details */}
                    <Table.Td>
                      <Group gap="sm">
                        <ThemeIcon size={36} radius="md" color="indigo" variant="light">
                          <IconPackage size={18} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={700}>
                            {item.product?.name}
                          </Text>
                          <Group gap={6} mt={2}>
                            <Badge size="xs" variant="outline" color="gray">
                              SKU: {item.product?.sku}
                            </Badge>
                            {item.product?.barcode && (
                              <Badge size="xs" variant="light" color="blue" leftSection={<IconBarcode size={10} />}>
                                {item.product.barcode}
                              </Badge>
                            )}
                          </Group>
                        </div>
                      </Group>
                    </Table.Td>

                    {/* Stock Level & Badge */}
                    <Table.Td>
                      <Group gap="xs">
                        <Badge
                          size="md"
                          variant="filled"
                          color={isOutOfStock ? 'red' : isLowStock ? 'yellow' : 'teal'}
                          radius="sm"
                          fw={800}
                        >
                          {item.stock_quantity} in stock
                        </Badge>
                        {isLowStock && (
                          <Tooltip label={`Threshold: ${item.low_stock_threshold}`}>
                            <ThemeIcon size="xs" color="yellow" variant="transparent">
                              <IconAlertTriangle size={14} />
                            </ThemeIcon>
                          </Tooltip>
                        )}
                      </Group>
                      <Text size="10px" c="dimmed" mt={2}>
                        Reorder threshold: {item.low_stock_threshold} units
                      </Text>
                    </Table.Td>

                    {/* Price Override vs Base MRP */}
                    <Table.Td>
                      <Text size="sm" fw={700}>
                        ₹{Number(item.effective_price || item.product?.base_mrp || 0).toFixed(2)}
                      </Text>
                      {hasPriceOverride ? (
                        <Badge size="xs" color="indigo" variant="light">
                          Store Override
                        </Badge>
                      ) : (
                        <Text size="10px" c="dimmed">
                          MRP: ₹{Number(item.product?.base_mrp || 0).toFixed(2)}
                        </Text>
                      )}
                    </Table.Td>

                    {/* Batch Number */}
                    <Table.Td>
                      {item.batch_number ? (
                        <Badge size="sm" variant="outline" color="teal">
                          {item.batch_number}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">
                          General
                        </Text>
                      )}
                    </Table.Td>

                    {/* Last Restocked */}
                    <Table.Td>
                      {item.last_restocked_at ? (
                        <div>
                          <Text size="xs" fw={600}>
                            {new Date(item.last_restocked_at).toLocaleDateString()}
                          </Text>
                          <Text size="10px" c="dimmed">
                            {new Date(item.last_restocked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </div>
                      ) : (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>

                    {/* Row Action Menu */}
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Menu position="bottom-end" shadow="md" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="sm">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconArrowsExchange size={14} />}
                            onClick={() => handleOpenAdjust(item)}
                          >
                            Adjust Stock
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconHistory size={14} />}
                            onClick={() => handleOpenProductHistory(item)}
                          >
                            View Audit Movements
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        opened={adjustOpened}
        onClose={() => setAdjustOpened(false)}
        inventory={adjustTarget}
      />

      {/* Inward Goods GRN Drawer */}
      <ReceiveGoodsDrawer
        opened={receiveDrawerOpened}
        onClose={() => setReceiveDrawerOpened(false)}
        storeId={activeStoreId}
        storeName={activeStore?.name || 'Active Store'}
        organizationId={activeOrgId}
      />

      {/* Stock Movements History Drawer */}
      <StockMovementsDrawer
        opened={movementsDrawerOpened}
        onClose={() => setMovementsDrawerOpened(false)}
        storeId={activeStoreId}
        storeName={activeStore?.name || 'Active Store'}
        productId={movementTargetProduct?.id}
        productName={movementTargetProduct?.name}
      />
    </Stack>
  );
}
