import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Center, Loader, Stack, Text, Title, Button, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const access = searchParams.get('access');
      const refresh = searchParams.get('refresh');
      const userRaw = searchParams.get('user');

      if (!access || !refresh) {
        setError('Missing authentication tokens in callback URL.');
        return;
      }

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      if (userRaw) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userRaw));
          localStorage.setItem('user', JSON.stringify(userObj));
          if (userObj.current_store) {
            localStorage.setItem('current_store', JSON.stringify(userObj.current_store));
          }
        } catch {
          // If JSON parse fails, ignore user object parsing
        }
      }

      // Short delay for UI smoothness before redirecting to dashboard
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);

      return () => clearTimeout(timer);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete authentication handoff.');
    }
  }, [searchParams, navigate]);

  if (error) {
    return (
      <Center style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
        <Card withBorder padding="xl" radius="md" style={{ maxWidth: 450, width: '100%' }}>
          <Stack gap="md">
            <Alert icon={<IconAlertCircle size={18} />} color="red" title="Authentication Error">
              {error}
            </Alert>
            <Button fullWidth onClick={() => navigate('/login')}>
              Return to Login
            </Button>
          </Stack>
        </Card>
      </Center>
    );
  }

  return (
    <Center style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      <Card withBorder padding="xl" radius="md" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" color="blue" />
          <Title order={3}>Completing Sign-In...</Title>
          <Text c="dimmed" size="sm">
            Setting up your session. Redirecting you to the Store App dashboard...
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
