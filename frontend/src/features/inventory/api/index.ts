import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  AdjustStockPayload,
  InventoryItem,
  InventorySummary,
  ReceiveGoodsPayload,
  StockMovement,
} from '../types';

export interface InventoryFilterParams {
  store_id?: string;
  product_id?: string;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  search?: string;
}

export function useInventory(params?: InventoryFilterParams) {
  return useQuery({
    queryKey: ['inventory', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.store_id) queryParams.store_id = params.store_id;
      if (params?.product_id) queryParams.product_id = params.product_id;
      if (params?.is_low_stock !== undefined) queryParams.is_low_stock = String(params.is_low_stock);
      if (params?.is_out_of_stock !== undefined) queryParams.is_out_of_stock = String(params.is_out_of_stock);
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<InventoryItem[]>('/api/inventory/', {
        params: queryParams,
      });
      return response.data;
    },
    enabled: Boolean(params?.store_id),
  });
}

export function useInventorySummary(storeId?: string) {
  return useQuery({
    queryKey: ['inventory-summary', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const response = await api.get<InventorySummary>('/api/inventory/summary/', {
        params: { store_id: storeId },
      });
      return response.data;
    },
    enabled: Boolean(storeId),
  });
}

export interface StockMovementFilterParams {
  store_id?: string;
  product_id?: string;
  movement_type?: string;
  reference_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export function useStockMovements(params?: StockMovementFilterParams) {
  return useQuery({
    queryKey: ['stock-movements', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.store_id) queryParams.store_id = params.store_id;
      if (params?.product_id) queryParams.product_id = params.product_id;
      if (params?.movement_type) queryParams.movement_type = params.movement_type;
      if (params?.reference_id) queryParams.reference_id = params.reference_id;
      if (params?.start_date) queryParams.start_date = params.start_date;
      if (params?.end_date) queryParams.end_date = params.end_date;
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<StockMovement[]>('/api/inventory/movements/', {
        params: queryParams,
      });
      return response.data;
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      payload,
    }: {
      inventoryId: string;
      payload: AdjustStockPayload;
    }) => {
      const response = await api.post<{
        message: string;
        inventory: InventoryItem;
        movement: StockMovement;
      }>(`/api/inventory/${inventoryId}/adjust_stock/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

export function useReceiveGoods() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReceiveGoodsPayload) => {
      const response = await api.post<{
        message: string;
        items_count: number;
        reference_id: string;
        movements: StockMovement[];
      }>('/api/inventory/receive_goods/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      payload,
    }: {
      inventoryId: string;
      payload: Partial<InventoryItem>;
    }) => {
      const response = await api.patch<InventoryItem>(`/api/inventory/${inventoryId}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}
