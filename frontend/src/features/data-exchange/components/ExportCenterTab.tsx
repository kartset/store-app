import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBuildingWarehouse,
  IconDownload,
  IconPackage,
  IconReceipt,
  IconUsers,
} from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import { downloadUniversalExport } from '../api';
import type { ExportEntity } from '../types';

export function ExportCenterTab() {
  const [downloadingEntity, setDownloadingEntity] = useState<string | null>(null);

  // Store & date filters for inventory & invoices
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [invoiceStartDate, setInvoiceStartDate] = useState<string>('');
  const [invoiceEndDate, setInvoiceEndDate] = useState<string>('');

  const { data: stores = [] } = useStores();

  const storeOptions = useMemo(() => {
    return [
      { label: 'All Stores & Branches', value: '' },
      ...stores.map((s) => ({ label: s.name, value: s.id })),
    ];
  }, [stores]);

  const handleDownload = async (entity: ExportEntity) => {
    setDownloadingEntity(entity);
    try {
      await downloadUniversalExport(entity, {
        store_id: selectedStoreId || undefined,
        start_date: entity === 'invoices' ? invoiceStartDate || undefined : undefined,
        end_date: entity === 'invoices' ? invoiceEndDate || undefined : undefined,
      });
    } finally {
      setDownloadingEntity(null);
    }
  };

  return (
    <Stack gap="lg">
      <Card padding="lg" radius="md" withBorder>
        <Stack gap={2} mb="md">
          <Text fw={700} size="md">
            Universal Enterprise Export Center
          </Text>
          <Text size="xs" c="dimmed">
            Extract master catalogs, real-time store stock valuations, sales registers, and customer directories to formatted CSV
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* 1. Products Catalog */}
          <Card padding="md" radius="md" withBorder style={{ backgroundColor: 'var(--bg-page)' }}>
            <Group justify="space-between" align="flex-start" mb="xs">
              <Group gap="xs">
                <ThemeIcon size={36} radius="md" color="brand" variant="light">
                  <IconPackage size={20} />
                </ThemeIcon>
                <Box>
                  <Text size="sm" fw={700}>
                    Products Catalog
                  </Text>
                  <Text size="xs" c="dimmed">
                    Master SKU catalog & pricing
                  </Text>
                </Box>
              </Group>
              <Badge color="brand" variant="light">
                CATALOG
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="md">
              Exports product names, SKUs, global barcodes, internal barcodes, categories, cost prices, base MRPs, HSN codes, and tax slabs.
            </Text>
            <Button
              fullWidth
              size="xs"
              variant="default"
              leftSection={<IconDownload size={14} />}
              loading={downloadingEntity === 'products'}
              onClick={() => handleDownload('products')}
            >
              Export Products CSV
            </Button>
          </Card>

          {/* 2. Store Inventory & Valuation */}
          <Card padding="md" radius="md" withBorder style={{ backgroundColor: 'var(--bg-page)' }}>
            <Group justify="space-between" align="flex-start" mb="xs">
              <Group gap="xs">
                <ThemeIcon size={36} radius="md" color="emerald" variant="light">
                  <IconBuildingWarehouse size={20} />
                </ThemeIcon>
                <Box>
                  <Text size="sm" fw={700}>
                    Store Inventory Ledger
                  </Text>
                  <Text size="xs" c="dimmed">
                    Stock counts, valuation & batches
                  </Text>
                </Box>
              </Group>
              <Badge color="emerald" variant="light">
                INVENTORY
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">
              Exports current stock quantities, store retail prices, stock valuations, low stock thresholds, and batch identifiers.
            </Text>
            <Select
              size="xs"
              mb="xs"
              placeholder="Scope by store"
              data={storeOptions}
              value={selectedStoreId}
              onChange={(val) => setSelectedStoreId(val || '')}
            />
            <Button
              fullWidth
              size="xs"
              color="emerald"
              variant="light"
              leftSection={<IconDownload size={14} />}
              loading={downloadingEntity === 'inventory'}
              onClick={() => handleDownload('inventory')}
            >
              Export Inventory CSV
            </Button>
          </Card>

          {/* 3. Sales Invoices Register */}
          <Card padding="md" radius="md" withBorder style={{ backgroundColor: 'var(--bg-page)' }}>
            <Group justify="space-between" align="flex-start" mb="xs">
              <Group gap="xs">
                <ThemeIcon size={36} radius="md" color="indigo" variant="light">
                  <IconReceipt size={20} />
                </ThemeIcon>
                <Box>
                  <Text size="sm" fw={700}>
                    Sales Invoices Register
                  </Text>
                  <Text size="xs" c="dimmed">
                    GST tax ledger & sales transactions
                  </Text>
                </Box>
              </Group>
              <Badge color="indigo" variant="light">
                FINANCIAL
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">
              Exports invoice numbers, customer contact, taxable value, CGST/SGST/IGST breakdown, total discount, and grand total.
            </Text>
            <Group gap="xs" mb="xs" grow>
              <TextInput
                size="xs"
                type="date"
                label="Start Date"
                value={invoiceStartDate}
                onChange={(e) => setInvoiceStartDate(e.currentTarget.value)}
              />
              <TextInput
                size="xs"
                type="date"
                label="End Date"
                value={invoiceEndDate}
                onChange={(e) => setInvoiceEndDate(e.currentTarget.value)}
              />
            </Group>
            <Button
              fullWidth
              size="xs"
              color="indigo"
              variant="light"
              leftSection={<IconDownload size={14} />}
              loading={downloadingEntity === 'invoices'}
              onClick={() => handleDownload('invoices')}
            >
              Export Sales Register CSV
            </Button>
          </Card>

          {/* 4. Customer Directory */}
          <Card padding="md" radius="md" withBorder style={{ backgroundColor: 'var(--bg-page)' }}>
            <Group justify="space-between" align="flex-start" mb="xs">
              <Group gap="xs">
                <ThemeIcon size={36} radius="md" color="cyan" variant="light">
                  <IconUsers size={20} />
                </ThemeIcon>
                <Box>
                  <Text size="sm" fw={700}>
                    Customer Directory
                  </Text>
                  <Text size="xs" c="dimmed">
                    Contacts, B2B wholesale & loyalty
                  </Text>
                </Box>
              </Group>
              <Badge color="cyan" variant="light">
                CRM
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="md">
              Exports customer full names, phone numbers, email addresses, retail vs B2B classifications, and GSTIN identifiers.
            </Text>
            <Button
              fullWidth
              size="xs"
              color="cyan"
              variant="light"
              leftSection={<IconDownload size={14} />}
              loading={downloadingEntity === 'customers'}
              onClick={() => handleDownload('customers')}
            >
              Export Customers CSV
            </Button>
          </Card>
        </SimpleGrid>
      </Card>
    </Stack>
  );
}
