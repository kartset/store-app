import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

// Import Mantine core styles
import '@mantine/core/styles.css';

// Create a custom Mantine theme if needed
const theme = createTheme({
  /** Put your mantine theme override here */
  primaryColor: 'blue',
});

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // We put queryClient in state to ensure it is created only once per app lifecycle
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
}
