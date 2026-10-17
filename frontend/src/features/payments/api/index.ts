import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  PaymentStatusResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '../types';

export function useCreatePaymentOrder() {
  return useMutation({
    mutationFn: async (payload: CreateOrderRequest) => {
      const res = await api.post<CreateOrderResponse>('/api/payments/create_order/', payload);
      return res.data;
    },
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VerifyPaymentRequest) => {
      const res = await api.post<VerifyPaymentResponse>('/api/payments/verify/', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', data.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ['register-current'] });
    },
  });
}

export function usePaymentStatus(params: {
  gatewayOrderId?: string;
  paymentId?: string;
  invoiceId?: string;
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const {
    gatewayOrderId,
    paymentId,
    invoiceId,
    enabled = true,
    refetchInterval = 3000,
  } = params;

  return useQuery({
    queryKey: ['payment-status', gatewayOrderId, paymentId, invoiceId],
    queryFn: async () => {
      const qParams: Record<string, string> = {};
      if (gatewayOrderId) qParams.gateway_order_id = gatewayOrderId;
      if (paymentId) qParams.payment_id = paymentId;
      if (invoiceId) qParams.invoice_id = invoiceId;

      const res = await api.get<PaymentStatusResponse>('/api/payments/status/', {
        params: qParams,
      });
      return res.data;
    },
    enabled: enabled && Boolean(gatewayOrderId || paymentId || invoiceId),
    refetchInterval: (query) => {
      // Stop polling once payment is SUCCESS or FAILED
      if (query.state.data?.status === 'SUCCESS' || query.state.data?.status === 'FAILED') {
        return false;
      }
      return refetchInterval;
    },
  });
}
