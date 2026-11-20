import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPersistentCache } from '@/shared/lib/cachePersistence';
import {
  listDealers,
  getDealerById,
  createDealer,
  updateDealer,
  listDealerBills,
  getDealerBillDetail,
  enrichBillTimeline,
  createDealerBill,
  recordDealerPayment,
  createDealerDebitNote,
  listDealerPayments,
  getDealerStatement,
  getDealerAnalyticsSummary,
} from '../api/dealers.api';

export const dealerKeys = {
  all: ['dealers'],
  lists: () => [...dealerKeys.all, 'list'],
  list: (storeId) => [...dealerKeys.lists(), storeId || 'all'],
  details: () => [...dealerKeys.all, 'detail'],
  detail: (dealerId) => [...dealerKeys.details(), dealerId],
  bills: (filters) => [...dealerKeys.all, 'bills', filters],
  billDetail: (billId) => [...dealerKeys.all, 'bill-detail', billId],
  payments: (filters) => [...dealerKeys.all, 'payments', filters],
  statement: (dealerId, billType) => [...dealerKeys.all, 'statement', dealerId, billType || 'all'],
  analytics: (storeId) => [...dealerKeys.all, 'analytics', storeId || 'all'],
};

export function useDealers({ storeId, includeInactive = false } = {}) {
  return useQuery({
    queryKey: [...dealerKeys.list(storeId), includeInactive],
    queryFn: () => listDealers({ storeId, includeInactive }),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    initialData: () => {
      const cached = getPersistentCache('dealers_directory');
      if (!cached) return undefined;
      if (storeId) {
        return cached.filter((d) => !d.store_id || d.store_id === storeId);
      }
      return cached;
    },
    placeholderData: (prev) => prev,
  });
}

export function useDealer(dealerId) {
  return useQuery({
    queryKey: dealerKeys.detail(dealerId),
    queryFn: () => getDealerById(dealerId),
    enabled: Boolean(dealerId),
  });
}

export function useDealerBills(filters = {}) {
  return useQuery({
    queryKey: dealerKeys.bills(filters),
    queryFn: () => listDealerBills(filters),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    initialData: () => {
      const cacheKey = `dealers_bills_${filters.storeId || 'all'}`;
      const cached = getPersistentCache(cacheKey);
      return cached || undefined;
    },
    placeholderData: (prev) => prev,
  });
}

export function useDealerBillDetail(billId, initialBill = null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: dealerKeys.billDetail(billId),
    queryFn: () => getDealerBillDetail(billId),
    enabled: Boolean(billId),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    initialData: () => {
      // 1. If explicit initial bill passed with matching ID
      if (initialBill && initialBill.id === billId) {
        return enrichBillTimeline(initialBill);
      }

      // 2. Query Client cache: inspect loaded dealer bill list queries
      const billQueries = queryClient.getQueriesData({ queryKey: dealerKeys.all });
      for (const [, list] of billQueries) {
        if (Array.isArray(list)) {
          const match = list.find((b) => b && b.id === billId);
          if (match) return enrichBillTimeline(match);
        }
      }

      // 3. Persistent cache: check single bill cache first
      const singleCached = getPersistentCache(`dealer_bill_detail_${billId}`);
      if (singleCached) {
        return enrichBillTimeline(singleCached);
      }

      // 4. Persistent cache: check all bills list cache
      const cachedList = getPersistentCache('dealers_bills_all');
      if (Array.isArray(cachedList)) {
        const match = cachedList.find((b) => b && b.id === billId);
        if (match) return enrichBillTimeline(match);
      }

      return undefined;
    },
    placeholderData: (prev) => prev,
  });
}

export function useDealerPayments(filters = {}) {
  return useQuery({
    queryKey: dealerKeys.payments(filters),
    queryFn: () => listDealerPayments(filters),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useDealerStatement(dealerId, { billType = 'all' } = {}) {
  return useQuery({
    queryKey: dealerKeys.statement(dealerId, billType),
    queryFn: () => getDealerStatement(dealerId, { billType }),
    enabled: Boolean(dealerId),
  });
}

export function useDealerAnalytics(storeId) {
  return useQuery({
    queryKey: dealerKeys.analytics(storeId),
    queryFn: () => getDealerAnalyticsSummary({ storeId }),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    initialData: () => {
      const cacheKey = `dealers_analytics_${storeId || 'all'}`;
      const cached = getPersistentCache(cacheKey);
      return cached || undefined;
    },
    placeholderData: (prev) => prev,
  });
}

export function useCreateDealer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDealer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealerKeys.all });
    },
  });
}

export function useUpdateDealer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateDealer(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dealerKeys.all });
      queryClient.invalidateQueries({ queryKey: dealerKeys.detail(variables.id) });
    },
  });
}

export function useCreateDealerBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDealerBill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealerKeys.all });
    },
  });
}

export function useRecordDealerPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordDealerPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealerKeys.all });
    },
  });
}

export function useCreateDealerDebitNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDealerDebitNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealerKeys.all });
    },
  });
}
