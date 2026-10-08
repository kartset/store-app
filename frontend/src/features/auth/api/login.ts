import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/axios';

export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: Record<string, string>) => {
      // POST to our Django SimpleJWT endpoint
      const response = await api.post('/api/users/auth/login/', credentials);
      return response.data;
    },
  });
};
