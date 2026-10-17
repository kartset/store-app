export type AIProvider = 'openrouter' | 'openai' | 'custom';

export interface AISettings {
  provider: AIProvider;
  model: string;
  apiKey: string;
  customEndpoint?: string;
  systemPrompt?: string;
}

export interface MCPToolCall {
  tool: string;
  arguments: Record<string, any>;
  status: 'success' | 'error';
  output_summary?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  executed_tools?: MCPToolCall[];
  provider?: string;
  model?: string;
  mode?: 'online' | 'offline';
  error?: string;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface ChatPayload {
  messages: Array<{ role: string; content: string }>;
  provider?: string;
  model?: string;
  api_key?: string;
  store_id?: string;
}

export interface ChatResponse {
  message: {
    role: string;
    content: string;
  };
  executed_tools: MCPToolCall[];
  provider: string;
  model: string;
  mode: 'online' | 'offline';
}

export interface TestConnectionPayload {
  provider: string;
  model: string;
  api_key: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message?: string;
  error?: string;
  sample_response?: string;
}
