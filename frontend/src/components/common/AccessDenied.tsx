import { Box, Paper, Title, Text, Button, Stack, ThemeIcon, Group } from '@mantine/core';
import { IconShieldLock, IconArrowLeft, IconCashRegister } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  requiredRole?: string;
  fallbackUrl?: string;
}

export function AccessDenied({
  requiredRole = 'Organization Administrator',
  fallbackUrl = '/pos',
}: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem 1rem',
      }}
    >
      <Paper
        withBorder
        p="xl"
        radius="lg"
        style={{
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <Stack align="center" gap="md">
          <ThemeIcon size={64} radius="xl" color="red" variant="light">
            <IconShieldLock size={36} />
          </ThemeIcon>

          <Box>
            <Title order={2} style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Access Restricted
            </Title>
            <Text c="dimmed" size="sm" mt="xs">
              You do not have the required permissions to view this page. This section is restricted to{' '}
              <Text component="span" fw={700} c="red.6">
                {requiredRole}
              </Text>{' '}
              accounts.
            </Text>
          </Box>

          <Group justify="center" gap="sm" mt="md">
            <Button
              variant="default"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(-1)}
              style={{ fontWeight: 600 }}
            >
              Go Back
            </Button>
            <Button
              color="brand"
              leftSection={<IconCashRegister size={16} />}
              onClick={() => navigate(fallbackUrl)}
              style={{ fontWeight: 700 }}
            >
              Return to POS Terminal
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}
