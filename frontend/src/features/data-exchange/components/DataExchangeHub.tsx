import { useState } from 'react';
import {
  Badge,
  Box,
  Container,
  Group,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconDatabaseImport,
  IconDownload,
  IconFileSpreadsheet,
  IconPackage,
  IconUsers,
} from '@tabler/icons-react';
import { CustomerImportTab } from './CustomerImportTab';
import { ExportCenterTab } from './ExportCenterTab';
import { ProductImportTab } from './ProductImportTab';
import { TemplateDownloadTab } from './TemplateDownloadTab';

export function DataExchangeHub() {
  const [activeTab, setActiveTab] = useState<string | null>('products');

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        {/* Page Header */}
        <Box>
          <Group justify="space-between" align="flex-start">
            <Group align="center" gap="md">
              <ThemeIcon size={48} radius="md" variant="light" color="indigo">
                <IconDatabaseImport size={28} />
              </ThemeIcon>
              <div>
                <Group gap="xs" align="center">
                  <Title order={2}>Data Exchange & Inwarding Hub</Title>
                  <Badge color="indigo" variant="light" size="sm">
                    Bulk Engine
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mt={2}>
                  Import catalogs, inward store stock, ingest customer records with dry-run validation, and export transactional ledgers.
                </Text>
              </div>
            </Group>
          </Group>
        </Box>

        {/* Unified Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab} radius="md" variant="outline">
          <Tabs.List mb="md">
            <Tabs.Tab value="products" leftSection={<IconPackage size={16} />}>
              Products & Stock Inwarding
            </Tabs.Tab>
            <Tabs.Tab value="customers" leftSection={<IconUsers size={16} />}>
              Customer Directory Import
            </Tabs.Tab>
            <Tabs.Tab value="export" leftSection={<IconDownload size={16} />}>
              Export Center
            </Tabs.Tab>
            <Tabs.Tab value="templates" leftSection={<IconFileSpreadsheet size={16} />}>
              Starter Templates
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="products">
            <ProductImportTab />
          </Tabs.Panel>

          <Tabs.Panel value="customers">
            <CustomerImportTab />
          </Tabs.Panel>

          <Tabs.Panel value="export">
            <ExportCenterTab />
          </Tabs.Panel>

          <Tabs.Panel value="templates">
            <TemplateDownloadTab />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
