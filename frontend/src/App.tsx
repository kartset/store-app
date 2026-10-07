import { Button, Container, Group, Title, Text, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store/useAppStore';

function App() {
  const { t, i18n } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);

  return (
    <Container size="sm" mt={50}>
      <Stack align="center" gap="lg">
        <Title order={1} c="blue">Store App Frontend</Title>
        <Text size="lg" c="dimmed">
          {t('welcome')}
        </Text>

        <Group>
          <Button variant="filled" color="blue" onClick={toggleTheme}>
            Toggle Theme (Current: {theme})
          </Button>
          
          <Button 
            variant="outline" 
            color="teal"
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')}
          >
            Switch Language ({i18n.language})
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}

export default App;
