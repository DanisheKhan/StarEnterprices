import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProductsByStore,
  listProductUnits,
  createProductUnit,
  createProduct,
  adjustInventoryStock,
  addSerializedUnit,
  addSerializedUnitsBulk,
  listStoreSerials,
  removeSerializedUnit,
  updateProductPricing,
  getCachedStoreProducts,
  listAllProducts,
  updateProduct,
  deleteProduct,
  listCategoriesByStore,
  createCategory,
  resolveStoreUuid,
} from '../api/inventory.api';
import { getPersistentCache, setPersistentCache } from '@/shared/lib/cachePersistence';

export const inventoryKeys = {
  all: ['inventory'],
  products: (storeId, filters) => [...inventoryKeys.all, 'products', storeId, filters],
  units: (storeId, productId, status) => [...inventoryKeys.all, 'units', storeId, productId, status],
  categories: (storeId) => [...inventoryKeys.all, 'categories', storeId],
  serials: (storeId) => [...inventoryKeys.all, 'serials', storeId],
};

export function useProducts(storeId, filters = {}) {
  const hasFilters = Boolean(filters?.search || filters?.categoryId);
  return useQuery({
    queryKey: inventoryKeys.products(storeId, filters),
    queryFn: () => listProductsByStore({ storeId, ...filters }),
    placeholderData: () => (!hasFilters ? getCachedStoreProducts(storeId) || undefined : undefined),
    enabled: Boolean(storeId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useProductUnits(storeId, productId = null, status = null, options = {}) {
  const isEnabled = options.enabled !== undefined ? Boolean(storeId && options.enabled) : Boolean(storeId);
  return useQuery({
    queryKey: inventoryKeys.units(storeId, productId, status),
    queryFn: () => listProductUnits({ storeId, productId, status }),
    placeholderData: () => {
      if (!storeId) return undefined;
      const resolvedId = resolveStoreUuid(storeId) || storeId;
      const cached = getPersistentCache(`store_product_units_${resolvedId}`);
      if (!cached) return undefined;
      if (productId) {
        return cached.filter((u) => u.product_id === productId && (!status || u.status === status));
      }
      return cached;
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    ...options,
  });
}

export function useCreateProductUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProductUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adjustInventoryStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useAddSerializedUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addSerializedUnit,
    onSuccess: (createdUnit, variables) => {
      const storeId = variables?.storeId;
      const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
      if (createdUnit && resolvedStoreId) {
        const products = queryClient.getQueryData(inventoryKeys.products(storeId, {})) || [];
        const prod = products.find((p) => p.id === variables.productId) || null;
        const hydrated = {
          ...createdUnit,
          products: prod,
          order_items: [],
        };
        for (const keyId of new Set([storeId, resolvedStoreId].filter(Boolean))) {
          queryClient.setQueryData(inventoryKeys.serials(keyId), (old) =>
            Array.isArray(old) ? [hydrated, ...old.filter((u) => u.id !== hydrated.id)] : [hydrated]
          );
          queryClient.setQueryData(inventoryKeys.units(keyId, null, null), (old) =>
            Array.isArray(old) ? [createdUnit, ...old.filter((u) => u.id !== createdUnit.id)] : [createdUnit]
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useStoreSerials(storeId) {
  const resolvedId = resolveStoreUuid(storeId) || storeId;
  return useQuery({
    queryKey: inventoryKeys.serials(storeId),
    queryFn: () => listStoreSerials(storeId),
    placeholderData: () => (resolvedId ? getPersistentCache(`store_serials_${resolvedId}`) || undefined : undefined),
    enabled: Boolean(storeId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useAddSerializedUnitsBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addSerializedUnitsBulk,
    onSuccess: (createdUnits, variables) => {
      const storeId = variables?.storeId;
      const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
      if (Array.isArray(createdUnits) && createdUnits.length > 0 && resolvedStoreId) {
        const products = queryClient.getQueryData(inventoryKeys.products(storeId, {})) || [];
        const prod = products.find((p) => p.id === variables.productId) || null;
        const hydratedUnits = createdUnits.map((u) => ({
          ...u,
          products: prod,
          order_items: [],
        }));
        const createdIds = new Set(createdUnits.map((u) => u.id));

        for (const keyId of new Set([storeId, resolvedStoreId].filter(Boolean))) {
          queryClient.setQueryData(inventoryKeys.serials(keyId), (old) => {
            const next = Array.isArray(old)
              ? [...hydratedUnits, ...old.filter((u) => !createdIds.has(u.id))]
              : hydratedUnits;
            setPersistentCache(`store_serials_${resolvedStoreId}`, next);
            return next;
          });
          queryClient.setQueryData(inventoryKeys.units(keyId, null, null), (old) => {
            const next = Array.isArray(old)
              ? [...createdUnits, ...old.filter((u) => !createdIds.has(u.id))]
              : createdUnits;
            setPersistentCache(`store_product_units_${resolvedStoreId}`, next);
            return next;
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useRemoveSerializedUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeSerializedUnit,
    onMutate: async (variables) => {
      const storeId = variables?.storeId;
      const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
      await queryClient.cancelQueries({ queryKey: inventoryKeys.all });

      const prevSerials = storeId ? queryClient.getQueryData(inventoryKeys.serials(storeId)) : undefined;
      const prevUnits = storeId ? queryClient.getQueryData(inventoryKeys.units(storeId, null, null)) : undefined;

      for (const keyId of new Set([storeId, resolvedStoreId].filter(Boolean))) {
        queryClient.setQueryData(inventoryKeys.serials(keyId), (old) => {
          if (!Array.isArray(old)) return old;
          const next = old.filter((u) => u.id !== variables.unitId);
          setPersistentCache(`store_serials_${resolvedStoreId}`, next);
          return next;
        });
        queryClient.setQueryData(inventoryKeys.units(keyId, null, null), (old) => {
          if (!Array.isArray(old)) return old;
          const next = old.filter((u) => u.id !== variables.unitId);
          setPersistentCache(`store_product_units_${resolvedStoreId}`, next);
          return next;
        });
      }

      return { prevSerials, prevUnits, storeId };
    },
    onError: (_err, _variables, context) => {
      if (context?.storeId && context.prevSerials !== undefined) {
        queryClient.setQueryData(inventoryKeys.serials(context.storeId), context.prevSerials);
      }
      if (context?.storeId && context.prevUnits !== undefined) {
        queryClient.setQueryData(inventoryKeys.units(context.storeId, null, null), context.prevUnits);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdatePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProductPricing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useAllProducts(filters = {}) {
  const isDefault = !filters || Object.keys(filters).length === 0;
  return useQuery({
    queryKey: [...inventoryKeys.all, 'all-products', filters],
    queryFn: () => listAllProducts(filters),
    placeholderData: () => (isDefault ? getPersistentCache('all_products') || undefined : undefined),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, updates }) => updateProduct(productId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useCategories(storeId) {
  return useQuery({
    queryKey: inventoryKeys.categories(storeId),
    queryFn: () => listCategoriesByStore(storeId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
