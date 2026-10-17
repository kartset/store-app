import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBuildingWarehouse,
  IconDownload,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconPackage,
  IconUsers,
} from '@tabler/icons-react';
import { downloadSampleTemplate } from '../api';
import type { TemplateType } from '../types';

interface TemplateCardConfig {
  type: TemplateType;
  title: string;
  badge: string;
  badgeColor: string;
  icon: typeof IconPackage;
  iconColor: string;
  description: string;
  requiredHeaders: string[];
  optionalHeaders: string[];
  exampleRow: string;
}

const TEMPLATES: TemplateCardConfig[] = [
  {
    type: 'products',
    title: 'Product Master & Inwarding Template',
    badge: 'Catalog & Stock',
    badgeColor: 'blue',
    icon: IconPackage,
    iconColor: 'blue',
    description:
      'Ideal for bootstrapping your product catalog or inwarding initial warehouse stock with base MRP and cost prices.',
    requiredHeaders: ['name', 'sku', 'category', 'base_mrp'],
    optionalHeaders: [
      'barcode',
      'cost_price',
      'tax_rate',
      'unit_of_measure',
      'is_serialized',
      'opening_stock',
    ],
    exampleRow:
      'Ultra Boost 22,AD-UB22-01,Footwear,18000,10500,18.0,PAIR,ADUB22001,false,50',
  },
  {
    type: 'customers',
    title: 'Customer Directory & Loyalty Template',
    badge: 'CRM & Loyalty',
    badgeColor: 'teal',
    icon: IconUsers,
    iconColor: 'teal',
    description:
      'Import retail customer profiles with mobile number verification, B2B GSTIN registration, and initial loyalty balance.',
    requiredHeaders: ['name', 'mobile_number'],
    optionalHeaders: [
      'email',
      'customer_type',
      'gstin',
      'address_line1',
      'city',
      'state',
      'pincode',
      'loyalty_points',
    ],
    exampleRow:
      'Rajesh Kumar,9876543210,rajesh@example.com,RETAIL,,12 MG Road,Bengaluru,KA,560001,150',
  },
  {
    type: 'inventory',
    title: 'Store Stock & Replenishment Template',
    badge: 'Inventory Audit',
    badgeColor: 'orange',
    icon: IconBuildingWarehouse,
    iconColor: 'orange',
    description:
      'Bulk inventory adjustment template for cycle counting, stock takes, and multi-store replenishment inwarding.',
    requiredHeaders: ['sku', 'opening_stock'],
    optionalHeaders: ['barcode', 'product_name', 'unit_of_measure', 'store_code'],
    exampleRow: 'AD-UB22-01,25,ADUB22001,Ultra Boost 22,PAIR,STR-BLR-01',
  },
];

export function TemplateDownloadTab() {
  const [downloadingType, setDownloadingType] = useState<TemplateType | null>(null);

  const handleDownload = async (type: TemplateType) => {
    try {
      setDownloadingType(type);
      await downloadSampleTemplate(type);
    } catch (err) {
      console.error('Failed to download template', err);
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <Stack gap="lg">
      <Alert
        icon={<IconInfoCircle size={20} />}
        title="Starter Template Guidelines"
        color="blue"
        variant="light"
        radius="md"
      >
        <Text size="sm">
          All template files are formatted as UTF-8 Comma-Separated Values (CSV).
          Header row names are case-insensitive and allow common aliases (e.g.,{' '}
          <Code>phone</Code> or <Code>mobile_number</Code>, <Code>title</Code> or <Code>name</Code>).
          Before committing changes, use the dry-run inspector tab to preview imported rows and catch syntax errors safely.
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {TEMPLATES.map((tpl) => {
          const Icon = tpl.icon;
          const isDownloading = downloadingType === tpl.type;

          return (
            <Card
              key={tpl.type}
              withBorder
              padding="lg"
              radius="md"
              shadow="sm"
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <Group justify="space-between" mb="xs">
                <ThemeIcon size={44} radius="md" color={tpl.iconColor} variant="light">
                  <Icon size={24} />
                </ThemeIcon>
                <Badge color={tpl.badgeColor} variant="light">
                  {tpl.badge}
                </Badge>
              </Group>

              <Text fw={700} size="md" mt="xs">
                {tpl.title}
              </Text>

              <Text size="sm" c="dimmed" mt={4} style={{ flexGrow: 1 }}>
                {tpl.description}
              </Text>

              <Box mt="md">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
                  Mandatory Headers
                </Text>
                <Group gap={4} mb="xs">
                  {tpl.requiredHeaders.map((h) => (
                    <Badge key={h} size="xs" variant="outline" color="dark">
                      {h}
                    </Badge>
                  ))}
                </Group>

                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
                  Optional Headers
                </Text>
                <Group gap={4} mb="md">
                  {tpl.optionalHeaders.map((h) => (
                    <Badge key={h} size="xs" variant="subtle" color="gray">
                      {h}
                    </Badge>
                  ))}
                </Group>

                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
                  Example Row Format
                </Text>
                <Box
                  p="xs"
                  mb="md"
                  style={{
                    backgroundColor: 'var(--mantine-color-gray-1)',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tpl.exampleRow}
                </Box>
              </Box>

              <Button
                leftSection={<IconDownload size={16} />}
                variant="light"
                color={tpl.iconColor}
                fullWidth
                loading={isDownloading}
                onClick={() => handleDownload(tpl.type)}
              >
                Download Sample CSV
              </Button>
            </Card>
          );
        })}
      </SimpleGrid>

      <Card withBorder radius="md" padding="md" bg="var(--mantine-color-gray-0)">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon color="green" variant="light" size={36} radius="md">
              <IconFileSpreadsheet size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm">
                Need to Import Hundreds of Items Directly from Excel or Google Sheets?
              </Text>
              <Text size="xs" c="dimmed">
                Export or Save your spreadsheet as `.csv` (Comma delimited) and paste raw text into the import tabs or drop the file.
              </Text>
            </div>
          </Group>
          <Badge color="green" variant="outline">
            RFC-4180 Compliant
          </Badge>
        </Group>
      </Card>
    </Stack>
  );
}
