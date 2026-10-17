import {
  Modal,
  TextInput,
  Stack,
  Group,
  Text,
  Badge,
  Paper,
  Table,
  Button,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconSearch,
  IconBarcode,
  IconPlus,
  IconPackage,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useInventory } from '../../inventory/api';
import type { InventoryItem } from '../../inventory/types';

interface ProductSearchModalProps {
  opened: boolean;
  onClose: () => void;
  storeId: string;
  onSelectProduct: (item: InventoryItem) => void;
}

export function ProductSearchModal({
  opened,
  onClose,
  storeId,
  onSelectProduct,
}: ProductSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: inventoryItems = [], isLoading } = useInventory({
    store_id: storeId,
    search: searchTerm.trim() || undefined,
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSearch size={20} color="var(--mantine-color-brand-6)" />
          <Text fw={700} size="md">
            Product Catalog & Stock Search (F2)
          </Text>
        </Group>
      }
      size="xl"
      radius="md"
    >
      <Stack gap="md">
        <TextInput
          placeholder="Search by product name, barcode, SKU, or brand..."
          leftSection={<IconSearch size={18} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-autofocus
          size="md"
        />

        {isLoading ? (
          <Center p="xl">
            <Loader size="md" color="brand" />
          </Center>
        ) : inventoryItems.length === 0 ? (
          <Paper p="xl" withBorder radius="md" style={{ textAlign: 'center' }}>
            <IconPackage size={36} color="var(--mantine-color-gray-4)" style={{ margin: '0 auto 8px' }} />
            <Text fw={600} size="sm" c="dimmed">
              No products found matching "{searchTerm}"
            </Text>
            <Text size="xs" c="dimmed">
              Try searching by manufacturer barcode or brand name.
            </Text>
          </Paper>
        ) : (
          <Paper withBorder radius="md" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <Table highlightOnHover verticalSpacing="xs">
              <Table.Thead style={{ backgroundColor: 'var(--mantine-color-gray-0)', position: 'sticky', top: 0, zIndex: 1 }}>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Barcode / SKU</Table.Th>
                  <Table.Th>Available Stock</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {inventoryItems.map((inv) => {
                  const prod = inv.product;
                  const isOutOfStock = inv.stock_quantity <= 0;
                  const price = Number(inv.effective_price || prod?.base_mrp || 0);

                  return (
                    <Table.Tr
                      key={inv.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        onSelectProduct(inv);
                        onClose();
                      }}
                    >
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={700} size="sm">
                            {prod?.name || 'Unknown Product'}
                          </Text>
                          {prod?.brand && (
                            <Text size="11px" c="dimmed">
                              Brand: {typeof prod.brand === 'object' ? prod.brand.name : prod.brand}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>

                      <Table.Td>
                        <Group gap={4}>
                          {prod?.barcode && (
                            <Badge size="xs" variant="light" color="blue" leftSection={<IconBarcode size={10} />}>
                              {prod.barcode}
                            </Badge>
                          )}
                          {prod?.sku && (
                            <Badge size="xs" variant="outline" color="gray">
                              {prod.sku}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>

                      <Table.Td>
                        {isOutOfStock ? (
                          <Badge color="red" size="sm" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                            Out of Stock
                          </Badge>
                        ) : (
                          <Badge color={inv.is_low_stock ? 'orange' : 'teal'} size="sm" variant="light">
                            {inv.stock_quantity} {prod?.uom || 'units'}
                          </Badge>
                        )}
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={800} size="sm" c="brand">
                          ₹{price.toFixed(2)}
                        </Text>
                        {prod?.base_mrp && Number(prod.base_mrp) > price && (
                          <Text size="10px" c="dimmed" td="line-through">
                            MRP ₹{Number(prod.base_mrp).toFixed(2)}
                          </Text>
                        )}
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'center' }}>
                        <Button
                          size="xs"
                          color="brand"
                          variant="light"
                          leftSection={<IconPlus size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProduct(inv);
                            onClose();
                          }}
                        >
                          Add
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </Modal>
  );
}
