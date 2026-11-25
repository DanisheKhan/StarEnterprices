import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment');
}

export const supabase = createClient(url || '', key || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Subscribes to database change events across billing, inventory, dealers, staff, and stores.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToFinancialEvents(onChange) {
  const channel = supabase
    .channel('realtime-financial-telemetry')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => onChange('invoices'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => onChange('payments'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => onChange('order_items'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_returns' }, () => onChange('sales_returns'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => onChange('inventory'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => onChange('products'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'product_units' }, () => onChange('product_units'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_adjustments' }, () => onChange('stock_adjustments'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => onChange('stores'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dealers' }, () => onChange('dealers'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_bills' }, () => onChange('dealer_bills'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_payments' }, () => onChange('dealer_payments'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_debit_notes' }, () => onChange('dealer_debit_notes'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_profiles' }, () => onChange('staff_profiles'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_leaves' }, () => onChange('staff_leaves'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_salaries' }, () => onChange('staff_salaries'))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
