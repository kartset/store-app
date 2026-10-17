import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  CashRegisterSession,
  CashDropPayload,
  CloseRegisterPayload,
  OpenRegisterPayload,
} from '../types';

export function useCurrentRegisterSession(storeId?: string) {
  return useQuery({
    queryKey: ['register-current', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const res = await api.get<{ session: CashRegisterSession | null }>('/api/registers/current/', {
        params: { store_id: storeId },
      });
      return res.data.session;
    },
    enabled: Boolean(storeId),
    refetchInterval: 10000, // Live poll drawer status every 10s
  });
}

export function useRegisterSessions(storeId?: string) {
  return useQuery({
    queryKey: ['register-sessions', storeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (storeId) params.store_id = storeId;
      const res = await api.get<CashRegisterSession[] | { results: CashRegisterSession[] }>('/api/registers/', {
        params,
      });
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return res.data.results || [];
    },
  });
}

export function useOpenRegisterSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OpenRegisterPayload) => {
      const res = await api.post<CashRegisterSession>('/api/registers/open/', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['register-current', data.store_id] });
      queryClient.invalidateQueries({ queryKey: ['register-sessions'] });
    },
  });
}

export function useRecordCashDrop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, payload }: { sessionId: string; payload: CashDropPayload }) => {
      const res = await api.post(`/api/registers/${sessionId}/cash_drop/`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-current'] });
      queryClient.invalidateQueries({ queryKey: ['register-sessions'] });
    },
  });
}

export function useCloseRegisterSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, payload }: { sessionId: string; payload: CloseRegisterPayload }) => {
      const res = await api.post<CashRegisterSession>(`/api/registers/${sessionId}/close/`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['register-current', data.store_id] });
      queryClient.invalidateQueries({ queryKey: ['register-sessions'] });
    },
  });
}
