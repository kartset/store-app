import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import type {
  ChatPayload,
  ChatResponse,
  MCPToolInfo,
  TestConnectionPayload,
  TestConnectionResponse,
} from './types';

export const copilotApi = {
  chat: async (payload: ChatPayload): Promise<ChatResponse> => {
    const res = await api.post<ChatResponse>('/api/mcp/chat/', payload);
    return res.data;
  },

  testConnection: async (payload: TestConnectionPayload): Promise<TestConnectionResponse> => {
    const res = await api.post<TestConnectionResponse>('/api/mcp/test-connection/', payload);
    return res.data;
  },

  listTools: async (): Promise<{ tools: MCPToolInfo[]; count: number }> => {
    const res = await api.get<{ tools: MCPToolInfo[]; count: number }>('/api/mcp/tools/');
    return res.data;
  },
};

export function useSendChatMessage() {
  return useMutation({
    mutationFn: (payload: ChatPayload) => copilotApi.chat(payload),
  });
}

export function useTestAIConnection() {
  return useMutation({
    mutationFn: (payload: TestConnectionPayload) => copilotApi.testConnection(payload),
  });
}

export function useMCPToolsList() {
  return useQuery({
    queryKey: ['mcp-tools-list'],
    queryFn: () => copilotApi.listTools(),
    staleTime: 60 * 1000,
  });
}
