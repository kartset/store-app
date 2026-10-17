import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  Delivery,
  DeliveryCreatePayload,
  AssignDriverPayload,
  VerifyOTPPayload,
  UpdateStatusPayload,
  DeliveryFilterParams,
  PipelineSummary,
} from '../types';

export function useDeliveries(params?: DeliveryFilterParams) {
  return useQuery({
    queryKey: ['deliveries', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.store_id) queryParams.store_id = params.store_id;
      if (params?.status) queryParams.status = params.status;
      if (params?.delivery_type) queryParams.delivery_type = params.delivery_type;
      if (params?.search) queryParams.search = params.search;
      if (params?.start_date) queryParams.start_date = params.start_date;
      if (params?.end_date) queryParams.end_date = params.end_date;

      const response = await api.get<Delivery[] | { results: Delivery[] }>('/api/deliveries/', {
        params: queryParams,
      });

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
    },
  });
}

export function useDelivery(id?: string) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Delivery>(`/api/deliveries/${id}/`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useDeliveryPipelineSummary(storeId?: string) {
  return useQuery({
    queryKey: ['delivery-pipeline-summary', storeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (storeId) params.store_id = storeId;
      const response = await api.get<PipelineSummary>('/api/deliveries/pipeline-summary/', { params });
      return response.data;
    },
  });
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DeliveryCreatePayload) => {
      const response = await api.post<Delivery>('/api/deliveries/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-pipeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useAssignDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssignDriverPayload }) => {
      const response = await api.post<Delivery>(`/api/deliveries/${id}/assign-driver/`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery', data.id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-pipeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useDispatchDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<Delivery>(`/api/deliveries/${id}/dispatch/`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery', data.id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-pipeline-summary'] });
    },
  });
}

export function useVerifyOTP() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VerifyOTPPayload }) => {
      const response = await api.post<Delivery>(`/api/deliveries/${id}/verify-otp/`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery', data.id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-pipeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStatusPayload }) => {
      const response = await api.post<Delivery>(`/api/deliveries/${id}/update-status/`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery', data.id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-pipeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
