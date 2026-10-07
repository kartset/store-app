import axios from 'axios';

// Create a configured Axios instance
export const api = axios.create({
  // Use Vite environment variables, falling back to local Django URL
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Inject JWT token if it exists
api.interceptors.request.use(
  (config) => {
    // You can fetch this from your Zustand store or localStorage
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors (like 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized (e.g., clear Zustand store, redirect to login)
      console.warn('Unauthorized! Redirecting to login...');
      // localStorage.removeItem('access_token');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
