import {
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Stack,
  Box,
  Group,
  ThemeIcon,
  Alert,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useLogin } from '../api/login';
import { useNavigate } from 'react-router-dom';
import {
  IconBuildingStore,
  IconMail,
  IconLock,
  IconAlertCircle,
  IconShieldLock,
  IconArrowRight,
  IconSparkles,
} from '@tabler/icons-react';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email({ message: 'Enter a valid store email' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export function LoginForm() {
  const loginMutation = useLogin();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: zodResolver(schema),
  });

  const handleSubmit = (values: typeof form.values) => {
    setAuthError(null);
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          if (data.user.current_store) {
            localStorage.setItem('current_store', JSON.stringify(data.user.current_store));
          }
        }
        navigate('/');
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.detail || 'Invalid credentials or unauthorized account';
        setAuthError(message);
      },
    });
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: 'var(--bg-page)',
      }}
    >
      {/* Left Visual Showcase Panel (Desktop) */}
      <Box
        style={{
          flex: '1 1 55%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '3rem',
          background: 'linear-gradient(145deg, #0b0f19 0%, #171c2f 50%, #0d1222 100%)',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
        }}
        visibleFrom="md"
      >
        {/* Ambient Glow Circles */}
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-10%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-10%',
            left: '-10%',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top Brand Header */}
        <Group justify="space-between" style={{ zIndex: 1 }}>
          <Group gap="xs">
            <ThemeIcon
              size={42}
              radius="md"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
              }}
            >
              <IconBuildingStore size={24} color="#fff" />
            </ThemeIcon>
            <div>
              <Text fw={800} size="xl" style={{ letterSpacing: '-0.02em', color: '#fff' }}>
                Store<span style={{ color: '#818cf8' }}>Craft</span>
              </Text>
              <Text size="xs" c="dimmed" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Retail Operating System
              </Text>
            </div>
          </Group>

          <Badge
            variant="filled"
            color="indigo"
            radius="pill"
            size="md"
            leftSection={<span className="pulse-dot" style={{ backgroundColor: '#10b981' }} />}
            style={{ textTransform: 'none', fontWeight: 600, background: 'rgba(99, 102, 241, 0.2)' }}
          >
            Terminal v2.4 Live
          </Badge>
        </Group>

        {/* Center Visual Showcase */}
        <Box style={{ zIndex: 1, textAlign: 'center', margin: '2rem 0' }}>
          <Box
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '480px',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <img
              src="/assets/retail_hero.jpg"
              alt="StoreCraft Retail Operating System"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                transform: 'scale(1.02)',
                transition: 'transform 600ms ease',
              }}
            />
          </Box>
        </Box>

        {/* Bottom Tagline & Features */}
        <Box style={{ zIndex: 1 }}>
          <Group gap="xs" mb="xs">
            <IconSparkles size={18} color="#818cf8" />
            <Text size="sm" fw={600} c="indigo.2">
              Enterprise Store Staff & Operations Gateway
            </Text>
          </Group>
          <Text size="sm" c="gray.4" maw={520}>
            Seamless inventory sync, real-time checkout registers, and multi-tenant store control built
            exclusively for verified store staff and franchise operators.
          </Text>
        </Box>
      </Box>

      {/* Right Sign-in Form Panel */}
      <Box
        style={{
          flex: '1 1 45%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem',
        }}
      >
        <Box w="100%" maw={420}>
          {/* Mobile Brand Mark */}
          <Group hiddenFrom="md" mb="xl">
            <ThemeIcon size={38} radius="md" color="brand">
              <IconBuildingStore size={22} />
            </ThemeIcon>
            <Text fw={800} size="lg">
              Store<span style={{ color: 'var(--brand-primary)' }}>Craft</span>
            </Text>
          </Group>

          <Box mb="xl">
            <Title order={2} fw={800} style={{ letterSpacing: '-0.02em' }}>
              Sign in to Terminal
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Enter your assigned store credentials to access your registers and catalog.
            </Text>
          </Box>

          {authError && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              title="Access Denied"
              color="red"
              radius="md"
              mb="lg"
              variant="light"
            >
              {authError}
            </Alert>
          )}

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Staff Email"
                placeholder="cashier@store.com"
                leftSection={<IconMail size={16} stroke={1.5} color="var(--text-muted)" />}
                {...form.getInputProps('email')}
              />

              <PasswordInput
                label="Password"
                placeholder="Your staff password"
                leftSection={<IconLock size={16} stroke={1.5} color="var(--text-muted)" />}
                {...form.getInputProps('password')}
              />

              <Button
                type="submit"
                fullWidth
                size="md"
                mt="md"
                loading={loginMutation.isPending}
                rightSection={<IconArrowRight size={18} />}
                style={{
                  background: 'var(--brand-gradient)',
                  boxShadow: 'var(--shadow-glow)',
                }}
              >
                Sign In to Store
              </Button>
            </Stack>
          </form>

          {/* Security & Access Info Card */}
          <Box
            mt="xl"
            p="md"
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Group gap="xs" align="flex-start">
              <ThemeIcon size={24} radius="xl" color="brand" variant="light">
                <IconShieldLock size={14} />
              </ThemeIcon>
              <Box style={{ flex: 1 }}>
                <Text size="xs" fw={600} c="var(--text-primary)">
                  Role-Gated Access Control
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  Only users associated with an active store staff membership (Admin, Manager, Cashier) can sign in.
                </Text>
              </Box>
            </Group>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
