import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconBuilding,
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUsers,
  IconKey,
} from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import { useDeleteStaff, useStaffList } from '../api';
import { TablePagination } from '../../../components/common/TablePagination';
import { OnboardStaffModal } from './OnboardStaffModal';
import { EditStaffModal } from './EditStaffModal';
import type { StaffMember } from '../types';

export function StaffList() {
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

  const isOrgAdmin = useMemo(() => {
    if (user?.is_org_admin) return true;
    if (user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN') return true;
    if (currentStore?.role === 'ORG_ADMIN') return true;
    if (user?.organizations?.some((o: { role?: string }) => o.role === 'ORG_ADMIN')) return true;
    return false;
  }, [user, currentStore]);

  if (!isOrgAdmin) {
    return <Navigate to="/pos" replace />;
  }

  return <StaffListContent />;
}

function StaffListContent() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals state
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);

  const { data: stores = [] } = useStores();
  const deleteMutation = useDeleteStaff();

  const filterParams = useMemo(() => {
    const params: Record<string, any> = {
      page,
      page_size: pageSize,
    };
    if (selectedStoreId !== 'all') {
      params.store_id = selectedStoreId;
    }
    if (selectedRole !== 'all') {
      params.role = selectedRole;
    }
    if (selectedStatus !== 'all') {
      params.is_active = selectedStatus === 'active';
    }
    if (search.trim()) {
      params.search = search.trim();
    }
    return params;
  }, [page, pageSize, selectedStoreId, selectedRole, selectedStatus, search]);

  const { data, isLoading } = useStaffList(filterParams);
  const staffMembers = data?.results || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const storeFilterOptions = useMemo(() => {
    const list = [
      { label: 'All Affiliations & Stores', value: 'all' },
      { label: 'Organization HQ (Headquarters)', value: 'org' },
    ];
    stores.forEach((s) => list.push({ label: `Store: ${s.name}`, value: s.id }));
    return list;
  }, [stores]);

  const roleFilterOptions = [
    { label: 'All Roles', value: 'all' },
    { label: 'Org Admin', value: 'ORG_ADMIN' },
    { label: 'Catalog Manager', value: 'CATALOG_MANAGER' },
    { label: 'Auditor', value: 'AUDITOR' },
    { label: 'Store Admin', value: 'ADMIN' },
    { label: 'Store Manager', value: 'MANAGER' },
    { label: 'Cashier', value: 'CASHIER' },
  ];

  const statusFilterOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ORG_ADMIN':
        return <Badge color="grape" variant="filled" size="xs">ORG ADMIN</Badge>;
      case 'CATALOG_MANAGER':
        return <Badge color="violet" variant="light" size="xs">CATALOG MGR</Badge>;
      case 'AUDITOR':
        return <Badge color="cyan" variant="light" size="xs">AUDITOR</Badge>;
      case 'ADMIN':
        return <Badge color="indigo" variant="filled" size="xs">STORE ADMIN</Badge>;
      case 'MANAGER':
        return <Badge color="blue" variant="light" size="xs">STORE MGR</Badge>;
      case 'CASHIER':
        return <Badge color="teal" variant="light" size="xs">CASHIER</Badge>;
      default:
        return <Badge color="gray" variant="light" size="xs">{role}</Badge>;
    }
  };

  const getInitials = (first: string, last?: string, email?: string) => {
    const f = first?.[0] || '';
    const l = last?.[0] || '';
    return (f + l).toUpperCase() || email?.[0]?.toUpperCase() || 'ST';
  };

  const confirmDelete = () => {
    if (!deletingStaff) return;
    deleteMutation.mutate(deletingStaff.id, {
      onSuccess: () => {
        setDeletingStaff(null);
      },
    });
  };

  return (
    <Container size="xxl" px="md" py="lg">
      <Stack gap="lg">
        {/* Top Header Card */}
        <Paper p="md" radius="md" withBorder style={{ background: 'var(--bg-surface)' }}>
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="sm">
              <ThemeIcon size={36} radius="md" color="brand" variant="light">
                <IconUsers size={22} />
              </ThemeIcon>
              <Box>
                <Group gap="xs">
                  <Title order={3} fw={800} style={{ letterSpacing: '-0.02em' }}>
                    Staff & User Directory
                  </Title>
                  <Badge size="sm" color="brand" variant="light">
                    {totalCount} Total
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Manage organization administrators, HQ managers, and retail store staff
                </Text>
              </Box>
            </Group>

            <Button
              color="brand"
              leftSection={<IconPlus size={16} />}
              onClick={() => setOnboardModalOpen(true)}
              style={{ fontWeight: 700 }}
            >
              Onboard User
            </Button>
          </Group>
        </Paper>

        {/* Filter Controls Card */}
        <Paper p="sm" radius="md" withBorder style={{ background: 'var(--bg-surface)' }}>
          <Group wrap="wrap" gap="sm">
            <TextInput
              placeholder="Search by name or email..."
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              w={240}
              size="xs"
            />

            <Select
              data={storeFilterOptions}
              value={selectedStoreId}
              onChange={(val) => {
                setSelectedStoreId(val || 'all');
                setPage(1);
              }}
              w={220}
              size="xs"
              placeholder="Filter by Store / HQ"
            />

            <Select
              data={roleFilterOptions}
              value={selectedRole}
              onChange={(val) => {
                setSelectedRole(val || 'all');
                setPage(1);
              }}
              w={160}
              size="xs"
              placeholder="Filter by Role"
            />

            <Select
              data={statusFilterOptions}
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val || 'all');
                setPage(1);
              }}
              w={130}
              size="xs"
              placeholder="Status"
            />
          </Group>
        </Paper>

        {/* Staff Table Card */}
        <Card p="md" radius="md" withBorder style={{ background: 'var(--bg-surface)' }}>
          {isLoading ? (
            <Center py={60}>
              <Loader color="brand" />
            </Center>
          ) : staffMembers.length === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="xs">
                <ThemeIcon size={44} radius="xl" color="gray" variant="light">
                  <IconUsers size={24} />
                </ThemeIcon>
                <Text fw={700} size="sm">
                  No staff members found
                </Text>
                <Text size="xs" c="dimmed">
                  Try adjusting your search criteria or onboard a new user.
                </Text>
              </Stack>
            </Center>
          ) : (
            <Table.ScrollContainer minWidth={700}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User Profile</Table.Th>
                    <Table.Th>Affiliation</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Joined Date</Table.Th>
                    <Table.Th style={{ width: 80, textAlign: 'center' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {staffMembers.map((member) => (
                    <Table.Tr key={member.id}>
                      {/* User Profile */}
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar radius="xl" color="brand" size={34}>
                            {getInitials(
                              member.user.first_name,
                              member.user.last_name,
                              member.user.email
                            )}
                          </Avatar>
                          <Box>
                            <Group gap={6}>
                              <Text size="sm" fw={700}>
                                {member.user.first_name} {member.user.last_name || ''}
                              </Text>
                              {member.user.must_change_password && (
                                <Tooltip label="First-login password update pending">
                                  <Badge size="xs" color="orange" variant="light" leftSection={<IconKey size={10} />}>
                                    PWD PENDING
                                  </Badge>
                                </Tooltip>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {member.user.email}
                            </Text>
                          </Box>
                        </Group>
                      </Table.Td>

                      {/* Affiliation */}
                      <Table.Td>
                        {member.type === 'organization' ? (
                          <Group gap="xs">
                            <ThemeIcon size={24} radius="sm" color="grape" variant="light">
                              <IconBuilding size={14} />
                            </ThemeIcon>
                            <Box>
                              <Text size="xs" fw={700}>
                                {member.organization?.name || 'Organization HQ'}
                              </Text>
                              <Text size="10px" c="dimmed">
                                Headquarters
                              </Text>
                            </Box>
                          </Group>
                        ) : (
                          <Group gap="xs">
                            <ThemeIcon size={24} radius="sm" color="blue" variant="light">
                              <IconBuildingStore size={14} />
                            </ThemeIcon>
                            <Box>
                              <Text size="xs" fw={700}>
                                {member.store?.name || 'Store Outlet'}
                              </Text>
                              <Text size="10px" c="dimmed">
                                Retail Branch
                              </Text>
                            </Box>
                          </Group>
                        )}
                      </Table.Td>

                      {/* Role */}
                      <Table.Td>{getRoleBadge(member.role)}</Table.Td>

                      {/* Status */}
                      <Table.Td>
                        {member.is_active && member.user.is_active ? (
                          <Badge color="green" variant="light" size="xs">
                            ACTIVE
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="light" size="xs">
                            INACTIVE
                          </Badge>
                        )}
                      </Table.Td>

                      {/* Joined Date */}
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {new Date(member.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </Table.Td>

                      {/* Actions */}
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Menu shadow="md" width={160} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" size="sm">
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={() => setEditingStaff(member)}
                            >
                              Edit / Reassign
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => setDeletingStaff(member)}
                            >
                              Remove Staff
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}

          <TablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      </Stack>

      {/* Onboard Modal */}
      <OnboardStaffModal
        opened={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
      />

      {/* Edit Staff Modal */}
      <EditStaffModal
        staff={editingStaff}
        opened={Boolean(editingStaff)}
        onClose={() => setEditingStaff(null)}
      />

      {/* Remove Confirmation Modal */}
      <Modal
        opened={Boolean(deletingStaff)}
        onClose={() => setDeletingStaff(null)}
        title={
          <Group gap="xs">
            <IconTrash size={18} color="red" />
            <Text fw={700} size="sm">
              Confirm Staff Removal
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to remove{' '}
            <strong>
              {deletingStaff?.user.first_name} {deletingStaff?.user.last_name || ''}
            </strong>{' '}
            from{' '}
            <strong>
              {deletingStaff?.type === 'organization'
                ? 'Organization HQ'
                : deletingStaff?.store?.name || 'this store'}
            </strong>
            ?
          </Text>
          <Text size="xs" c="dimmed">
            This will soft-delete their staff role. If they have no other active roles, their account will be deactivated.
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDeletingStaff(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={confirmDelete}
              loading={deleteMutation.isPending}
              style={{ fontWeight: 700 }}
            >
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
