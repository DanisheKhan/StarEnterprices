import { supabase } from '@/shared/lib/supabase';
import { getProductImageUrl } from '@/shared/lib/productImages';

export { getProductImageUrl };

const PUBLIC_CATALOG_CACHE_KEY = 'star_public_catalog_cache_v3';

export function getCachedPublicCatalog() {
  try {
    localStorage.removeItem('star_public_catalog_cache_v2');
    const raw = localStorage.getItem(PUBLIC_CATALOG_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore localStorage parse error
  }
  return undefined;
}

function setCachedPublicCatalog(products) {
  try {
    localStorage.removeItem('star_public_catalog_cache_v2');
    if (Array.isArray(products)) {
      localStorage.setItem(PUBLIC_CATALOG_CACHE_KEY, JSON.stringify(products));
    }
  } catch {
    // Ignore localStorage write error
  }
}

/**
 * Lists all active public products across all stores with optional filtering
 *
 * @param {Object} [params]
 * @param {string} [params.storeCode] - 'mobiles' | 'furniture-electronics' | 'all'
 * @param {string} [params.categorySlug]
 * @param {string} [params.search]
 */
export async function listPublicProducts({ storeCode = 'all', categorySlug = '', search = '' } = {}) {
  try {
    let query = supabase
      .from('products')
      .select(`
        id, store_id, category_id, brand_id, name, slug, sku, description,
        is_serialized, cost_price, selling_price, min_selling_price,
        gst_rate, hsn_code, specs, image_url, is_active,
        stores (id, code, name),
        categories (id, name, slug),
        brands (id, name, slug),
        inventory (quantity_on_hand)
      `)
      .eq('is_active', true)
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query error loading public catalog:', error.message);
      return getCachedPublicCatalog() || [];
    }

    const enriched = (data || []).map((p) => ({
      ...p,
      image_url: getProductImageUrl(p),
    }));

    if (!search) {
      setCachedPublicCatalog(enriched);
    }

    // Filter by storeCode if specified
    let filtered = enriched;
    if (storeCode && storeCode !== 'all') {
      filtered = filtered.filter((p) => p.stores?.code === storeCode);
    }

    if (categorySlug) {
      filtered = filtered.filter((p) => p.categories?.slug === categorySlug);
    }

    return filtered;
  } catch (err) {
    console.warn('Network error querying catalog:', err);
    return getCachedPublicCatalog() || [];
  }
}
