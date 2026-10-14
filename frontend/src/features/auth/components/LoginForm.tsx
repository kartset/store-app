import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useLogin } from '../api/login';
import { useNavigate } from 'react-router-dom';

const schema = z.object({
  email: z.string().email({ message: 'Invalid email' }),
  password: z.string().min(6, { message: 'Password must have at least 6 characters' }),
});

export function LoginForm() {
  const loginMutation = useLogin();
  const navigate = useNavigate();

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: zodResolver(schema),
  });

  const handleSubmit = (values: typeof form.values) => {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        // Store JWT tokens securely
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          if (data.user.current_store) {
            localStorage.setItem('current_store', JSON.stringify(data.user.current_store));
          }
        }
        // Navigate to the Dashboard page
        navigate('/');
      },
      onError: (error: any) => {
        const message = error?.response?.data?.detail || 'Invalid credentials';
        form.setFieldError('email', message);
      },
    });
  };

  return (
    <Paper radius="md" p="xl" withBorder w={400} mx="auto" mt={100}>
      <Title order={2} ta="center" mb="md">
        Welcome Back
      </Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="Email"
            placeholder="your@email.com"
            {...form.getInputProps('email')}
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            {...form.getInputProps('password')}
          />

          <Button type="submit" fullWidth mt="xl" loading={loginMutation.isPending}>
            Sign in
          </Button>
        </Stack>
      </form>
      <Text ta="center" mt="md" size="sm" c="dimmed">
        Don't have an account? Contact your administrator.
      </Text>
    </Paper>
  );
}
