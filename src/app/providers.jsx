import { useEffect } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '@/shared/lib/queryClient';
import { subscribeToFinancialEvents } from '@/shared/lib/supabase';
import { AuthProvider, useAuth } from '@/features/auth';
import { CartProvider } from '@/features/catalog';

const TABLE_TO_QUERY_KEYS = {
  invoices: ['billing', 'inventory', 'reports', 'stores'],
  payments: ['billing', 'reports', 'stores'],
  order_items: ['billing', 'inventory', 'reports', 'stores'],
  sales_returns: ['billing', 'inventory', 'reports', 'stores'],
  inventory: ['inventory', 'reports'],
  products: ['inventory', 'reports', 'catalog'],
  product_units: ['inventory', 'reports'],
  stock_adjustments: ['inventory'],
  stores: ['stores', 'reports'],
  dealers: ['dealers'],
  dealer_bills: ['dealers'],
  dealer_payments: ['dealers'],
  dealer_debit_notes: ['dealers'],
  staff_profiles: ['staff'],
  staff_leaves: ['staff'],
  staff_salaries: ['staff'],
};

const FALLBACK_POLL_INTERVAL_MS = 30_000;

function RealtimeSyncManager({ children }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;

    const pendingRoots = new Set();
    let flushTimer = null;
    let pollTimer = null;

    function flushInvalidations() {
      flushTimer = null;
      for (const rootKey of pendingRoots) {
        qc.invalidateQueries({ queryKey: [rootKey] });
      }
      pendingRoots.clear();
    }

    function startPollingFallback() {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        qc.invalidateQueries({ refetchType: 'active' });
      }, FALLBACK_POLL_INTERVAL_MS);
    }

    // Coalesce multi-table DB transactions (e.g. place_sale) within 150ms into a single clean refetch per root
    const unsubscribe = subscribeToFinancialEvents(
      (table) => {
        const roots = TABLE_TO_QUERY_KEYS[table];
        if (!roots) return;
        for (const root of roots) {
          pendingRoots.add(root);
        }
        if (!flushTimer) {
          flushTimer = setTimeout(flushInvalidations, 150);
        }
      },
      { onFallback: startPollingFallback }
    );

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      if (pollTimer) clearInterval(pollTimer);
      unsubscribe();
    };
  }, [qc, user]);

  return children;
}

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeSyncManager>
          <CartProvider>{children}</CartProvider>
        </RealtimeSyncManager>
      </AuthProvider>
    </QueryClientProvider>
  );
}
