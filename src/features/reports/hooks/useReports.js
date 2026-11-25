import { useQuery } from '@tanstack/react-query';
import { getOwnerDashboardData } from '../api/reports.api';
import { getCachedDashboardData } from '@/shared/lib/cachePersistence';

const reportKeys = {
  all: ['reports'],
  dashboard: (dateRange, storeCode = 'all') => [...reportKeys.all, 'owner-dashboard', dateRange, storeCode],
};

/**
 * Hook to retrieve full command center metrics for the Store Owner
 * Hydrates from verified persistent cache if available, and always revalidates
 * immediately against live Supabase data + real-time subscriptions.
 *
 * @param {string | { dateRange?: 'today' | 'week' | 'month' | 'all', storeCode?: 'all' | 'mobiles' | 'furniture-electronics' }} [options]
 */
export function useOwnerDashboard(options = 'month') {
  const params = typeof options === 'string' ? { dateRange: options, storeCode: 'all' } : { dateRange: 'month', storeCode: 'all', ...options };
  const { dateRange, storeCode } = params;

  return useQuery({
    queryKey: reportKeys.dashboard(dateRange, storeCode),
    queryFn: () => getOwnerDashboardData({ dateRange, storeCode }),
    initialData: () => getCachedDashboardData(dateRange, storeCode) || undefined,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    retry: 2,
  });
}
