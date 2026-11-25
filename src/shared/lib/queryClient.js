import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Short staleTime with real-time WebSocket coalescing keeps views fresh and consistent
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60, // 1 hour memory retention
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: (failureCount, error) => {
        // Do not retry 4xx client errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});
