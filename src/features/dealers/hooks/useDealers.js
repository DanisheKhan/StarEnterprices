import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPersistentCache } from '@/shared/lib/cachePersistence';
import {
  listDealers,
  getDealerById,
  createDealer,
  listDealerBills,
  getDealerBillDetail,
  enrichBillTimeline,
  recordDealerPayment,
  createDealerDebitNote,
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
  statement: (dealerId, billType) => [...dealerKeys.all, 'statement', dealerId, billType || 'all'],
  analytics: (storeId) => [...dealerKeys.all, 'analytics', storeId || 'all'],
};

export function useDealers({ storeId, includeInactive = false } = {}) {
  return useQuery({
    queryKey: [...dealerKeys.list(storeId), includeInactive],
    queryFn: () => listDealers({ storeId, includeInactive }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: (prev) => {
      if (prev) return prev;
      const cached = getPersistentCache('dealers_directory');
      if (!Array.isArray(cached)) return undefined;
      if (storeId) {
        return cached.filter((d) => d && (!d.store_id || d.store_id === storeId));
      }
      return cached;
    },
  });
}

export function useDealer(dealerId) {
  return useQuery({
    queryKey: dealerKeys.detail(dealerId),
    queryFn: () => getDealerById(dealerId),
    enabled: Boolean(dealerId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useDealerBills(filters = {}) {
  return useQuery({
    queryKey: dealerKeys.bills(filters),
    queryFn: () => listDealerBills(filters),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: (prev) => {
      if (prev) return prev;
      const cacheKey = `dealers_bills_${filters.storeId || 'all'}`;
      const cached = getPersistentCache(cacheKey);
      return Array.isArray(cached) ? cached : undefined;
    },
  });
}

export function useDealerBillDetail(billId, initialBill = null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: dealerKeys.billDetail(billId),
    queryFn: () => getDealerBillDetail(billId),
    enabled: Boolean(billId),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => {
      if (prev) return prev;
      if (initialBill && initialBill.id === billId) {
        return enrichBillTimeline(initialBill);
      }
      const billQueries = queryClient.getQueriesData({ queryKey: dealerKeys.all });
      for (const [, list] of billQueries) {
        if (Array.isArray(list)) {
          const match = list.find((b) => b && b.id === billId);
          if (match) return enrichBillTimeline(match);
        }
      }
      const singleCached = getPersistentCache(`dealer_bill_detail_${billId}`);
      if (singleCached) {
        return enrichBillTimeline(singleCached);
      }
      const cachedList = getPersistentCache('dealers_bills_all');
      if (Array.isArray(cachedList)) {
        const match = cachedList.find((b) => b && b.id === billId);
        if (match) return enrichBillTimeline(match);
      }
      return undefined;
    },
  });
}

export function useDealerStatement(dealerId, { billType = 'all' } = {}) {
  return useQuery({
    queryKey: dealerKeys.statement(dealerId, billType),
    queryFn: () => getDealerStatement(dealerId, { billType }),
    enabled: Boolean(dealerId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useDealerAnalytics(storeId) {
  return useQuery({
    queryKey: dealerKeys.analytics(storeId),
    queryFn: () => getDealerAnalyticsSummary({ storeId }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: (prev) => {
      if (prev) return prev;
      const cacheKey = `dealers_analytics_${storeId || 'all'}`;
      const cached = getPersistentCache(cacheKey);
      return cached || undefined;
    },
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
