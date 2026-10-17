import { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Button,
  Textarea,
  ScrollArea,
  Paper,
  Avatar,
  Box,
  Tooltip,
  Select,
  Loader,
  Collapse,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconSparkles,
  IconSend,
  IconTrash,
  IconAdjustments,
  IconTools,
  IconCheck,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconChartBar,
  IconAlertTriangle,
  IconReceiptTax,
  IconUsers,
  IconBuildingStore,
  IconPackage,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useCopilotStore } from '../store';
import { useSendChatMessage } from '../api';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { MCPToolCall } from '../types';

const PROMPT_CHIPS = [
  {
    label: "Today's sales & turnover",
    query: "What was our total sales turnover and revenue today?",
    icon: IconChartBar,
    color: 'teal',
  },
  {
    label: 'Low stock warning',
    query: 'Which products are currently running low on stock and need reordering?',
    icon: IconAlertTriangle,
    color: 'orange',
  },
  {
    label: 'Monthly GST liability',
    query: 'Show our current month GST filing summary and tax liability',
    icon: IconReceiptTax,
    color: 'indigo',
  },
  {
    label: 'Customer loyalty 360',
    query: 'Look up customer phone 9876543210 and check loyalty reward points',
    icon: IconUsers,
    color: 'blue',
  },
  {
    label: 'Store directory',
    query: 'List all active physical stores and retail locations',
    icon: IconBuildingStore,
    color: 'violet',
  },
  {
    label: 'Recent orders',
    query: 'Show our latest customer orders and order numbers',
    icon: IconPackage,
    color: 'cyan',
  },
];

export function CopilotDrawer() {
  const navigate = useNavigate();
  const {
    isDrawerOpen,
    closeDrawer,
    messages,
    addMessage,
    clearMessages,
    settings,
    selectedStoreId,
    setSelectedStoreId,
    isGenerating,
    setIsGenerating,
  } = useCopilotStore();

  const [input, setInput] = useState('');
  const chatMutation = useSendChatMessage();
  const viewportRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isGenerating]);

  // Read stores from localStorage if available
  const storedStore = (() => {
    try {
      const item = localStorage.getItem('current_store');
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  })();

  const handleSendMessage = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || isGenerating) return;

    // 1. Append user message
    addMessage({
      role: 'user',
      content: trimmed,
    });
    setInput('');
    setIsGenerating(true);

    try {
      // 2. Format history for backend API
      const historyPayload = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      historyPayload.push({
        role: 'user',
        content: trimmed,
      });

      const response = await chatMutation.mutateAsync({
        messages: historyPayload,
        provider: settings.provider,
        model: settings.model,
        api_key: settings.apiKey,
        store_id: selectedStoreId || (storedStore?.id ? String(storedStore.id) : undefined),
      });

      // 3. Append assistant response with executed tools
      addMessage({
        role: 'assistant',
        content: response.message.content,
        executed_tools: response.executed_tools,
        provider: response.provider,
        model: response.model,
        mode: response.mode,
      });
    } catch (err: any) {
      console.error('Copilot chat error:', err);
      const errMsg = err?.response?.data?.error || err.message || 'Failed to communicate with Retail Copilot';
      addMessage({
        role: 'assistant',
        content: `❌ **Copilot Encountered an Issue**:\n\n${errMsg}\n\n*Please verify your API key in **AI & MCP Settings** or continue using offline ERP tools.*`,
        error: errMsg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const isConfigured = Boolean(settings.apiKey);

  return (
    <Drawer
      opened={isDrawerOpen}
      onClose={closeDrawer}
      position="right"
      size="540px"
      padding={0}
      withCloseButton={false}
      styles={{
        content: {
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        },
        body: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 0,
        },
      }}
    >
      {/* Drawer Header */}
      <Box
        p="md"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-subtle)',
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Box
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <IconSparkles size={18} color="#fff" />
            </Box>
            <div>
              <Group gap={6} align="center">
                <Text fw={700} size="sm">
                  Retail Copilot
                </Text>
                <Badge
                  size="xs"
                  variant="gradient"
                  gradient={
                    isConfigured
                      ? { from: 'indigo', to: 'violet', deg: 45 }
                      : { from: 'gray', to: 'dark', deg: 45 }
                  }
                >
                  {isConfigured ? settings.model : 'Local MCP Tools'}
                </Badge>
              </Group>
              <Text size="11px" c="dimmed">
                {isConfigured ? 'Connected to AI Provider' : 'Direct Database Query Mode'}
              </Text>
            </div>
          </Group>

          <Group gap={4}>
            <Tooltip label="Configure AI Settings" withArrow position="bottom">
              <ActionIcon
                variant="light"
                color="indigo"
                size="sm"
                radius="md"
                onClick={() => {
                  closeDrawer();
                  navigate('/ai-settings');
                }}
              >
                <IconAdjustments size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Clear Conversation" withArrow position="bottom">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                radius="md"
                onClick={clearMessages}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>

            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={closeDrawer}
              style={{ fontWeight: 600 }}
            >
              Close
            </Button>
          </Group>
        </Group>

        {/* Store Context Filter */}
        <Group mt="xs" justify="space-between" align="center">
          <Text size="xs" c="dimmed" fw={600}>
            Scope Store Data:
          </Text>
          <Select
            size="xs"
            w={220}
            radius="md"
            placeholder="All Physical Stores"
            value={selectedStoreId}
            onChange={(val) => setSelectedStoreId(val)}
            clearable
            data={[
              { value: '', label: '🌐 All Active Stores' },
              ...(storedStore ? [{ value: String(storedStore.id), label: `🏪 Current: ${storedStore.name}` }] : []),
            ]}
          />
        </Group>
      </Box>

      {/* Message Viewport */}
      <ScrollArea
        viewportRef={viewportRef}
        style={{ flex: 1 }}
        p="md"
        type="auto"
      >
        <Stack gap="md">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}

          {isGenerating && (
            <Paper
              withBorder
              p="sm"
              radius="md"
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                borderStyle: 'dashed',
              }}
            >
              <Group gap="xs">
                <Loader size="xs" color="indigo" />
                <Text size="xs" fw={600} c="indigo">
                  Retail Copilot is analyzing ERP databases and invoking MCP tools...
                </Text>
              </Group>
            </Paper>
          )}
        </Stack>
      </ScrollArea>

      {/* Quick Prompt Chips */}
      <Box
        px="md"
        pt="xs"
        pb={6}
        style={{
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-subtle)',
        }}
      >
        <Text size="11px" fw={700} c="dimmed" mb={6} style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Suggested Retail Prompts
        </Text>
        <ScrollArea type="never">
          <Group gap={6} wrap="nowrap" pb={4}>
            {PROMPT_CHIPS.map((chip, idx) => {
              const Icon = chip.icon;
              return (
                <Button
                  key={idx}
                  size="xs"
                  variant="outline"
                  color={chip.color}
                  radius="xl"
                  leftSection={<Icon size={12} />}
                  onClick={() => handleSendMessage(chip.query)}
                  disabled={isGenerating}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    height: '26px',
                    padding: '0 10px',
                  }}
                >
                  {chip.label}
                </Button>
              );
            })}
          </Group>
        </ScrollArea>
      </Box>

      {/* Input Composer */}
      <Box
        p="md"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <Group align="flex-end" gap="xs">
          <Textarea
            placeholder="Ask about inventory, today's sales turnover, GST filing, or customer phone..."
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autosize
            minRows={2}
            maxRows={5}
            radius="md"
            style={{ flex: 1 }}
            disabled={isGenerating}
          />
          <ActionIcon
            size="lg"
            radius="md"
            color="indigo"
            variant="filled"
            onClick={() => handleSendMessage(input)}
            disabled={!input.trim() || isGenerating}
            loading={isGenerating}
            style={{
              height: 48,
              width: 44,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <IconSend size={18} />
          </ActionIcon>
        </Group>
        <Group justify="space-between" mt={4} px={2}>
          <Text size="10px" c="dimmed">
            Press <strong style={{ fontWeight: 600 }}>Enter</strong> to send • <strong style={{ fontWeight: 600 }}>Shift+Enter</strong> for newline
          </Text>
          <Text size="10px" c="dimmed">
            Powered by StoreCraft MCP Server
          </Text>
        </Group>
      </Box>
    </Drawer>
  );
}

/**
 * Message Item with Tool Execution Disclosure
 */
function MessageItem({ message }: { message: any }) {
  const isUser = message.role === 'user';
  const hasTools = message.executed_tools && message.executed_tools.length > 0;
  const [toolsOpen, { toggle: toggleTools }] = useDisclosure(true);

  if (isUser) {
    return (
      <Group justify="flex-end" align="flex-start" gap="xs">
        <Box
          p="sm"
          style={{
            maxWidth: '85%',
            backgroundColor: 'var(--brand-primary)',
            color: '#fff',
            borderRadius: '12px 12px 2px 12px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Text size="sm" style={{ lineHeight: 1.5 }}>
            {message.content}
          </Text>
        </Box>
        <Avatar size={30} radius="xl" color="brand" variant="filled">
          👤
        </Avatar>
      </Group>
    );
  }

  return (
    <Group justify="flex-start" align="flex-start" gap="xs" wrap="nowrap">
      <Avatar
        size={32}
        radius="md"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          color: '#fff',
          boxShadow: 'var(--shadow-xs)',
          flexShrink: 0,
        }}
      >
        <IconSparkles size={16} />
      </Avatar>

      <Stack gap={6} style={{ flex: 1, maxWidth: '92%' }}>
        {/* Tool Execution Transparency Badge */}
        {hasTools && (
          <Paper
            withBorder
            radius="md"
            p="xs"
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <Group
              justify="space-between"
              style={{ cursor: 'pointer' }}
              onClick={toggleTools}
            >
              <Group gap="xs">
                <IconTools size={14} color="var(--brand-primary)" />
                <Text size="11px" fw={700} c="dimmed">
                  MCP Tools Executed ({message.executed_tools.length})
                </Text>
              </Group>
              {toolsOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </Group>

            <Collapse expanded={toolsOpen}>
              <Stack gap={4} mt="xs">
                {message.executed_tools.map((t: MCPToolCall, idx: number) => (
                  <Group
                    key={idx}
                    justify="space-between"
                    p="4px 8px"
                    style={{
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Group gap={6}>
                      {t.status === 'success' ? (
                        <IconCheck size={13} color="green" />
                      ) : (
                        <IconAlertCircle size={13} color="red" />
                      )}
                      <Text size="xs" fw={700} ff="monospace">
                        {t.tool}
                      </Text>
                    </Group>
                    <Badge size="xs" variant="light" color={t.status === 'success' ? 'green' : 'red'}>
                      {t.status}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            </Collapse>
          </Paper>
        )}

        {/* Assistant Content */}
        <Paper
          withBorder
          p="sm"
          radius="md"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '2px 12px 12px 12px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <MarkdownRenderer content={message.content} />

          <Group justify="space-between" mt="xs" pt={4} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <Text size="10px" c="dimmed">
              {message.mode === 'online' ? `Generated by ${message.model}` : 'Local MCP Tool Direct'}
            </Text>
            <Text size="10px" c="dimmed">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Group>
        </Paper>
      </Stack>
    </Group>
  );
}
