import {
  Table,
  Title,
  Card,
  Text,
  Loader,
  Center,
  Badge,
  Group,
  TextInput,
  Button,
  SimpleGrid,
  ThemeIcon,
  Box,
  ActionIcon,
  Select,
  SegmentedControl,
  Menu,
  Modal,
  Stack,
  Textarea,
  NumberInput,
  Switch,
  Alert,
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconTags,
  IconBuildingSkyscraper,
  IconAlertCircle,
  IconCheck,
  IconCategory,
  IconLayersLinked,
  IconLock,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import {
  useSubcategories,
  useCategories,
  useOrganizationCategories,
  useCreateSubcategory,
  useUpdateSubcategory,
  useDeleteSubcategory,
} from '../api';
import { useOrganizations } from '../../organizations/api';
import type { Subcategory } from '../types';

export function SubcategoryList() {
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [formModalOpened, setFormModalOpened] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [deleteConfirmSubcategory, setDeleteConfirmSubcategory] = useState<Subcategory | null>(null);

  // Form inputs state
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Derive active organization with fallback to user.organizations
  const activeOrgId = useMemo(() => {
    if (selectedOrgId) return selectedOrgId;
    if (organizations && organizations.length > 0) return organizations[0].id;
    try {
      const stored = localStorage.getItem('current_store');
      if (stored) {
        const store = JSON.parse(stored);
        if (store.organization_id) return store.organization_id;
      }
    } catch {}
    try {
      const userStored = localStorage.getItem('user');
      if (userStored) {
        const u = JSON.parse(userStored);
        if (u.organizations && u.organizations.length > 0) {
          return u.organizations[0].id;
        }
      }
    } catch {}
    return '';
  }, [selectedOrgId, organizations]);

  const activeOrg = useMemo(() => {
    return organizations?.find((o) => o.id === activeOrgId);
  }, [organizations, activeOrgId]);

  // Role detection: Only Org Admins have full access
  const isOrgAdmin = useMemo(() => {
    try {
      const userStored = localStorage.getItem('user');
      const storeStored = localStorage.getItem('current_store');
      const user = userStored ? JSON.parse(userStored) : null;
      const store = storeStored ? JSON.parse(storeStored) : null;
      if (user?.is_org_admin || user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN') return true;
      if (store?.role === 'ORG_ADMIN') return true;
      if (user?.organizations?.some((org: any) => org.role === 'ORG_ADMIN')) return true;
      return false;
    } catch {
      return false;
    }
  }, []);

  // Fetch categories mapped to this organization
  const { data: orgCategories, isLoading: orgCatsLoading } = useOrganizationCategories(activeOrgId);
  const { data: platformCategories, isLoading: platformCatsLoading } = useCategories(undefined, activeOrgId);

  // Combined mapped categories for this organization
  const mappedCategories = useMemo(() => {
    if (orgCategories && orgCategories.length > 0) {
      return orgCategories
        .filter((oc) => oc.is_active && oc.category)
        .map((oc) => ({
          id: oc.category.id,
          name: oc.category.name,
        }));
    }
    if (platformCategories && platformCategories.length > 0) {
      return platformCategories
        .filter((c) => c.is_active)
        .map((c) => ({
          id: c.id,
          name: c.name,
        }));
    }
    return [];
  }, [orgCategories, platformCategories]);

  // Fetch subcategories
  const {
    data: subcategories,
    isLoading: subcategoriesLoading,
    error,
  } = useSubcategories(activeOrgId);

  // Mutations
  const createMutation = useCreateSubcategory();
  const updateMutation = useUpdateSubcategory();
  const deleteMutation = useDeleteSubcategory();

  // Filtered subcategories
  const filteredSubcategories = useMemo(() => {
    if (!subcategories) return [];
    return subcategories.filter((sub) => {
      // Platform category filter
      if (selectedCategoryId !== 'all' && sub.category_id !== selectedCategoryId) {
        return false;
      }
      // Status filter
      if (statusFilter === 'active' && !sub.is_active) return false;
      if (statusFilter === 'inactive' && sub.is_active) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = sub.name.toLowerCase().includes(q);
        const matchesSlug = sub.slug?.toLowerCase().includes(q);
        const matchesDesc = sub.description?.toLowerCase().includes(q);
        const matchesCategory = sub.category?.name.toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesDesc && !matchesCategory) {
          return false;
        }
      }
      return true;
    });
  }, [subcategories, selectedCategoryId, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    if (!subcategories) return { total: 0, active: 0, categoriesMapped: 0 };
    const total = subcategories.length;
    const active = subcategories.filter((s) => s.is_active).length;
    const categoryIds = new Set(subcategories.map((s) => s.category_id));
    return {
      total,
      active,
      categoriesMapped: categoryIds.size,
    };
  }, [subcategories]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingSubcategory(null);
    setFormCategoryId(selectedCategoryId !== 'all' ? selectedCategoryId : null);
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormDisplayOrder(0);
    setFormIsActive(true);
    setFormError(null);
    setFormModalOpened(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sub: Subcategory) => {
    setEditingSubcategory(sub);
    setFormCategoryId(sub.category_id);
    setFormName(sub.name);
    setFormSlug(sub.slug || '');
    setFormDescription(sub.description || '');
    setFormDisplayOrder(sub.display_order ?? 0);
    setFormIsActive(sub.is_active);
    setFormError(null);
    setFormModalOpened(true);
  };

  // Submit Create or Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategoryId) {
      setFormError('Please select a platform parent category.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Subcategory name is required.');
      return;
    }
    if (!activeOrgId) {
      setFormError('No organization selected.');
      return;
    }

    try {
      const generatedSlug = formSlug.trim()
        ? formSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
        : formName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');

      if (editingSubcategory) {
        await updateMutation.mutateAsync({
          id: editingSubcategory.id,
          data: {
            organization_id: activeOrgId,
            category_id: formCategoryId,
            name: formName.trim(),
            slug: generatedSlug,
            description: formDescription.trim() || null,
            display_order: Number(formDisplayOrder) || 0,
            is_active: formIsActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          organization_id: activeOrgId,
          category_id: formCategoryId,
          name: formName.trim(),
          slug: generatedSlug,
          description: formDescription.trim() || null,
          display_order: Number(formDisplayOrder) || 0,
          is_active: formIsActive,
        });
      }
      setFormModalOpened(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to save subcategory.';
      setFormError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  // Toggle active status directly
  const handleToggleActive = async (sub: Subcategory) => {
    try {
      await updateMutation.mutateAsync({
        id: sub.id,
        data: {
          is_active: !sub.is_active,
        },
      });
    } catch (err) {
      console.error('Failed to toggle subcategory status', err);
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!deleteConfirmSubcategory) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirmSubcategory.id);
      setDeleteConfirmSubcategory(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete subcategory.');
    }
  };

  // If user is not an Org Admin, display access restricted notice
  if (!isOrgAdmin) {
    return (
      <Box py="xl">
        <Card
          p="xl"
          radius="lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center',
            maxWidth: 640,
            margin: '40px auto',
          }}
        >
          <Center mb="md">
            <ThemeIcon size={56} radius="xl" color="red" variant="light">
              <IconLock size={32} />
            </ThemeIcon>
          </Center>
          <Title order={2} fw={800} mb="xs">
            Restricted Merchandising Access
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            Subcategory and taxonomy administration is strictly managed at the enterprise organization level.
            Store staff accounts operate in read-only POS and inventory lookup mode.
          </Text>
          <Badge size="lg" color="teal" variant="light">
            Active Role: Store Staff (Read-Only)
          </Badge>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Group justify="space-between" align="flex-end" mb="xl">
        <div>
          <Badge variant="light" color="brand" size="sm" radius="sm" mb={6}>
            Enterprise Taxonomy
          </Badge>
          <Title order={1} fw={800} style={{ letterSpacing: '-0.02em' }}>
            Subcategories
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Configure custom organizational classifications mapped to standardized platform categories.
          </Text>
        </div>

        <Group gap="sm">
          {/* Organization Switcher */}
          {organizations && organizations.length > 1 && (
            <Select
              placeholder="Organization"
              leftSection={<IconBuildingSkyscraper size={16} />}
              data={organizations.map((o) => ({ value: o.id, label: o.name }))}
              value={activeOrgId}
              onChange={(val) => setSelectedOrgId(val || '')}
              w={210}
            />
          )}

          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleOpenCreateModal}
            style={{
              background: 'var(--brand-gradient)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Add Subcategory
          </Button>
        </Group>
      </Group>

      {/* KPI Metric Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
        {/* Total Subcategories */}
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
              Subcategories
            </Text>
            <ThemeIcon size={34} radius="md" color="brand" variant="light">
              <IconCategory size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1}>
            {stats.total}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Custom classifications configured
          </Text>
        </Card>

        {/* Active Classifications */}
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
              Active Classifications
            </Text>
            <ThemeIcon size={34} radius="md" color="teal" variant="light">
              <IconCheck size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1} c="teal">
            {stats.active}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Available for product cataloging
          </Text>
        </Card>

        {/* Platform Categories Mapped */}
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
              Parent Categories Mapped
            </Text>
            <ThemeIcon size={34} radius="md" color="indigo" variant="light">
              <IconLayersLinked size={18} />
            </ThemeIcon>
          </Group>
          <Text size="28px" fw={800} lh={1.1} c="indigo">
            {stats.categoriesMapped}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Covered out of {mappedCategories.length} mapped categories
          </Text>
        </Card>
      </SimpleGrid>

      {/* Main Table Card */}
      <Card
        p="lg"
        radius="lg"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        {/* Filter Toolbar */}
        <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
          <Group gap="sm" style={{ flex: 1 }}>
            <TextInput
              placeholder="Search by subcategory name, slug, description..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 260 }}
            />

            {/* Category Filter */}
            <Select
              placeholder="All Platform Categories"
              leftSection={<IconTags size={16} />}
              data={[
                { value: 'all', label: 'All Platform Categories' },
                ...mappedCategories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={selectedCategoryId}
              onChange={(val) => setSelectedCategoryId(val || 'all')}
              w={240}
            />
          </Group>

          {/* Status Segmented Control */}
          <SegmentedControl
            size="sm"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
          />
        </Group>

        {/* Loading / Error States */}
        {subcategoriesLoading || orgsLoading ? (
          <Center h={240}>
            <Group gap="md">
              <Loader size="md" color="brand" />
              <Text size="sm" c="dimmed" fw={600}>
                Loading subcategories ledger...
              </Text>
            </Group>
          </Center>
        ) : error ? (
          <Card p="xl" radius="md" style={{ backgroundColor: 'var(--status-danger-bg)' }}>
            <Text c="red" fw={600}>
              Failed to load subcategories. Please refresh or verify API connection.
            </Text>
          </Card>
        ) : filteredSubcategories.length === 0 ? (
          <Center h={260} style={{ flexDirection: 'column' }}>
            <ThemeIcon size={48} radius="xl" color="gray" variant="light" mb="sm">
              <IconCategory size={24} />
            </ThemeIcon>
            <Text fw={700} size="md">
              No Subcategories Found
            </Text>
            <Text size="sm" c="dimmed" mt={4} mb="md" maw={400} ta="center">
              {searchQuery || selectedCategoryId !== 'all' || statusFilter !== 'all'
                ? 'Try clearing active filters to see all organizational subcategories.'
                : `Create custom subcategories under platform categories for ${activeOrg?.name || 'your organization'}.`}
            </Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenCreateModal}
              size="xs"
              variant="light"
              color="brand"
            >
              Add First Subcategory
            </Button>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 80 }}>Order</Table.Th>
                  <Table.Th>Subcategory</Table.Th>
                  <Table.Th>Platform Category</Table.Th>
                  <Table.Th>Slug</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ width: 80, textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredSubcategories.map((sub) => {
                  const parentCategory =
                    sub.category || mappedCategories.find((c) => c.id === sub.category_id);
                  return (
                    <Table.Tr key={sub.id}>
                      {/* Display Order */}
                      <Table.Td>
                        <Badge size="xs" variant="outline" color="gray">
                          #{sub.display_order ?? 0}
                        </Badge>
                      </Table.Td>

                      {/* Subcategory Name & Description */}
                      <Table.Td>
                        <Text fw={700} size="sm">
                          {sub.name}
                        </Text>
                        {sub.description && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {sub.description}
                          </Text>
                        )}
                      </Table.Td>

                      {/* Platform Category (Parent) */}
                      <Table.Td>
                        <Badge variant="light" color="brand" size="sm" radius="sm">
                          {parentCategory?.name || 'Platform Master'}
                        </Badge>
                      </Table.Td>

                      {/* Slug */}
                      <Table.Td>
                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                          {sub.slug || '—'}
                        </Text>
                      </Table.Td>

                      {/* Active Status Toggle */}
                      <Table.Td>
                        <Group gap="xs">
                          <Switch
                            size="sm"
                            color="teal"
                            checked={sub.is_active}
                            onChange={() => handleToggleActive(sub)}
                          />
                          <Badge size="xs" variant="dot" color={sub.is_active ? 'green' : 'gray'}>
                            {sub.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </Group>
                      </Table.Td>

                      {/* Action Menu */}
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Menu shadow="md" width={170} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={() => handleOpenEditModal(sub)}
                            >
                              Edit Details
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconCheck size={14} />}
                              onClick={() => handleToggleActive(sub)}
                            >
                              {sub.is_active ? 'Mark Inactive' : 'Mark Active'}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => setDeleteConfirmSubcategory(sub)}
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
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Create / Edit Subcategory Modal */}
      <Modal
        opened={formModalOpened}
        onClose={() => setFormModalOpened(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="brand" variant="light">
              <IconCategory size={16} />
            </ThemeIcon>
            <Text fw={700} size="md">
              {editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}
            </Text>
          </Group>
        }
        radius="md"
        size="md"
      >
        <form onSubmit={handleSubmitForm}>
          <Stack gap="md" pt="xs">
            {formError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {formError}
              </Alert>
            )}

            <Select
              label="Parent Platform Category"
              placeholder={
                orgCatsLoading || platformCatsLoading
                  ? 'Loading mapped categories...'
                  : mappedCategories.length === 0
                  ? 'No categories mapped to this organization'
                  : 'Select category mapped to org'
              }
              data={mappedCategories.map((c) => ({ value: c.id, label: c.name }))}
              value={formCategoryId}
              onChange={setFormCategoryId}
              required
              searchable
              nothingFoundMessage="No categories mapped to organization"
            />

            <TextInput
              label="Subcategory Name"
              placeholder="e.g. Jeans, Casual Shirts, Running Shoes"
              value={formName}
              onChange={(e) => setFormName(e.currentTarget.value)}
              required
            />

            <TextInput
              label="Slug (Optional URL key)"
              placeholder="e.g. jeans, casual-shirts"
              value={formSlug}
              onChange={(e) => setFormSlug(e.currentTarget.value)}
              description="Leave blank to auto-generate from name"
            />

            <Textarea
              label="Description"
              placeholder="Internal merchandising guidelines or subcategory notes..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.currentTarget.value)}
              rows={3}
            />

            <Group justify="space-between" align="center">
              <NumberInput
                label="Display Order"
                value={formDisplayOrder}
                onChange={(val) => setFormDisplayOrder(Number(val) || 0)}
                min={0}
                max={999}
                w={140}
              />

              <Switch
                label="Active Status"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.currentTarget.checked)}
                color="teal"
                mt={20}
              />
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setFormModalOpened(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
                style={{
                  background: 'var(--brand-gradient)',
                }}
              >
                {editingSubcategory ? 'Save Changes' : 'Create Subcategory'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!deleteConfirmSubcategory}
        onClose={() => setDeleteConfirmSubcategory(null)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="red" variant="light">
              <IconTrash size={16} />
            </ThemeIcon>
            <Text fw={700} size="md">
              Delete Subcategory
            </Text>
          </Group>
        }
        radius="md"
        size="sm"
      >
        <Stack gap="md" pt="xs">
          <Text size="sm">
            Are you sure you want to permanently delete{' '}
            <Text component="span" fw={700} c="red">
              {deleteConfirmSubcategory?.name}
            </Text>
            ?
          </Text>
          <Text size="xs" c="dimmed">
            If products are currently classified under this subcategory, their classification may be cleared or blocked.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setDeleteConfirmSubcategory(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleConfirmDelete}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
