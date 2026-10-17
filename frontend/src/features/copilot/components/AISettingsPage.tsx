import { useState } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  SegmentedControl,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Badge,
  Tabs,
  Card,
  SimpleGrid,
  ThemeIcon,
  Table,
  Box,
  Divider,
} from '@mantine/core';
import {
  IconSparkles,
  IconCheck,
  IconAlertCircle,
  IconTools,
  IconServer,
  IconShieldCheck,
  IconExternalLink,
  IconTopologyStarRing3,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useCopilotStore } from '../store';
import { useTestAIConnection, useMCPToolsList } from '../api';
import type { AIProvider } from '../types';

const POPULAR_MODELS: Record<AIProvider, { value: string; label: string; desc: string }[]> = {
  openrouter: [
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', desc: 'Fast, intelligent & cost-effective' },
    { value: 'openai/gpt-4o', label: 'GPT-4o (OpenAI)', desc: 'Flagship multimodal reasoning' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (Anthropic)', desc: 'Superior analytical synthesis' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (Meta)', desc: 'High performance open-weights' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google)', desc: 'Ultra-low latency reasoning' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini', desc: 'Recommended default for retail copilot' },
    { value: 'gpt-4o', label: 'gpt-4o', desc: 'Full capacity reasoning model' },
    { value: 'o3-mini', label: 'o3-mini', desc: 'STEM and operational reasoning model' },
  ],
  custom: [
    { value: 'llama3:latest', label: 'Ollama Llama 3', desc: 'Self-hosted local inference' },
    { value: 'mistral:latest', label: 'Mistral 7B', desc: 'Fast edge deployment' },
  ],
};

export function AISettingsPage() {
  const { settings, updateSettings, openDrawer } = useCopilotStore();

  const [provider, setProvider] = useState<AIProvider>(settings.provider);
  const [model, setModel] = useState<string>(settings.model);
  const [apiKey, setApiKey] = useState<string>(settings.apiKey);
  const [customEndpoint, setCustomEndpoint] = useState<string>(settings.customEndpoint || '');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    sample?: string;
    error?: string;
  } | null>(null);

  const testMutation = useTestAIConnection();
  const { data: toolsData } = useMCPToolsList();

  const handleProviderChange = (val: string) => {
    const prov = val as AIProvider;
    setProvider(prov);
    // Switch to first suggested model for that provider
    const firstSuggested = POPULAR_MODELS[prov]?.[0]?.value || '';
    setModel(firstSuggested);
  };

  const handleSave = () => {
    updateSettings({
      provider,
      model,
      apiKey: apiKey.trim(),
      customEndpoint: customEndpoint.trim(),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const res = await testMutation.mutateAsync({
        provider,
        model,
        api_key: apiKey.trim(),
      });
      setTestResult({
        success: res.success,
        message: res.message,
        sample: res.sample_response,
        error: res.error,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.response?.data?.error || err.message || 'Connection test failed',
      });
    }
  };

  return (
    <Container size="xl" py="xl">
      {/* Page Header */}
      <Stack gap="xs" mb="lg">
        <Group justify="space-between" align="center">
          <div>
            <Group gap="xs">
              <ThemeIcon
                size={38}
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <IconSparkles size={22} color="#fff" />
              </ThemeIcon>
              <div>
                <Title order={2} fw={800} style={{ letterSpacing: '-0.02em' }}>
                  AI & Model Context Protocol (MCP) Settings
                </Title>
                <Text size="sm" c="dimmed">
                  Manage retail AI providers, model parameters, API keys, and inspect native ERP MCP tools.
                </Text>
              </div>
            </Group>
          </div>

          <Button
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet', deg: 45 }}
            leftSection={<IconSparkles size={16} />}
            onClick={openDrawer}
            style={{ fontWeight: 700 }}
          >
            Open Copilot Assistant
          </Button>
        </Group>
      </Stack>

      <Tabs defaultValue="provider" radius="md">
        <Tabs.List mb="lg">
          <Tabs.Tab value="provider" leftSection={<IconTopologyStarRing3 size={16} />}>
            AI Provider & LLM Gateway
          </Tabs.Tab>
          <Tabs.Tab value="mcp-tools" leftSection={<IconTools size={16} />}>
            Store App MCP Tool Registry ({toolsData?.count || 7})
          </Tabs.Tab>
          <Tabs.Tab value="offline-mode" leftSection={<IconServer size={16} />}>
            Offline Tool Execution Protocol
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: AI Provider & LLM Gateway */}
        <Tabs.Panel value="provider">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {/* Left Col: Configuration Form */}
            <Box style={{ gridColumn: 'span 2' }}>
              <Paper withBorder p="xl" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Stack gap="lg">
                  <div>
                    <Text fw={700} size="md" mb={4}>
                      1. Select AI Gateway / Provider
                    </Text>
                    <Text size="xs" c="dimmed" mb="xs">
                      Choose between OpenRouter (recommended for unified multi-provider routing), direct OpenAI, or custom local inference.
                    </Text>
                    <SegmentedControl
                      value={provider}
                      onChange={handleProviderChange}
                      data={[
                        { label: 'OpenRouter (Multi-Model)', value: 'openrouter' },
                        { label: 'OpenAI Direct', value: 'openai' },
                        { label: 'Custom / Ollama', value: 'custom' },
                      ]}
                      fullWidth
                    />
                  </div>

                  <Divider />

                  <div>
                    <Text fw={700} size="md" mb={4}>
                      2. Target Language Model
                    </Text>
                    <Text size="xs" c="dimmed" mb="xs">
                      Type a model identifier or pick one of the recommended models below:
                    </Text>
                    <TextInput
                      value={model}
                      onChange={(e) => setModel(e.currentTarget.value)}
                      placeholder="e.g. openai/gpt-4o-mini"
                      radius="md"
                    />

                    <Group gap="xs" mt="xs">
                      <Text size="11px" fw={600} c="dimmed">
                        Popular options:
                      </Text>
                      {(POPULAR_MODELS[provider] || []).map((m) => (
                        <Badge
                          key={m.value}
                          variant={model === m.value ? 'filled' : 'light'}
                          color="indigo"
                          size="sm"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setModel(m.value)}
                        >
                          {m.label}
                        </Badge>
                      ))}
                    </Group>
                  </div>

                  <Divider />

                  <div>
                    <Text fw={700} size="md" mb={4}>
                      3. Provider API Key
                    </Text>
                    <Text size="xs" c="dimmed" mb="xs">
                      API keys are stored exclusively in your browser's private local storage. They are never committed to git or exposed to external databases.
                    </Text>
                    <PasswordInput
                      value={apiKey}
                      onChange={(e) => setApiKey(e.currentTarget.value)}
                      placeholder={
                        provider === 'openrouter'
                          ? 'sk-or-v1-...'
                          : provider === 'openai'
                          ? 'sk-proj-...'
                          : 'Optional for local Ollama'
                      }
                      radius="md"
                    />
                  </div>

                  {provider === 'custom' && (
                    <div>
                      <Text fw={700} size="md" mb={4}>
                        Custom Endpoint URL
                      </Text>
                      <TextInput
                        value={customEndpoint}
                        onChange={(e) => setCustomEndpoint(e.currentTarget.value)}
                        placeholder="http://localhost:11434/v1/chat/completions"
                        radius="md"
                      />
                    </div>
                  )}

                  {saveSuccess && (
                    <Alert color="teal" icon={<IconCheck size={16} />} radius="md">
                      AI Settings saved successfully! The Copilot drawer is now configured.
                    </Alert>
                  )}

                  {testResult && (
                    <Alert
                      color={testResult.success ? 'teal' : 'red'}
                      icon={testResult.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                      title={testResult.success ? 'Connection Succeeded' : 'Connection Failed'}
                      radius="md"
                    >
                      <Text size="xs">
                        {testResult.message || testResult.error}
                      </Text>
                      {testResult.sample && (
                        <Box mt="xs" p="xs" style={{ backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                          <Text size="11px" fw={600} c="dimmed">Model Sample Response:</Text>
                          <Text size="xs" ff="monospace">{testResult.sample}</Text>
                        </Box>
                      )}
                    </Alert>
                  )}

                  <Group justify="space-between" mt="sm">
                    <Button
                      variant="outline"
                      color="indigo"
                      onClick={handleTestConnection}
                      loading={testMutation.isPending}
                      disabled={!apiKey.trim()}
                      leftSection={<IconServer size={16} />}
                    >
                      Test Connection
                    </Button>

                    <Button
                      variant="filled"
                      color="indigo"
                      onClick={handleSave}
                      leftSection={<IconCheck size={16} />}
                    >
                      Save Configuration
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Box>

            {/* Right Col: Info Cards */}
            <Stack gap="md">
              <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Group gap="xs" mb="xs">
                  <ThemeIcon size={28} radius="md" color="teal" variant="light">
                    <IconShieldCheck size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="sm">
                    Client-Side Security
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                  StoreCraft adheres to strict security standards. API keys provided here are held strictly client-side and proxied with ephemeral header injection through <code>/api/mcp/chat/</code>.
                </Text>
              </Card>

              <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Group gap="xs" mb="xs">
                  <ThemeIcon size={28} radius="md" color="indigo" variant="light">
                    <IconExternalLink size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="sm">
                    Get an API Key
                  </Text>
                </Group>
                <Stack gap="xs">
                  <Button
                    component="a"
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    size="xs"
                    variant="light"
                    color="indigo"
                    fullWidth
                  >
                    OpenRouter API Keys
                  </Button>
                  <Button
                    component="a"
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    size="xs"
                    variant="light"
                    color="gray"
                    fullWidth
                  >
                    OpenAI Platform Keys
                  </Button>
                </Stack>
              </Card>

              <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Group gap="xs" mb="xs">
                  <ThemeIcon size={28} radius="md" color="orange" variant="light">
                    <IconInfoCircle size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="sm">
                    Zero-Key Offline Fallback
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                  No API key? No problem! The built-in Store App MCP router answers common retail queries directly against Django models even without an external AI provider.
                </Text>
              </Card>
            </Stack>
          </SimpleGrid>
        </Tabs.Panel>

        {/* Tab 2: Store App MCP Tool Registry */}
        <Tabs.Panel value="mcp-tools">
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={4} fw={700}>
                  Active Model Context Protocol (MCP) Tools
                </Title>
                <Text size="xs" c="dimmed">
                  These tools are exposed via JSON-RPC 2.0 at <code>POST /api/mcp/rpc/</code> and invoked autonomously by LLMs during conversational turns.
                </Text>
              </div>
              <Badge variant="light" color="indigo" size="lg">
                JSON-RPC 2.0 Compliant
              </Badge>
            </Group>

            <Table striped highlightOnHover withColumnBorders>
              <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                <Table.Tr>
                  <Table.Th>Tool Name</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Input Schema</Table.Th>
                  <Table.Th>Type</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(toolsData?.tools || []).map((t) => (
                  <Table.Tr key={t.name}>
                    <Table.Td>
                      <Group gap="xs">
                        <ThemeIcon size="xs" color="indigo" variant="light">
                          <IconTools size={12} />
                        </ThemeIcon>
                        <Text fw={700} ff="monospace" size="xs">
                          {t.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ fontSize: '12px' }}>
                      {t.description}
                    </Table.Td>
                    <Table.Td>
                      <Text size="11px" ff="monospace" c="dimmed">
                        {Object.keys(t.inputSchema?.properties || {}).join(', ') || 'none'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="teal" variant="light">
                        Deterministic Read
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        {/* Tab 3: Offline Mode */}
        <Tabs.Panel value="offline-mode">
          <Paper withBorder p="xl" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Title order={4} fw={700} mb="xs">
              ⚡ StoreCraft Deterministic Offline Tool Execution Protocol
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              In retail environments where internet connectivity is intermittent or organizations prefer not to share store data with external cloud LLMs, StoreCraft features an intelligent offline intent parser.
            </Text>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Card withBorder radius="md" p="md">
                <Text fw={700} size="sm" mb="xs" c="brand">
                  How Offline Router Works:
                </Text>
                <Stack gap="xs" style={{ fontSize: '13px' }}>
                  <Text size="xs">1. Cashier asks a natural language question (e.g. <em>"What was our sales turnover today?"</em>).</Text>
                  <Text size="xs">2. The backend MCP engine detects intent keywords (sales, turnover, revenue, inventory, low stock, gst, customer).</Text>
                  <Text size="xs">3. The server invokes the exact MCP Python tool handler directly against PostgreSQL / SQLite.</Text>
                  <Text size="xs">4. Real-time aggregated retail data is returned formatted into rich Markdown tables and stats.</Text>
                </Stack>
              </Card>

              <Card withBorder radius="md" p="md">
                <Text fw={700} size="sm" mb="xs" c="teal">
                  Supported Offline Domains:
                </Text>
                <Stack gap="xs" style={{ fontSize: '13px' }}>
                  <Text size="xs">• <strong>Daily Sales & Invoices</strong>: Gross turnover, GST split, tenders.</Text>
                  <Text size="xs">• <strong>Inventory & Stock</strong>: Low-stock reorders, total inventory valuation.</Text>
                  <Text size="xs">• <strong>Tax Compliance</strong>: GSTR-1, GSTR-3B tax calculations & ITC.</Text>
                  <Text size="xs">• <strong>Customer Profiles</strong>: Loyalty points balance & recent store visits.</Text>
                </Stack>
              </Card>
            </SimpleGrid>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
