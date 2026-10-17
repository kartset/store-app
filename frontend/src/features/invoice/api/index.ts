import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  CreditNote,
  CreditNoteFilterParams,
  DailySummaryMetrics,
  Invoice,
  InvoiceCheckoutPayload,
  InvoiceFilterParams,
  ProcessReturnPayload,
} from '../types';

export function useInvoices(params?: InvoiceFilterParams) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.store_id) queryParams.store_id = params.store_id;
      if (params?.customer_id) queryParams.customer_id = params.customer_id;
      if (params?.status) queryParams.status = params.status;
      if (params?.type) queryParams.type = params.type;
      if (params?.search) queryParams.search = params.search;
      if (params?.start_date) queryParams.start_date = params.start_date;
      if (params?.end_date) queryParams.end_date = params.end_date;

      const response = await api.get<Invoice[] | { results: Invoice[] }>('/api/invoices/', {
        params: queryParams,
      });

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
    },
  });
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Invoice>(`/api/invoices/${id}/`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useDailySummary(storeId?: string, date?: string) {
  return useQuery({
    queryKey: ['invoice-summary', storeId, date],
    queryFn: async () => {
      if (!storeId) return null;
      const params: Record<string, string> = { store_id: storeId };
      if (date) params.date = date;

      const response = await api.get<DailySummaryMetrics>('/api/invoices/summary/', { params });
      return response.data;
    },
    enabled: Boolean(storeId),
    refetchInterval: 15000, // Live poll every 15s during active trading
  });
}

export function useCheckoutInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: InvoiceCheckoutPayload) => {
      const response = await api.post<Invoice>('/api/invoices/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-lookup'] });
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<Invoice>(`/api/invoices/${id}/cancel/`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCreditNotes(params?: CreditNoteFilterParams) {
  return useQuery({
    queryKey: ['credit-notes', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.store_id) queryParams.store_id = params.store_id;
      if (params?.invoice_id) queryParams.invoice_id = params.invoice_id;
      if (params?.customer_id) queryParams.customer_id = params.customer_id;
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<CreditNote[] | { results: CreditNote[] }>('/api/credit-notes/', {
        params: queryParams,
      });

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
    },
  });
}

export function useCreditNote(id?: string) {
  return useQuery({
    queryKey: ['credit-note', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<CreditNote>(`/api/credit-notes/${id}/`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useProcessReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, payload }: { invoiceId: string; payload: ProcessReturnPayload }) => {
      const response = await api.post<CreditNote>(`/api/invoices/${invoiceId}/return/`, payload);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-lookup'] });
    },
  });
}

