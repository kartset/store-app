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
  ActionIcon,
  Tooltip,
  Select,
  Menu,
  Modal,
  CopyButton,
  Pagination,
} from '@mantine/core';

import {
  IconBriefcase,
  IconSearch,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconEye,
  IconCheck,
  IconCopy,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconReceiptTax,
  IconAlertCircle,
  IconPackage,
  IconTruckDelivery,
} from '@tabler/icons-react';

import { useState, useMemo } from 'react';
import { useOrganizations } from '../../organizations/api';
import { useVendors, useDeleteVendor } from '../api';
import { VendorDrawer } from './VendorDrawer';
import { VendorProductCatalogModal } from './VendorProductCatalogModal';
import {
  GST_STATE_CODE_MAP,

  type PaymentTerms,
  type Vendor,
} from '../types';

export function VendorList() {
  const { data: organizations } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentTermsFilter, setPaymentTermsFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Drawer State
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Delete Confirmation Modal State
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);

  // Vendor Catalog Modal State
  const [catalogModalOpened, setCatalogModalOpened] = useState(false);
  const [catalogVendor, setCatalogVendor] = useState<Vendor | null>(null);

  // Pagination state

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Active organization resolution
  const activeOrgId = useMemo(() => {
    if (selectedOrgId) return selectedOrgId;
    return organizations?.[0]?.id || '';
  }, [selectedOrgId, organizations]);

  const { data: vendors, isLoading, error } = useVendors({
    organization_id: activeOrgId || undefined,
    search: searchTerm || undefined,
    payment_terms: paymentTermsFilter || undefined,
    is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
  });

  const deleteVendorMutation = useDeleteVendor();

  // Metrics Calculations
  const metrics = useMemo(() => {
    const list = vendors || [];
    const total = list.length;
    const active = list.filter((v) => v.is_active).length;
    const net30 = list.filter((v) => v.payment_terms === 'NET_30').length;
    const totalCredit = list.reduce((acc, v) => acc + Number(v.credit_limit || 0), 0);

    return { total, active, net30, totalCredit };
  }, [vendors]);

  // Paginated records
  const paginatedVendors = useMemo(() => {
    if (!vendors) return [];
    const start = (currentPage - 1) * pageSize;
    return vendors.slice(start, start + pageSize);
  }, [vendors, currentPage]);

  const totalPages = Math.ceil((vendors?.length || 0) / pageSize) || 1;

  // Handler to open create drawer
  const handleOpenCreate = () => {
    setSelectedVendor(null);
    setIsReadOnly(false);
    setDrawerOpened(true);
  };

  // Handler to open edit drawer
  const handleOpenEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsReadOnly(false);
    setDrawerOpened(true);
  };

  // Handler to open view drawer
  const handleOpenView = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsReadOnly(true);
    setDrawerOpened(true);
  };

  // Handler to confirm delete
  const handleConfirmDelete = async () => {
    if (vendorToDelete) {
      await deleteVendorMutation.mutateAsync(vendorToDelete.id);
      setDeleteModalOpened(false);
      setVendorToDelete(null);
    }
  };

  const getPaymentTermBadge = (term: PaymentTerms) => {
    switch (term) {
      case 'COD':
        return <Badge color="orange" variant="light" size="sm">COD</Badge>;
      case 'PREPAID':
        return <Badge color="violet" variant="light" size="sm">Prepaid</Badge>;
      case 'NET_7':
        return <Badge color="cyan" variant="light" size="sm">Net 7</Badge>;
      case 'NET_15':
        return <Badge color="blue" variant="light" size="sm">Net 15</Badge>;
      case 'NET_30':
        return <Badge color="indigo" variant="light" size="sm">Net 30</Badge>;
      case 'NET_45':
        return <Badge color="grape" variant="light" size="sm">Net 45</Badge>;
      case 'NET_60':
        return <Badge color="pink" variant="light" size="sm">Net 60</Badge>;
      default:
        return <Badge color="gray" variant="light" size="sm">{term}</Badge>;
    }
  };

  return (
    <Stack gap="lg" pb="xl">
      {/* Page Header */}
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Group gap="xs">
            <ThemeIcon size={36} radius="md" color="brand" variant="light">
              <IconTruckDelivery size={22} />
            </ThemeIcon>
            <Title order={2} fw={800} style={{ letterSpacing: '-0.02em' }}>
              Vendor Directory
            </Title>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Centralized suppliers, distributors, commercial credit agreements, and GST compliance profiles.
          </Text>
        </div>

        <Group gap="sm">
          {organizations && organizations.length > 1 && (
            <Select
              placeholder="Filter by Organization"
              data={organizations.map((org) => ({ value: org.id, label: org.name }))}
              value={activeOrgId}
              onChange={(val) => {
                setSelectedOrgId(val || '');
                setCurrentPage(1);
              }}
              style={{ width: 220 }}
            />
          )}

          <Button
            leftSection={<IconPlus size={16} />}
            color="brand"
            onClick={handleOpenCreate}
            style={{ fontWeight: 600 }}
          >
            Add Vendor
          </Button>
        </Group>
      </Group>

      {/* Metric Cards Bar */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Suppliers
            </Text>
            <ThemeIcon color="blue" variant="light" radius="md" size={32}>
              <IconBriefcase size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={800} size="26px" mt="xs">
            {metrics.total}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Registered vendors across catalog
          </Text>
        </Card>

        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Vendors
            </Text>
            <ThemeIcon color="teal" variant="light" radius="md" size={32}>
              <IconCheck size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={800} size="26px" mt="xs" c="teal.7">
            {metrics.active}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Eligible for Goods Inwarding (GRN)
          </Text>
        </Card>

        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Standard Net-30
            </Text>
            <ThemeIcon color="indigo" variant="light" radius="md" size={32}>
              <IconReceiptTax size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={800} size="26px" mt="xs">
            {metrics.net30}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Vendors on standard 30-day terms
          </Text>
        </Card>

        <Card withBorder padding="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Credit Extended
            </Text>
            <ThemeIcon color="orange" variant="light" radius="md" size={32}>
              <IconCreditCard size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={800} size="26px" mt="xs">
            ₹{metrics.totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Aggregate vendor credit limit
          </Text>
        </Card>
      </SimpleGrid>

      {/* Search & Filter Bar */}
      <Card withBorder padding="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <Group justify="space-between" wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search by vendor name, trade name, code, GSTIN, phone..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{ flex: 1, minWidth: 260 }}
          />

          <Group gap="xs">
            <Select
              placeholder="Payment Terms"
              clearable
              data={[
                { value: 'COD', label: 'COD' },
                { value: 'PREPAID', label: 'Prepaid' },
                { value: 'NET_7', label: 'Net 7' },
                { value: 'NET_15', label: 'Net 15' },
                { value: 'NET_30', label: 'Net 30' },
                { value: 'NET_45', label: 'Net 45' },
                { value: 'NET_60', label: 'Net 60' },
              ]}
              value={paymentTermsFilter}
              onChange={(val) => {
                setPaymentTermsFilter(val || '');
                setCurrentPage(1);
              }}
              style={{ width: 140 }}
            />

            <Select
              placeholder="Status"
              clearable
              data={[
                { value: 'active', label: 'Active Only' },
                { value: 'inactive', label: 'Inactive Only' },
              ]}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val || '');
                setCurrentPage(1);
              }}
              style={{ width: 140 }}
            />
          </Group>
        </Group>
      </Card>

      {/* Main Vendor Data Table */}
      <Card withBorder padding={0} radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
        {isLoading ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <Loader size="md" color="brand" />
              <Text size="sm" c="dimmed">
                Loading vendors from enterprise ledger...
              </Text>
            </Stack>
          </Center>
        ) : error ? (
          <Center py={40}>
            <Text c="red" size="sm">
              Failed to load vendor records. Please refresh or verify permissions.
            </Text>
          </Center>
        ) : !vendors || vendors.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="md">
              <ThemeIcon size={56} radius="xl" color="gray" variant="light">
                <IconBriefcase size={28} />
              </ThemeIcon>
              <div style={{ textAlign: 'center' }}>
                <Text fw={700} size="md">
                  No Vendors Found
                </Text>
                <Text size="xs" c="dimmed" mt={4} maw={360}>
                  {searchTerm || paymentTermsFilter || statusFilter
                    ? 'No vendors match your search filters. Try adjusting your query parameters.'
                    : 'Get started by creating your first supplier or distributor for procurement.'}
                </Text>
              </div>
              <Button leftSection={<IconPlus size={16} />} color="brand" onClick={handleOpenCreate}>
                Add First Vendor
              </Button>
            </Stack>
          </Center>
        ) : (
          <>
            <Table verticalSpacing="sm" highlightOnHover striped>
              <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                <Table.Tr>
                  <Table.Th style={{ width: '28%' }}>Supplier / Legal Name</Table.Th>
                  <Table.Th style={{ width: '18%' }}>Taxation & State</Table.Th>
                  <Table.Th style={{ width: '22%' }}>Contact Person & Phone</Table.Th>
                  <Table.Th style={{ width: '16%' }}>Terms & Credit</Table.Th>
                  <Table.Th style={{ width: '8%' }}>Status</Table.Th>
                  <Table.Th style={{ width: '8%', textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedVendors.map((vendor) => {
                  const stateName = vendor.state_code
                    ? GST_STATE_CODE_MAP[vendor.state_code] || vendor.state || 'State ' + vendor.state_code
                    : vendor.state || 'N/A';

                  return (
                    <Table.Tr key={vendor.id}>
                      {/* Name & Trade Name */}
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon size={34} radius="md" color="brand" variant="light">
                            <Text fw={700} size="sm">
                              {vendor.name.charAt(0).toUpperCase()}
                            </Text>
                          </ThemeIcon>
                          <div>
                            <Group gap={6} align="center">
                              <Text
                                fw={700}
                                size="sm"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleOpenView(vendor)}
                              >
                                {vendor.name}
                              </Text>
                              {vendor.vendor_code && (
                                <Badge size="xs" variant="outline" color="gray">
                                  {vendor.vendor_code}
                                </Badge>
                              )}
                            </Group>
                            {vendor.trade_name && (
                              <Text size="xs" c="dimmed">
                                DBA: {vendor.trade_name}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>

                      {/* Taxation & GST */}
                      <Table.Td>
                        {vendor.gstin ? (
                          <Stack gap={2}>
                            <Group gap={4}>
                              <Text size="xs" fw={700} style={{ fontFamily: 'monospace' }}>
                                {vendor.gstin}
                              </Text>
                              <CopyButton value={vendor.gstin} timeout={2000}>
                                {({ copied, copy }) => (
                                  <Tooltip label={copied ? 'Copied' : 'Copy GSTIN'} withArrow position="right">
                                    <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" size="xs" onClick={copy}>
                                      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </CopyButton>
                            </Group>
                            <Badge size="xs" color="teal" variant="light" style={{ textTransform: 'none' }}>
                              {stateName}
                            </Badge>
                          </Stack>
                        ) : vendor.pan_number ? (
                          <Badge size="xs" color="gray" variant="light">
                            PAN: {vendor.pan_number}
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Unregistered / Composition
                          </Text>
                        )}
                      </Table.Td>

                      {/* Contact & Phone */}
                      <Table.Td>
                        <Stack gap={2}>
                          {vendor.contact_person && (
                            <Text size="xs" fw={600}>
                              {vendor.contact_person}
                            </Text>
                          )}
                          {vendor.phone && (
                            <Group gap={4}>
                              <IconPhone size={12} color="gray" />
                              <Text size="xs" c="dimmed">
                                {vendor.phone}
                              </Text>
                            </Group>
                          )}
                          {vendor.email && (
                            <Group gap={4}>
                              <IconMail size={12} color="gray" />
                              <Text size="11px" c="dimmed">
                                {vendor.email}
                              </Text>
                            </Group>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* Commercial Terms & Credit Limit */}
                      <Table.Td>
                        <Stack gap={4}>
                          <div>{getPaymentTermBadge(vendor.payment_terms)}</div>
                          <Text size="xs" fw={600} c="dimmed">
                            Limit: ₹{Number(vendor.credit_limit || 0).toLocaleString('en-IN')}
                          </Text>
                        </Stack>
                      </Table.Td>

                      {/* Status */}
                      <Table.Td>
                        {vendor.is_active ? (
                          <Badge color="teal" variant="dot" size="sm">
                            Active
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="dot" size="sm">
                            Inactive
                          </Badge>
                        )}
                      </Table.Td>

                      {/* Actions */}
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Menu shadow="md" width={160} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" size="sm">
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconEye size={14} />} onClick={() => handleOpenView(vendor)}>
                              View Details
                            </Menu.Item>
                            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => handleOpenEdit(vendor)}>
                              Edit Vendor
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconPackage size={14} />}
                              onClick={() => {
                                setCatalogVendor(vendor);
                                setCatalogModalOpened(true);
                              }}
                            >
                              Catalog & Pricing
                            </Menu.Item>
                            <Menu.Divider />

                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => {
                                setVendorToDelete(vendor);
                                setDeleteModalOpened(true);
                              }}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Group justify="space-between" p="md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <Text size="xs" c="dimmed">
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, vendors.length)} of {vendors.length} vendors
                </Text>
                <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="brand" size="sm" />
              </Group>
            )}
          </>
        )}
      </Card>

      {/* Vendor Drawer for Create / Edit / View */}
      <VendorDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        vendor={selectedVendor}
        defaultOrgId={activeOrgId}
        isReadOnly={isReadOnly}
      />

      {/* Vendor Product Catalog Modal */}
      <VendorProductCatalogModal
        opened={catalogModalOpened}
        onClose={() => setCatalogModalOpened(false)}
        vendor={catalogVendor}
      />


      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" size="sm">
              <IconAlertCircle size={14} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              Confirm Vendor Deletion
            </Text>
          </Group>
        }
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete vendor{' '}
            <Text component="span" fw={700}>
              "{vendorToDelete?.name}"
            </Text>
            ? This action performs an audited soft deletion.
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDeleteModalOpened(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteVendorMutation.isPending}
              onClick={handleConfirmDelete}
            >
              Delete Vendor
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
