import { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  PasswordInput,
  Button,
  Alert,
  Title,
  Group,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertCircle, IconKey } from '@tabler/icons-react';
import { useChangePassword } from '../../staff/api';

interface MustChangePasswordModalProps {
  opened: boolean;
  onSuccess: () => void;
}

export function MustChangePasswordModal({ opened, onSuccess }: MustChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const changePasswordMutation = useChangePassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!oldPassword) {
      setErrorMessage('Please enter your current temporary password.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }
    if (oldPassword === newPassword) {
      setErrorMessage('New password cannot be the same as your current password.');
      return;
    }

    changePasswordMutation.mutate(
      { old_password: oldPassword, new_password: newPassword },
      {
        onSuccess: () => {
          try {
            const stored = localStorage.getItem('user');
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.must_change_password = false;
              localStorage.setItem('user', JSON.stringify(parsed));
            }
          } catch {
            // ignore
          }
          onSuccess();
        },
        onError: (err: any) => {
          const detail =
            err.response?.data?.old_password?.[0] ||
            err.response?.data?.new_password?.[0] ||
            err.response?.data?.detail ||
            'Failed to update password. Please check your credentials.';
          setErrorMessage(detail);
        },
      }
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
      title={
        <Group gap="xs">
          <ThemeIcon color="orange" variant="light" size="md">
            <IconKey size={18} />
          </ThemeIcon>
          <Title order={4}>Password Update Required</Title>
        </Group>
      }
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This is your first login. For security compliance, please replace your initial temporary password with a secure personal password.
          </Text>

          {errorMessage && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Unable to update">
              {errorMessage}
            </Alert>
          )}

          <PasswordInput
            label="Current Temporary Password"
            placeholder="Enter current password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />

          <PasswordInput
            label="New Password"
            placeholder="Minimum 8 characters"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <PasswordInput
            label="Confirm New Password"
            placeholder="Re-enter new password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button
            type="submit"
            color="brand"
            fullWidth
            loading={changePasswordMutation.isPending}
            style={{ fontWeight: 700 }}
          >
            Update Password & Continue
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
