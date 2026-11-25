import { useEffect } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '@/shared/lib/queryClient';
import { subscribeToFinancialEvents } from '@/shared/lib/supabase';
import { AuthProvider } from '@/features/auth';
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

function RealtimeSyncManager({ children }) {
  const qc = useQueryClient();

  useEffect(() => {
    const pendingRoots = new Set();
    let flushTimer = null;

    function flushInvalidations() {
      flushTimer = null;
      for (const rootKey of pendingRoots) {
        qc.invalidateQueries({ queryKey: [rootKey] });
      }
      pendingRoots.clear();
    }

    // Coalesce multi-table DB transactions (e.g. place_sale) within 150ms into a single clean refetch per root
    const unsubscribe = subscribeToFinancialEvents((table) => {
      const roots = TABLE_TO_QUERY_KEYS[table];
      if (!roots) return;
      for (const root of roots) {
        pendingRoots.add(root);
      }
      if (!flushTimer) {
        flushTimer = setTimeout(flushInvalidations, 150);
      }
    });

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      unsubscribe();
    };
  }, [qc]);

  return children;
}

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeSyncManager>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </RealtimeSyncManager>
    </QueryClientProvider>
  );
}
