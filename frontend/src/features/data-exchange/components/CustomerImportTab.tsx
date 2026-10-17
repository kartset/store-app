import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
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
  IconPlayerPlay,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import { downloadSampleTemplate, useImportCustomersMutation } from '../api';
import type { CustomerPreviewItem, DryRunResponse, ImportCommitResponse, ImportRowError } from '../types';

export function CustomerImportTab() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [useRawInput, setUseRawInput] = useState<boolean>(false);

  const [dryRunResult, setDryRunResult] = useState<DryRunResponse<CustomerPreviewItem> | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);

  const { data: stores = [] } = useStores();
  const importMutation = useImportCustomersMutation();

  const storeOptions = useMemo(() => {
    return [
      { label: 'None (Global Customer Profile Only)', value: '' },
      ...stores.map((s) => ({ label: `Assign Store Loyalty at ${s.name}`, value: s.id })),
    ];
  }, [stores]);

  const handleRunDryRun = async () => {
    setCommitResult(null);
    const result = await importMutation.mutateAsync({
      file: useRawInput ? undefined : file || undefined,
      csv_content: useRawInput ? rawCsvText : undefined,
      dry_run: true,
      store_id: selectedStoreId || undefined,
    });
    setDryRunResult(result as DryRunResponse<CustomerPreviewItem>);
  };

  const handleExecuteImport = async () => {
    const result = await importMutation.mutateAsync({
      file: useRawInput ? undefined : file || undefined,
      csv_content: useRawInput ? rawCsvText : undefined,
      dry_run: false,
      store_id: selectedStoreId || undefined,
    });
    setCommitResult(result as ImportCommitResponse);
    setDryRunResult(null);
  };

  const hasDataToImport = Boolean((file && !useRawInput) || (rawCsvText.trim() && useRawInput));

  return (
    <Stack gap="lg">
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs">
              <IconUsers size={22} color="var(--brand-primary)" />
              <Text fw={700} size="md">
                Bulk Customer Directory & Loyalty Ingestion
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Import phone-verified customer records, B2B wholesale GSTINs, and opening loyalty point balances
            </Text>
          </Stack>

          <Button
            size="xs"
            variant="light"
            color="brand"
            leftSection={<IconFileSpreadsheet size={14} />}
            onClick={() => downloadSampleTemplate('customers')}
          >
            Download Sample CSV
          </Button>
        </Group>

        <Grid gap="md" mb="md">
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <Select
              label="Store Branch for Loyalty Balances"
              description="Credits loyalty point balances specified in the CSV to this specific branch"
              placeholder="Select store (Optional)"
              data={storeOptions}
              value={selectedStoreId}
              onChange={(val) => setSelectedStoreId(val || '')}
            />
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
            placeholder="name,mobile_number,email,customer_type,gstin,loyalty_points&#10;Rohan Sharma,9876543210,rohan@example.com,RETAIL,,100"
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
                {file ? file.name : 'Select or drag your Customer CSV spreadsheet here'}
              </Text>
              <Text size="xs" c="dimmed">
                Mobile numbers are automatically cleaned (+91 and leading zeros normalized)
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
          title="Customer Import Successfully Executed"
          icon={<IconCheck size={20} />}
        >
          <Text size="sm" mb="xs">
            Customer directory updated:
          </Text>
          <Group gap="lg">
            <Badge size="lg" color="teal">
              {commitResult.created_count || 0} New Profiles Created
            </Badge>
            <Badge size="lg" color="indigo">
              {commitResult.updated_count || 0} Existing Profiles Updated
            </Badge>
          </Group>
        </Alert>
      )}

      {/* Dry Run Report */}
      {dryRunResult && (
        <Card padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Stack gap={2}>
              <Text fw={700} size="md">
                Customer Pre-Flight Validation Report
              </Text>
              <Text size="xs" c="dimmed">
                Preview of customer profiles to be processed.
              </Text>
            </Stack>

            <Group gap="xs">
              <Badge color="teal" size="md">
                {dryRunResult.valid_rows} Valid Rows
              </Badge>
              {dryRunResult.invalid_rows > 0 && (
                <Badge color="red" size="md">
                  {dryRunResult.invalid_rows} Invalid Rows
                </Badge>
              )}
            </Group>
          </Group>

          {dryRunResult.errors.length > 0 && (
            <Box mb="md">
              <Alert
                color="red"
                radius="sm"
                title={`Found ${dryRunResult.errors.length} formatting errors`}
                icon={<IconAlertTriangle size={16} />}
                mb="xs"
              >
                Rows with invalid phone numbers will be skipped:
              </Alert>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 80 }}>Row #</Table.Th>
                    <Table.Th style={{ width: 140 }}>Mobile</Table.Th>
                    <Table.Th>Error Reason</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dryRunResult.errors.map((err: ImportRowError, idx: number) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={700}>{err.row}</Table.Td>
                      <Table.Td>{err.mobile || 'N/A'}</Table.Td>
                      <Table.Td c="red.8">{err.error}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}

          {dryRunResult.preview.length > 0 && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
                Parsed Sample Records ({dryRunResult.preview.length} of {dryRunResult.valid_rows})
              </Text>
              <Table highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Row</Table.Th>
                    <Table.Th>Customer Name</Table.Th>
                    <Table.Th>Mobile</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>GSTIN</Table.Th>
                    <Table.Th>Opening Points</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dryRunResult.preview.map((c: CustomerPreviewItem, idx: number) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{c.row_num}</Table.Td>
                      <Table.Td fw={600}>{c.name}</Table.Td>
                      <Table.Td>{c.mobile_number}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={c.customer_type === 'B2B' ? 'violet' : 'teal'}>
                          {c.customer_type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{c.gstin || 'None'}</Table.Td>
                      <Table.Td>{c.loyalty_points}</Table.Td>
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
