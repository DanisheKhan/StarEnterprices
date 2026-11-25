import { supabase } from '@/shared/lib/supabase';
import { getCachedDashboardData, setCachedDashboardData } from '@/shared/lib/cachePersistence';

/**
 * Fetches combined report metrics for the owner (overview)
 */
export async function getOwnerOverview() {
  const [invRes, prodRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, store_id, grand_total, subtotal, cgst_amount, sgst_amount, igst_amount, created_at, stores (name, code)'),
    supabase
      .from('products')
      .select('id, store_id, cost_price, selling_price, inventory (quantity_on_hand), stores (name, code)')
      .eq('is_active', true),
  ]);

  if (invRes.error) throw invRes.error;
  if (prodRes.error) throw prodRes.error;

  return {
    invoices: invRes.data || [],
    products: prodRes.data || [],
  };
}

/**
 * Fetches comprehensive multi-store dashboard and operational insights for the Store Owner
 * Computed natively inside PostgreSQL via single-roundtrip RPC `get_owner_dashboard_metrics`.
 * @param {{ dateRange?: 'today' | 'week' | 'month' | 'all', storeCode?: 'all' | 'mobiles' | 'furniture-electronics' }} [params]
 */
export async function getOwnerDashboardData({ dateRange = 'month', storeCode = 'all' } = {}) {
  try {
    const { data, error } = await supabase.rpc('get_owner_dashboard_metrics', {
      p_date_range: dateRange,
      p_store_code: storeCode,
    });

    if (error) throw error;
    if (!data) throw new Error('Dashboard metrics unavailable');

    setCachedDashboardData(dateRange, storeCode, data);
    return data;
  } catch (err) {
    console.warn('Supabase dashboard RPC failed, checking verified local cache:', err);
    const cached = getCachedDashboardData(dateRange, storeCode);
    if (cached) return cached;
    throw err;
  }
}
