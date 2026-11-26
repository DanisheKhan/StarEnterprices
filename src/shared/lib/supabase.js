import { createClient, RealtimeClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!rawUrl || !key) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment');
}

export const SUPABASE_ORIGIN = rawUrl;

const isBrowser = typeof window !== 'undefined';
// Route browser HTTP traffic through same-origin /sb proxy (Vercel rewrite / Vite proxy)
// so ISP DNS blocks on *.supabase.co cannot break auth, queries, or storage uploads.
const clientUrl = isBrowser ? `${window.location.origin}/sb` : rawUrl;

let authStorageKey;
if (rawUrl) {
  try {
    authStorageKey = `sb-${new URL(rawUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    authStorageKey = undefined;
  }
}

export const supabase = createClient(clientUrl || '', key || '', {
  auth: {
    ...(authStorageKey ? { storageKey: authStorageKey } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const FINANCIAL_TABLES = [
  'invoices',
  'payments',
  'order_items',
  'sales_returns',
  'inventory',
  'products',
  'product_units',
  'stock_adjustments',
  'stores',
  'dealers',
  'dealer_bills',
  'dealer_payments',
  'dealer_debit_notes',
  'staff_profiles',
  'staff_leaves',
  'staff_salaries',
];

function isLocalhost() {
  if (!isBrowser) return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * Subscribes to database change events across billing, inventory, dealers, staff, and stores.
 * Returns an unsubscribe teardown function.
 *
 * Uses Vite's /sb WebSocket proxy on localhost; on deployed hosts (where Vercel rewrites do
 * not upgrade WebSockets), connects directly to Supabase Realtime and tears down cleanly
 * on connection error so ISP-blocked networks fall back to polling without console spam.
 */
export function subscribeToFinancialEvents(onChange, { onFallback } = {}) {
  if (!rawUrl || !key) {
    onFallback?.();
    return () => {};
  }

  let tornDown = false;
  const useProxyWs = isLocalhost();
  const rtClient = useProxyWs
    ? null
    : new RealtimeClient(`${rawUrl.replace(/^http/i, 'ws')}/realtime/v1`, {
        params: { apikey: key },
        accessToken: async () => {
          const { data } = await supabase.auth.getSession();
          return data?.session?.access_token ?? key;
        },
        // Disable automatic retries if direct *.supabase.co WebSocket is blocked
        reconnectAfterMs: () => 60 * 60 * 1000,
      });

  const channel = (rtClient ?? supabase).channel('realtime-financial-telemetry');
  for (const table of FINANCIAL_TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange(table));
  }

  const teardown = () => {
    if (tornDown) return;
    tornDown = true;
    if (rtClient) {
      rtClient.removeChannel(channel);
      rtClient.disconnect();
    } else {
      supabase.removeChannel(channel);
    }
  };

  channel.subscribe((status) => {
    if (tornDown) return;
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      teardown();
      onFallback?.();
    }
  });

  return teardown;
}
