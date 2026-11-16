import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Select,
  Switch,
  Group,
  Button,
  Alert,
  Text,
  Paper,
} from '@mantine/core';
import { IconAlertCircle, IconUserCheck } from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import { useUpdateStaff } from '../api';
import type { StaffMember } from '../types';

interface EditStaffModalProps {
  staff: StaffMember | null;
  opened: boolean;
  onClose: () => void;
}

export function EditStaffModal({ staff, opened, onClose }: EditStaffModalProps) {
  const { data: stores = [] } = useStores();
  const updateMutation = useUpdateStaff();

  const [role, setRole] = useState('');
  const [storeId, setStoreId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (staff) {
      setRole(staff.role);
      setStoreId(staff.store?.id || '');
      setIsActive(staff.is_active);
      setErrorMessage(null);
    }
  }, [staff]);

  if (!staff) return null;

  const isStoreStaff = staff.type === 'store';

  const storeOptions = stores.map((s) => ({ label: s.name, value: s.id }));

  const storeRoleOptions = [
    { label: 'Cashier (Billing & Register)', value: 'CASHIER' },
    { label: 'Store Manager (Inventory & Shifts)', value: 'MANAGER' },
    { label: 'Store Admin (Store Outlet Admin)', value: 'ADMIN' },
  ];

  const orgRoleOptions = [
    { label: 'Catalog Manager (HQ Master Catalog)', value: 'CATALOG_MANAGER' },
    { label: 'Auditor (Read-Only Financials)', value: 'AUDITOR' },
    { label: 'Organization Admin (Full Access)', value: 'ORG_ADMIN' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    updateMutation.mutate(
      {
        id: staff.id,
        payload: {
          role,
          store_id: isStoreStaff && storeId ? storeId : undefined,
          is_active: isActive,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: any) => {
          const detail =
            err.response?.data?.role?.[0] ||
            err.response?.data?.store_id?.[0] ||
            err.response?.data?.is_active?.[0] ||
            err.response?.data?.error ||
            err.response?.data?.detail ||
            'Failed to update staff member.';
          setErrorMessage(detail);
        },
      }
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconUserCheck size={20} color="var(--brand-primary)" />
          <Text fw={700} size="md">
            Manage Staff Member
          </Text>
        </Group>
      }
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {errorMessage && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {errorMessage}
            </Alert>
          )}

          <Paper p="sm" withBorder radius="md">
            <Stack gap={4}>
              <Text fw={700} size="sm">
                {staff.user.first_name} {staff.user.last_name || ''}
              </Text>
              <Text size="xs" c="dimmed">
                {staff.user.email}
              </Text>
              <Text size="xs" c="dimmed">
                Current Affiliation:{' '}
                <strong>
                  {isStoreStaff ? `Store: ${staff.store?.name || 'Unassigned'}` : 'Organization HQ'}
                </strong>
              </Text>
            </Stack>
          </Paper>

          {isStoreStaff && (
            <Select
              label="Assigned Store Outlet"
              description="Reassign this worker to a different store within the organization"
              required
              data={storeOptions}
              value={storeId}
              onChange={(val) => setStoreId(val || '')}
            />
          )}

          <Select
            label="Staff Role"
            required
            data={isStoreStaff ? storeRoleOptions : orgRoleOptions}
            value={role}
            onChange={(val) => setRole(val || '')}
          />

          <Switch
            label="Active Account Status"
            description="Inactive staff cannot log into the store terminal or access resources"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" color="brand" loading={updateMutation.isPending} style={{ fontWeight: 700 }}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
