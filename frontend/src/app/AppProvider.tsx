import { MantineProvider, createTheme, type MantineColorsTuple } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

// Import Mantine core styles
import '@mantine/core/styles.css';

// 10-shade bespoke brand palette (Deep Indigo to Electric Violet)
const brand: MantineColorsTuple = [
  '#eef2ff', // 0: subtle backgrounds
  '#e0e7ff', // 1: light hover
  '#c7d2fe', // 2: borders/light accents
  '#a5b4fc', // 3: subtle highlights
  '#818cf8', // 4: secondary accent
  '#6366f1', // 5: vibrant primary
  '#4f46e5', // 6: primary interactive button / active state
  '#4338ca', // 7: active hover
  '#3730a3', // 8: deep contrast
  '#312e81', // 9: darkest brand tone
];

const emerald: MantineColorsTuple = [
  '#ecfdf5',
  '#d1fae5',
  '#a7f3d0',
  '#6ee7b7',
  '#34d399',
  '#10b981',
  '#059669',
  '#047857',
  '#065f46',
  '#064e3b',
];

export const theme = createTheme({
  colors: {
    brand,
    emerald,
  },
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', monospace",
  headings: {
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2.25rem', lineHeight: '1.25' },
      h2: { fontSize: '1.75rem', lineHeight: '1.3' },
      h3: { fontSize: '1.25rem', lineHeight: '1.35' },
      h4: { fontSize: '1.1rem', lineHeight: '1.4' },
    },
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
          transition: 'all 150ms ease-in-out',
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        padding: 'lg',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
        size: 'sm',
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: 'md',
        size: 'sm',
      },
    },
    Table: {
      defaultProps: {
        highlightOnHover: true,
        verticalSpacing: 'sm',
      },
      styles: {
        th: {
          fontWeight: 600,
          color: 'var(--text-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
        },
        td: {
          borderBottom: '1px solid var(--border-subtle)',
        },
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: '0.02em',
        },
      },
    },
  },
});

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
}
