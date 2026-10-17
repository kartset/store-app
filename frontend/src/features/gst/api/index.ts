import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  GSTR1Response,
  GSTR3BResponse,
  GSTFilingPeriod,
  GeneratePeriodPayload,
  MarkFiledPayload,
} from '../types';

export function useGSTR1Summary(storeId?: string, period?: string) {
  return useQuery({
    queryKey: ['gstr1-summary', storeId, period],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (storeId) params.store_id = storeId;
      if (period) params.period = period;

      const response = await api.get<GSTR1Response>('/api/gst/gstr1-summary/', { params });
      return response.data;
    },
  });
}

export function useGSTR3BSummary(storeId?: string, period?: string) {
  return useQuery({
    queryKey: ['gstr3b-summary', storeId, period],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (storeId) params.store_id = storeId;
      if (period) params.period = period;

      const response = await api.get<GSTR3BResponse>('/api/gst/gstr3b-summary/', { params });
      return response.data;
    },
  });
}

export function useGSTFilingPeriods(storeId?: string, period?: string) {
  return useQuery({
    queryKey: ['gst-filing-periods', storeId, period],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (storeId) params.store_id = storeId;
      if (period) params.period = period;

      const response = await api.get<GSTFilingPeriod[] | { results: GSTFilingPeriod[] }>('/api/gst/filing-periods/', { params });
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
    },
  });
}

export function useGenerateFilingPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GeneratePeriodPayload) => {
      const response = await api.post<GSTFilingPeriod>('/api/gst/filing-periods/generate/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gst-filing-periods'] });
      queryClient.invalidateQueries({ queryKey: ['gstr1-summary'] });
      queryClient.invalidateQueries({ queryKey: ['gstr3b-summary'] });
    },
  });
}

export function useMarkPeriodFiled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MarkFiledPayload) => {
      const response = await api.post<GSTFilingPeriod>('/api/gst/filing-periods/mark-filed/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gst-filing-periods'] });
      queryClient.invalidateQueries({ queryKey: ['gstr1-summary'] });
      queryClient.invalidateQueries({ queryKey: ['gstr3b-summary'] });
    },
  });
}

export function useTogglePeriodLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post<GSTFilingPeriod>(`/api/gst/filing-periods/${periodId}/toggle-lock/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gst-filing-periods'] });
    },
  });
}

export async function downloadGSTNJson(storeId?: string, period?: string) {
  const params: Record<string, string> = { download: 'true' };
  if (storeId) params.store_id = storeId;
  if (period) params.period = period;

  const response = await api.get('/api/gst/export-gstn-json/', {
    params,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `GSTR1_${period || 'PERIOD'}.json`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
}
