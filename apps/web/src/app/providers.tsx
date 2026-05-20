'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ThemeProvider } from '@/lib/theme';
import { useGlobalSocket } from '@/hooks/useGlobalSocket';
import { AuthProvider } from '@/lib/auth-context';

function GlobalSocketListener() {
  useGlobalSocket();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GlobalSocketListener />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
