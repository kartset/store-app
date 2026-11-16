import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  PasswordInput,
  Select,
  Radio,
  Group,
  Button,
  Alert,
  Text,
  Paper,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconBuildingStore,
  IconBuilding,
  IconRefresh,
} from '@tabler/icons-react';
import { useStores } from '../../stores/api';
import { checkStaffEmail, useOnboardStaff } from '../api';
import type { CheckEmailResponse } from '../types';

interface OnboardStaffModalProps {
  opened: boolean;
  onClose: () => void;
}

export function OnboardStaffModal({ opened, onClose }: OnboardStaffModalProps) {
  const { data: stores = [] } = useStores();
  const onboardMutation = useOnboardStaff();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [scope, setScope] = useState<'store' | 'organization'>('store');
  const [storeId, setStoreId] = useState<string>('');
  const [role, setRole] = useState<string>('CASHIER');

  // Pre-check state
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckEmailResponse | null>(null);
  const [reassignConfirmed, setReassignConfirmed] = useState(false);
  const [reactivateConfirmed, setReactivateConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setScope('store');
    setStoreId('');
    setRole('CASHIER');
    setCheckResult(null);
    setReassignConfirmed(false);
    setReactivateConfirmed(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleEmailBlur = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;

    setIsChecking(true);
    setErrorMessage(null);
    try {
      const res = await checkStaffEmail(trimmed);
      setCheckResult(res);
      if (res.user) {
        if (res.user.first_name) setFirstName(res.user.first_name);
        if (res.user.last_name) setLastName(res.user.last_name);
      }
      if (res.status === 'same_org') {
        setReassignConfirmed(true);
      } else if (res.status === 'deactivated') {
        setReactivateConfirmed(true);
      }
    } catch {
      // ignore
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (checkResult?.status === 'other_org') {
      setErrorMessage('User belongs to another organization and cannot be onboarded.');
      return;
    }

    if (scope === 'store' && !storeId) {
      setErrorMessage('Please select a store outlet.');
      return;
    }

    if (!checkResult?.exists && (!password || password.length < 8)) {
      setErrorMessage('Password must be at least 8 characters long for new users.');
      return;
    }

    onboardMutation.mutate(
      {
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password: password ? password.trim() : undefined,
        scope,
        store_id: scope === 'store' ? storeId : null,
        role,
        reassign_if_exists: reassignConfirmed,
        reactivate_if_deactivated: reactivateConfirmed,
      },
      {
        onSuccess: () => {
          handleClose();
        },
        onError: (err: any) => {
          const data = err.response?.data;
          if (err.response?.status === 409 && data?.requires_confirmation) {
            if (data.action === 'reassign') {
              setReassignConfirmed(true);
              setErrorMessage(data.email || 'User is already assigned in this org. Click confirm to reassign.');
            } else if (data.action === 'reactivate') {
              setReactivateConfirmed(true);
              setErrorMessage(data.email || 'User was deactivated. Click confirm to reactivate.');
            }
          } else {
            const detail =
              data?.email?.[0] ||
              data?.password?.[0] ||
              data?.role?.[0] ||
              data?.store_id?.[0] ||
              data?.detail ||
              'Failed to onboard staff member.';
            setErrorMessage(detail);
          }
        },
      }
    );
  };

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

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconBuildingStore size={20} color="var(--brand-primary)" />
          <Text fw={700} size="md">
            Onboard New Staff Member
          </Text>
        </Group>
      }
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {errorMessage && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {errorMessage}
            </Alert>
          )}

          {/* User Account Details */}
          <Paper p="sm" withBorder radius="md">
            <Stack gap="xs">
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Account Information
              </Text>

              <TextInput
                label="Email Address"
                placeholder="colleague@store.com"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setCheckResult(null);
                  setReassignConfirmed(false);
                  setReactivateConfirmed(false);
                }}
                onBlur={handleEmailBlur}
                rightSection={
                  isChecking ? (
                    <IconRefresh size={14} className="animate-spin" />
                  ) : checkResult?.status === 'new' ? (
                    <IconCheck size={16} color="green" />
                  ) : null
                }
              />

              {/* Status Notifications based on checkResult */}
              {checkResult?.status === 'other_org' && (
                <Alert color="red" variant="light" title="Organization Conflict">
                  This user is already registered with another organization. A user cannot belong to multiple organizations.
                </Alert>
              )}

              {checkResult?.status === 'same_org' && (
                <Alert color="yellow" variant="light" title="User Already Assigned">
                  <Text size="xs">
                    {checkResult.message}
                  </Text>
                  <Text size="xs" mt={4} fw={600}>
                    Onboarding will reassign this user to the new store/role selected below.
                  </Text>
                </Alert>
              )}

              {checkResult?.status === 'deactivated' && (
                <Alert color="orange" variant="light" title="Previously Deactivated Staff">
                  <Text size="xs">
                    This user was previously deactivated in your organization. Submitting will reactivate their account with the chosen assignment.
                  </Text>
                </Alert>
              )}

              <Group grow>
                <TextInput
                  label="First Name"
                  placeholder="Jane"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Group>

              <PasswordInput
                label={checkResult?.exists ? 'New Password (Optional)' : 'Initial Password'}
                placeholder={checkResult?.exists ? 'Leave blank to retain current password' : 'Min 8 characters'}
                required={!checkResult?.exists}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                description={
                  !checkResult?.exists
                    ? 'User will be prompted to change this password upon their first login.'
                    : undefined
                }
              />
            </Stack>
          </Paper>

          {/* Scope & Role Assignment */}
          <Paper p="sm" withBorder radius="md">
            <Stack gap="xs">
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Assignment & Permissions
              </Text>

              <Radio.Group
                value={scope}
                onChange={(val) => {
                  const s = val as 'store' | 'organization';
                  setScope(s);
                  setRole(s === 'store' ? 'CASHIER' : 'CATALOG_MANAGER');
                }}
                label="Assign To"
              >
                <Group mt="xs" gap="lg">
                  <Radio
                    value="store"
                    label={
                      <Group gap="xs">
                        <IconBuildingStore size={15} />
                        <Text size="sm">Store Outlet</Text>
                      </Group>
                    }
                  />
                  <Radio
                    value="organization"
                    label={
                      <Group gap="xs">
                        <IconBuilding size={15} />
                        <Text size="sm">Organization HQ</Text>
                      </Group>
                    }
                  />
                </Group>
              </Radio.Group>

              {scope === 'store' ? (
                <Stack gap="xs" mt="xs">
                  <Select
                    label="Retail Store Outlet"
                    placeholder="Select Store"
                    required
                    data={storeOptions}
                    value={storeId}
                    onChange={(val) => setStoreId(val || '')}
                  />

                  <Select
                    label="Store Role"
                    required
                    data={storeRoleOptions}
                    value={role}
                    onChange={(val) => setRole(val || 'CASHIER')}
                  />
                </Stack>
              ) : (
                <Stack gap="xs" mt="xs">
                  <Select
                    label="Organization Role"
                    required
                    data={orgRoleOptions}
                    value={role}
                    onChange={(val) => setRole(val || 'CATALOG_MANAGER')}
                  />
                </Stack>
              )}
            </Stack>
          </Paper>

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="brand"
              loading={onboardMutation.isPending}
              disabled={checkResult?.status === 'other_org'}
              style={{ fontWeight: 700 }}
            >
              {checkResult?.status === 'same_org'
                ? 'Confirm Reassignment'
                : checkResult?.status === 'deactivated'
                ? 'Reactivate & Assign'
                : 'Onboard Staff Member'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
