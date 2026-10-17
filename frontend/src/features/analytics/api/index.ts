import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  AnalyticsFilterParams,
  CategoryBreakdownAnalytics,
  HourlyFootfallAnalytics,
  InventoryHealthData,
  OverviewAnalytics,
  PaymentMethodsAnalytics,
  SalesTrendAnalytics,
  TopProductsAnalytics,
} from '../types';

function buildQueryParams(params?: AnalyticsFilterParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params?.store_id) query.store_id = params.store_id;
  if (params?.start_date) query.start_date = params.start_date;
  if (params?.end_date) query.end_date = params.end_date;
  if (params?.granularity) query.granularity = params.granularity;
  if (params?.sort_by) query.sort_by = params.sort_by;
  if (params?.limit) query.limit = String(params.limit);
  return query;
}

export function useAnalyticsOverview(params?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ['analytics-overview', params],
    queryFn: async () => {
      const response = await api.get<OverviewAnalytics>('/api/analytics/overview/', {
        params: buildQueryParams(params),
      });
      return response.data;
    },
  });
}

export function useSalesTrend(params?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ['analytics-sales-trend', params],
    queryFn: async () => {
      const response = await api.get<SalesTrendAnalytics>('/api/analytics/sales-trend/', {
        params: buildQueryParams(params),
      });
      return response.data;
    },
  });
}

export function useTopProducts(params?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ['analytics-top-products', params],
    queryFn: async () => {
      const response = await api.get<TopProductsAnalytics>('/api/analytics/top-products/', {
        params: buildQueryParams(params),
      });
      return response.data;
    },
  });
}

export function useCategoryBreakdown(params?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ['analytics-category-breakdown', params],
    queryFn: async () => {
      const response = await api.get<CategoryBreakdownAnalytics>('/api/analytics/category-breakdown/', {
        params: buildQueryParams(params),
      });
      return response.data;
    },
  });
}

export function useHourlyFootfall(params?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ['analytics-hourly-footfall', params],
    queryFn: async () => {
      const response = await api.get<HourlyFootfallAnalytics>('/api/analytics/hourly-footfall/', {
        params: buildQueryParams(params),
      });
      return response.data;
    },
  });
}

export function usePaymentMethods(params?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ['analytics-payment-methods', params],
    queryFn: async () => {
      const response = await api.get<PaymentMethodsAnalytics>('/api/analytics/payment-methods/', {
        params: buildQueryParams(params),
      });
      return response.data;
    },
  });
}

export function useInventoryHealth(params?: { store_id?: string }) {
  return useQuery({
    queryKey: ['analytics-inventory-health', params],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params?.store_id) query.store_id = params.store_id;
      const response = await api.get<InventoryHealthData>('/api/analytics/inventory-health/', {
        params: query,
      });
      return response.data;
    },
  });
}
