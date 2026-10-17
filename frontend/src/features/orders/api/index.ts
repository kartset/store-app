import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  Order,
  OrderCreatePayload,
  OrderConvertToInvoicePayload,
  OrderFilterParams,
  OrderStats,
} from '../types';

export function useOrders(params?: OrderFilterParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.store_id) queryParams.store_id = params.store_id;
      if (params?.customer_id) queryParams.customer_id = params.customer_id;
      if (params?.status) queryParams.status = params.status;
      if (params?.fulfillment_type) queryParams.fulfillment_type = params.fulfillment_type;
      if (params?.payment_status) queryParams.payment_status = params.payment_status;
      if (params?.search) queryParams.search = params.search;
      if (params?.start_date) queryParams.start_date = params.start_date;
      if (params?.end_date) queryParams.end_date = params.end_date;

      const response = await api.get<Order[] | { results: Order[] }>('/api/orders/', {
        params: queryParams,
      });

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
    },
  });
}

export function useOrder(id?: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Order>(`/api/orders/${id}/`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useOrderStats(storeId?: string) {
  return useQuery({
    queryKey: ['order-stats', storeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (storeId) params.store_id = storeId;
      const response = await api.get<OrderStats>('/api/orders/stats/', { params });
      return response.data;
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OrderCreatePayload) => {
      const response = await api.post<Order>('/api/orders/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post<Order>(`/api/orders/${orderId}/confirm/`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
}

export function usePackOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post<Order>(`/api/orders/${orderId}/pack/`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
}

export function useReadyOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post<Order>(`/api/orders/${orderId}/ready/`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      const response = await api.post<Order>(`/api/orders/${orderId}/cancel/`, { reason });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
}

export function useConvertToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: OrderConvertToInvoicePayload;
    }) => {
      const response = await api.post<{ order: Order; invoice: any; message: string }>(
        `/api/orders/${orderId}/convert-to-invoice/`,
        payload
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.order.id] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
