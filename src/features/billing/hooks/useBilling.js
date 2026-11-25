import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  placeSale,
  listInvoices,
  listAllInvoices,
  getInvoiceDetail,
  updateInvoice,
  voidInvoice,
  recordPayment,
  processReturn,
  listReturns,
} from '../api/billing.api';
import { inventoryKeys, resolveStoreUuid } from '@/features/inventory';
import { getPersistentCache, setPersistentCache } from '@/shared/lib/cachePersistence';

export const billingKeys = {
  all: ['billing'],
  invoices: (storeId) => [...billingKeys.all, 'invoices', storeId],
  allInvoices: (filters) => [...billingKeys.all, 'all-invoices', filters],
  detail: (invoiceId) => [...billingKeys.all, 'detail', invoiceId],
};

export function useInvoices(storeId) {
  return useQuery({
    queryKey: billingKeys.invoices(storeId),
    queryFn: () => listInvoices({ storeId }),
    placeholderData: () => getPersistentCache(`invoices_${storeId}`) || undefined,
    enabled: Boolean(storeId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useAllInvoices(filters = {}) {
  const isDefault = !filters || Object.keys(filters).length === 0;
  return useQuery({
    queryKey: billingKeys.allInvoices(filters),
    queryFn: () => listAllInvoices(filters),
    placeholderData: () => (isDefault ? getPersistentCache('all_invoices') || undefined : undefined),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useInvoiceDetail(invoiceId) {
  return useQuery({
    queryKey: billingKeys.detail(invoiceId),
    queryFn: () => getInvoiceDetail(invoiceId),
    enabled: Boolean(invoiceId),
  });
}

function applyBilledSerialsToList(units, billedUnitIds, invoiceMeta, nowIso, includeOrderItems) {
  if (!Array.isArray(units)) return units;
  const next = [];
  for (const u of units) {
    if (!billedUnitIds.has(u.id)) {
      next.push(u);
      continue;
    }
    // Reused 'sold' serials become 'retired' and leave both Unused and Used lists
    if (u.status === 'sold') {
      continue;
    }
    // Unused 'in_stock' serials shift immediately to 'sold' (Used)
    const updated = {
      ...u,
      status: 'sold',
      updated_at: nowIso,
    };
    if (includeOrderItems) {
      updated.order_items = [
        ...(u.order_items || []),
        {
          id: `live-${u.id}`,
          invoices: invoiceMeta,
        },
      ];
    }
    next.push(updated);
  }
  return next;
}

export function usePlaceSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: placeSale,
    onSuccess: (result, variables) => {
      const storeId = variables?.storeId;
      const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
      const billedUnitIds = new Set((variables?.items || []).map((it) => it.unit_id).filter(Boolean));

      if (resolvedStoreId && billedUnitIds.size > 0) {
        const nowIso = new Date().toISOString();
        const invoiceMeta = {
          id: result?.invoice_id || null,
          invoice_number: result?.invoice_number || null,
          customer_name: variables?.customerName || 'Walk-in Customer',
          created_at: nowIso,
        };

        for (const keyId of new Set([storeId, resolvedStoreId].filter(Boolean))) {
          queryClient.setQueryData(inventoryKeys.serials(keyId), (old) => {
            const next = applyBilledSerialsToList(old, billedUnitIds, invoiceMeta, nowIso, true);
            if (Array.isArray(next)) {
              setPersistentCache(`store_serials_${resolvedStoreId}`, next);
            }
            return next;
          });
          queryClient.setQueryData(inventoryKeys.units(keyId, null, null), (old) => {
            const next = applyBilledSerialsToList(old, billedUnitIds, invoiceMeta, nowIso, false);
            if (Array.isArray(next)) {
              setPersistentCache(`store_product_units_${resolvedStoreId}`, next);
            }
            return next;
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

export function useVoidInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: voidInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

export function useProcessReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: processReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

export function useInvoiceReturns(invoiceId) {
  return useQuery({
    queryKey: [...billingKeys.all, 'returns', invoiceId],
    queryFn: () => listReturns({ invoiceId }),
    enabled: Boolean(invoiceId),
  });
}
