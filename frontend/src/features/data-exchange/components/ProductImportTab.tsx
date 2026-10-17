import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  FileButton,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconFileSpreadsheet,
  IconPackage,
  IconPlayerPlay,
  IconUpload,
} from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import { downloadSampleTemplate, useImportProductsMutation } from '../api';
import type { DryRunResponse, ImportCommitResponse, ImportRowError, ProductPreviewItem } from '../types';

export function ProductImportTab() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [useRawInput, setUseRawInput] = useState<boolean>(false);

  const [dryRunResult, setDryRunResult] = useState<DryRunResponse<ProductPreviewItem> | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);

  const { data: stores = [] } = useStores();
  const importMutation = useImportProductsMutation();

  const storeOptions = useMemo(() => {
    return [
      { label: 'None (Catalog Only - No Initial Inventory)', value: '' },
      ...stores.map((s) => ({ label: `Auto-inward to ${s.name}`, value: s.id })),
    ];
  }, [stores]);

  const handleRunDryRun = async () => {
    setCommitResult(null);
    const result = await importMutation.mutateAsync({
      file: useRawInput ? undefined : file || undefined,
      csv_content: useRawInput ? rawCsvText : undefined,
      dry_run: true,
      store_id: selectedStoreId || undefined,
      update_existing: updateExisting,
    });
    setDryRunResult(result as DryRunResponse<ProductPreviewItem>);
  };

  const handleExecuteImport = async () => {
    const result = await importMutation.mutateAsync({
      file: useRawInput ? undefined : file || undefined,
      csv_content: useRawInput ? rawCsvText : undefined,
      dry_run: false,
      store_id: selectedStoreId || undefined,
      update_existing: updateExisting,
    });
    setCommitResult(result as ImportCommitResponse);
    setDryRunResult(null);
  };

  const hasDataToImport = Boolean((file && !useRawInput) || (rawCsvText.trim() && useRawInput));

  return (
    <Stack gap="lg">
      {/* Configuration & Upload Card */}
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs">
              <IconPackage size={22} color="var(--brand-primary)" />
              <Text fw={700} size="md">
                Bulk Product Catalog & Stock Inwarding
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Upload standard CSV to create products, map categories, and inward initial store inventory
            </Text>
          </Stack>

          <Button
            size="xs"
            variant="light"
            color="brand"
            leftSection={<IconFileSpreadsheet size={14} />}
            onClick={() => downloadSampleTemplate('products')}
          >
            Download Sample CSV
          </Button>
        </Group>

        <Grid gap="md" mb="md">
          <Grid.Col span={{ base: 12, sm: 7 }}>
            <Select
              label="Target Store for Opening Stock"
              description="If selected, items with quantity will be inwarded to store inventory automatically"
              placeholder="Select store (Optional)"
              data={storeOptions}
              value={selectedStoreId}
              onChange={(val) => setSelectedStoreId(val || '')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <Stack justify="flex-end" h="100%">
              <Checkbox
                label="Update existing products if SKU matches"
                description="Refreshes price, tax slab, and category for existing items"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.currentTarget.checked)}
              />
            </Stack>
          </Grid.Col>
        </Grid>

        {/* Input Toggle */}
        <Group justify="space-between" mb="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {useRawInput ? 'Direct CSV Text Input' : 'File Upload'}
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => setUseRawInput((prev) => !prev)}
          >
            {useRawInput ? 'Switch to File Upload' : 'Paste Raw CSV Text'}
          </Button>
        </Group>

        {useRawInput ? (
          <Textarea
            rows={6}
            placeholder="name,sku,barcode,category,cost_price,base_mrp,tax_slab,initial_stock&#10;Artisan Coffee,ARC-100,89011110001,Beverages,300.00,450.00,5.00,20"
            value={rawCsvText}
            onChange={(e) => setRawCsvText(e.currentTarget.value)}
          />
        ) : (
          <Paper
            p="xl"
            radius="md"
            withBorder
            style={{
              textAlign: 'center',
              borderStyle: 'dashed',
              backgroundColor: 'var(--bg-page)',
            }}
          >
            <Stack align="center" gap="xs">
              <ThemeIcon size={48} radius="xl" color="brand" variant="light">
                <IconUpload size={24} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                {file ? file.name : 'Select or drag your CSV spreadsheet here'}
              </Text>
              <Text size="xs" c="dimmed">
                Supports UTF-8 and Microsoft Excel CSV files (up to 10MB)
              </Text>
              <FileButton onChange={setFile} accept=".csv,text/csv">
                {(props) => (
                  <Button {...props} size="xs" variant="default" mt="xs">
                    {file ? 'Change File' : 'Browse CSV File'}
                  </Button>
                )}
              </FileButton>
            </Stack>
          </Paper>
        )}

        {/* Actions Bar */}
        <Group justify="flex-end" mt="lg" gap="sm">
          <Button
            size="sm"
            variant="default"
            leftSection={<IconClock size={16} />}
            disabled={!hasDataToImport}
            loading={importMutation.isPending && importMutation.variables?.dry_run}
            onClick={handleRunDryRun}
          >
            Run Pre-Flight Dry Run
          </Button>

          <Button
            size="sm"
            color="brand"
            leftSection={<IconPlayerPlay size={16} />}
            disabled={!hasDataToImport}
            loading={importMutation.isPending && !importMutation.variables?.dry_run}
            onClick={handleExecuteImport}
          >
            Execute Live Import
          </Button>
        </Group>
      </Card>

      {/* Live Commit Result */}
      {commitResult && (
        <Alert
          color="teal"
          radius="md"
          title="Product Import Successfully Executed"
          icon={<IconCheck size={20} />}
        >
          <Text size="sm" mb="xs">
            Import completed with atomic database consistency:
          </Text>
          <Group gap="lg">
            <Badge size="lg" color="teal">
              {commitResult.imported_count || 0} New Products Created
            </Badge>
            <Badge size="lg" color="indigo">
              {commitResult.updated_count || 0} Existing Products Updated
            </Badge>
            {commitResult.inwarded_inventory_count !== undefined && commitResult.inwarded_inventory_count > 0 && (
              <Badge size="lg" color="violet">
                {commitResult.inwarded_inventory_count} SKUs Inwarded to Inventory
              </Badge>
            )}
          </Group>
        </Alert>
      )}

      {/* Dry Run Report */}
      {dryRunResult && (
        <Card padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Stack gap={2}>
              <Group gap="xs">
                <Text fw={700} size="md">
                  Pre-Flight Dry Run Validation Report
                </Text>
                <Badge color="brand" variant="outline">
                  TEST RUN
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                No changes have been committed to the live database yet.
              </Text>
            </Stack>

            <Group gap="xs">
              <Badge color="teal" size="md">
                {dryRunResult.valid_rows} Valid Rows
              </Badge>
              {dryRunResult.invalid_rows > 0 && (
                <Badge color="red" size="md">
                  {dryRunResult.invalid_rows} Validation Errors
                </Badge>
              )}
            </Group>
          </Group>

          {/* Error Table if Any */}
          {dryRunResult.errors.length > 0 && (
            <Box mb="md">
              <Alert
                color="red"
                radius="sm"
                title={`Found ${dryRunResult.errors.length} formatting issues`}
                icon={<IconAlertTriangle size={16} />}
                mb="xs"
              >
                Please correct these rows in your spreadsheet or proceed knowing invalid rows will be skipped:
              </Alert>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 80 }}>Row #</Table.Th>
                    <Table.Th style={{ width: 140 }}>SKU</Table.Th>
                    <Table.Th>Error Reason</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dryRunResult.errors.map((err: ImportRowError, idx: number) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={700}>{err.row}</Table.Td>
                      <Table.Td>{err.sku || 'N/A'}</Table.Td>
                      <Table.Td c="red.8">{err.error}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}

          {/* Valid Preview Table */}
          {dryRunResult.preview.length > 0 && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
                Parsed Sample Records ({dryRunResult.preview.length} of {dryRunResult.valid_rows})
              </Text>
              <Table highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Row</Table.Th>
                    <Table.Th>Product Name</Table.Th>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Base MRP (₹)</Table.Th>
                    <Table.Th>Cost Price (₹)</Table.Th>
                    <Table.Th>Opening Stock</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dryRunResult.preview.map((p: ProductPreviewItem, idx: number) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{p.row_num}</Table.Td>
                      <Table.Td fw={600}>{p.name}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="outline" color="gray">
                          {p.sku}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{p.category || 'Default'}</Table.Td>
                      <Table.Td>₹{p.base_mrp}</Table.Td>
                      <Table.Td>₹{p.cost_price}</Table.Td>
                      <Table.Td>{p.stock_qty}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}
        </Card>
      )}
    </Stack>
  );
}
