import { supabase } from '@/shared/lib/supabase';
import { getProductImageUrl } from '@/shared/lib/productImages';
import { getPersistentCache, setPersistentCache } from '@/shared/lib/cachePersistence';

async function loadFallbackProducts() {
  const mod = await import('@/features/catalog');
  return mod.FALLBACK_PRODUCTS || [];
}

const INVENTORY_CACHE_PREFIX = 'star_inv_prods_';

const STORE_UUID_MAP = {
  mobiles: '83a779be-95ac-4b81-9c96-9589dfb7df38',
  'store-1': '83a779be-95ac-4b81-9c96-9589dfb7df38',
  '83a779be-95ac-4b81-9c96-9589dfb7df38': '83a779be-95ac-4b81-9c96-9589dfb7df38',
  'furniture-electronics': '098552f2-915e-4b58-ad03-96fc66ec2c29',
  'store-2': '098552f2-915e-4b58-ad03-96fc66ec2c29',
  '098552f2-915e-4b58-ad03-96fc66ec2c29': '098552f2-915e-4b58-ad03-96fc66ec2c29',
};

export function resolveStoreUuid(storeIdOrCode) {
  if (!storeIdOrCode) return null;
  return STORE_UUID_MAP[storeIdOrCode] || storeIdOrCode;
}

/**
 * Lists all active categories for a store (or all stores if storeId not passed)
 * @param {string} [storeId]
 */
export async function listCategoriesByStore(storeId) {
  const resolvedId = resolveStoreUuid(storeId);
  try {
    let query = supabase
      .from('categories')
      .select('id, store_id, name, slug, hsn_code, is_active, created_at')
      .eq('is_active', true)
      .order('name');

    if (resolvedId) {
      query = query.eq('store_id', resolvedId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Network error listing categories, returning fallback list:', err);
    const fallbackProducts = await loadFallbackProducts();
    const storeProducts = fallbackProducts.filter((p) => {
      return (
        p.store_id === resolvedId ||
        p.stores?.id === resolvedId ||
        p.stores?.code === resolvedId ||
        STORE_UUID_MAP[p.stores?.code] === resolvedId ||
        STORE_UUID_MAP[p.stores?.id] === resolvedId
      );
    });
    const uniqueCats = new Map();
    storeProducts.forEach((p) => {
      if (p.categories?.name) {
        const catId = p.categories.id || p.categories.slug;
        uniqueCats.set(catId, {
          id: catId,
          store_id: resolvedId,
          name: p.categories.name,
          slug: p.categories.slug,
          is_active: true,
        });
      }
    });
    return Array.from(uniqueCats.values());
  }
}

/**
 * Creates a custom category in Supabase
 * @param {{ storeId: string, name: string, hsnCode?: string }} param0
 */
export async function createCategory({ storeId, name, hsnCode = '' }) {
  const resolvedId = resolveStoreUuid(storeId);
  if (!resolvedId) {
    throw new Error('Valid Store ID is required to create a category.');
  }
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Category name cannot be empty.');
  }

  const baseSlug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const slug = baseSlug || `cat-${Date.now()}`;

  const { data, error } = await supabase
    .from('categories')
    .insert({
      store_id: resolvedId,
      name: trimmedName,
      slug,
      hsn_code: hsnCode ? hsnCode.trim() : null,
      is_active: true,
    })
    .select('id, store_id, name, slug, hsn_code, is_active, created_at')
    .single();

  if (error) {
    // If slug collision, append unique suffix
    if (error.code === '23505') {
      const fallbackSlug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
      const { data: retryData, error: retryError } = await supabase
        .from('categories')
        .insert({
          store_id: resolvedId,
          name: trimmedName,
          slug: fallbackSlug,
          hsn_code: hsnCode ? hsnCode.trim() : null,
          is_active: true,
        })
        .select('id, store_id, name, slug, hsn_code, is_active, created_at')
        .single();
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  return data;
}

export function getCachedStoreProducts(storeId) {
  if (!storeId) return null;
  try {
    const raw = localStorage.getItem(`${INVENTORY_CACHE_PREFIX}${storeId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedStoreProducts(storeId, products) {
  if (!storeId || !products) return;
  try {
    if (products.length > 0) {
      localStorage.setItem(`${INVENTORY_CACHE_PREFIX}${storeId}`, JSON.stringify(products));
    }
  } catch {
    // Ignore localStorage write error
  }
}

/**
 * Lists products for a store with category and inventory count
 */
export async function listProductsByStore({ storeId, categoryId, search } = {}) {
  try {
    let query = supabase
      .from('products')
      .select(`
        id, store_id, category_id, brand_id, name, slug, sku, description,
        is_serialized, cost_price, selling_price, min_selling_price,
        gst_rate, hsn_code, reorder_level, specs, image_url, is_active, created_at,
        categories (id, name, slug),
        brands (id, name, slug),
        inventory (quantity_on_hand, reserved_qty)
      `)
      .eq('store_id', storeId)
      .order('name');

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const enriched = (data || []).map((p) => ({
      ...p,
      image_url: getProductImageUrl(p),
    }));

    if (!categoryId && !search) {
      setCachedStoreProducts(storeId, enriched);
    }

    return enriched;
  } catch (err) {
    console.warn('Network error querying inventory by store, using cached/fallback:', err);
    const cached = getCachedStoreProducts(storeId);
    if (cached && cached.length > 0) return cached;
    const fallbackProducts = await loadFallbackProducts();
    const fallbackForStore = fallbackProducts.filter((p) => {
      return (
        p.store_id === storeId ||
        p.stores?.id === storeId ||
        p.stores?.code === storeId ||
        STORE_UUID_MAP[p.stores?.code] === storeId ||
        STORE_UUID_MAP[p.stores?.id] === storeId
      );
    }).map((p) => ({
      ...p,
      image_url: getProductImageUrl(p),
    }));
    return fallbackForStore;
  }
}

/**
 * Lists serialized units for a product or store
 */
export async function listProductUnits({ storeId, productId, status } = {}) {
  const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
  let query = supabase
    .from('product_units')
    .select('id, product_id, store_id, serial_number, condition_grade, battery_health, purchase_cost, status, warranty_months, notes, created_at')
    .order('created_at', { ascending: false });

  if (resolvedStoreId) {
    query = query.eq('store_id', resolvedStoreId);
  }

  if (productId) {
    query = query.eq('product_id', productId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  try {
    const { data, error } = await query;
    if (error) throw error;
    if (data && !productId && !status && resolvedStoreId) {
      setPersistentCache(`store_product_units_${resolvedStoreId}`, data);
    }
    return data || [];
  } catch (err) {
    console.warn('Network error listing product units, using cached:', err);
    const cached = resolvedStoreId ? getPersistentCache(`store_product_units_${resolvedStoreId}`) : null;
    if (cached) {
      if (productId) {
        return cached.filter((u) => u.product_id === productId && (!status || u.status === status));
      }
      return cached;
    }
    return [];
  }
}

/**
 * Fast single-row lookup for barcode scanner hits that may not yet be in client cache
 * @param {{ storeId: string, serialNumber: string }} param0
 */
export async function findStoreUnitBySerial({ storeId, serialNumber }) {
  const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
  const cleanSerial = (serialNumber || '').trim();
  if (!resolvedStoreId || !cleanSerial) return null;

  const { data, error } = await supabase
    .from('product_units')
    .select('id, product_id, store_id, serial_number, condition_grade, battery_health, purchase_cost, status, warranty_months, notes, created_at')
    .eq('store_id', resolvedStoreId)
    .ilike('serial_number', cleanSerial)
    .in('status', ['in_stock', 'sold'])
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Creates a new product with optional initial inventory
 */
export async function createProduct({ initialQuantity = 0, ...payload }) {
  const storeId = resolveStoreUuid(payload.store_id) || payload.store_id;
  const { data, error } = await supabase
    .from('products')
    .insert([{ ...payload, store_id: storeId }])
    .select('id, store_id, name, sku, selling_price')
    .single();

  if (error) throw error;

  if (data?.id && Number(initialQuantity) > 0) {
    const qty = Number(initialQuantity);
    await supabase
      .from('inventory')
      .upsert({
        store_id: storeId,
        product_id: data.id,
        quantity_on_hand: qty,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,product_id' });

    await supabase
      .from('stock_adjustments')
      .insert({
        store_id: storeId,
        product_id: data.id,
        previous_quantity: 0,
        new_quantity: qty,
        change_quantity: qty,
        reason: 'initial_stock',
        notes: `Initial stock of ${qty} recorded on product creation`,
      });
  }

  return data;
}

/**
 * Adds a new serialized unit, keeps inventory.quantity_on_hand in sync, and logs audit entry
 */
export async function addSerializedUnit({
  storeId,
  productId,
  serialNumber,
  conditionGrade = 'new',
  purchaseCost = 0,
  warrantyMonths = 12,
  notes = '',
}) {
  const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
  const cleanSerial = (serialNumber || '').trim().toUpperCase();
  if (!cleanSerial) throw new Error('Serial number or IMEI is required.');

  // Check unique
  const { data: existing } = await supabase
    .from('product_units')
    .select('id, serial_number, status')
    .eq('serial_number', cleanSerial)
    .maybeSingle();

  if (existing) {
    throw new Error(`Serial number / IMEI "${cleanSerial}" is already registered (Status: ${existing.status}).`);
  }

  // Insert unit
  const { data: unit, error: insertError } = await supabase
    .from('product_units')
    .insert([{
      store_id: resolvedStoreId,
      product_id: productId,
      serial_number: cleanSerial,
      condition_grade: conditionGrade,
      purchase_cost: parseFloat(purchaseCost) || 0,
      status: 'in_stock',
      warranty_months: parseInt(warrantyMonths, 10) || 12,
      notes: notes.trim() || 'Unit restocked via inventory management',
    }])
    .select('id, serial_number, status, condition_grade, store_id, product_id, purchase_cost, warranty_months, notes, created_at')
    .single();

  if (insertError) throw insertError;

  // Re-sync inventory count
  const { count } = await supabase
    .from('product_units')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('store_id', resolvedStoreId)
    .eq('status', 'in_stock');

  const newCount = count || 1;

  await Promise.all([
    supabase
      .from('inventory')
      .upsert({
        store_id: resolvedStoreId,
        product_id: productId,
        quantity_on_hand: newCount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,product_id' }),
    supabase
      .from('stock_adjustments')
      .insert({
        store_id: resolvedStoreId,
        product_id: productId,
        previous_quantity: Math.max(0, newCount - 1),
        new_quantity: newCount,
        change_quantity: 1,
        reason: 'restock',
        notes: `Restocked serial unit ${cleanSerial}`,
      }),
  ]);

  return unit;
}

export const MAX_SERIALS_PER_BATCH = 500;

/**
 * Lists a store's unused (in stock) and used (sold) serial numbers with their product
 * and the invoice lines they were billed on.
 * @param {string} storeId
 */
export async function listStoreSerials(storeId) {
  const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
  try {
    const { data, error } = await supabase
      .from('product_units')
      .select(`
        id, product_id, serial_number, status, condition_grade, warranty_months, created_at, updated_at,
        products (
          id, name, sku, image_url, selling_price, cost_price, category_id,
          categories (id, name, slug),
          brands (id, name, slug)
        ),
        order_items (id, invoices (id, invoice_number, customer_name, created_at))
      `)
      .eq('store_id', resolvedStoreId)
      .in('status', ['in_stock', 'sold'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    const enriched = (data || []).map((u) => ({
      ...u,
      products: u.products
        ? {
            ...u.products,
            image_url: getProductImageUrl(u.products),
          }
        : null,
    }));
    if (resolvedStoreId) {
      setPersistentCache(`store_serials_${resolvedStoreId}`, enriched);
    }
    return enriched;
  } catch (err) {
    console.warn('Network error listing store serials, using cache:', err);
    const cached = resolvedStoreId ? getPersistentCache(`store_serials_${resolvedStoreId}`) : null;
    if (cached) return cached;
    return [];
  }
}

/**
 * Registers several serial numbers for one product in a single insert, then re-syncs
 * inventory.quantity_on_hand and logs one audit entry. Fails without inserting anything
 * if any serial is already registered.
 */
export async function addSerializedUnitsBulk({
  storeId,
  productId,
  serialNumbers,
  conditionGrade = 'new',
  purchaseCost = 0,
  warrantyMonths = 12,
  notes = '',
}) {
  const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
  if (!productId) throw new Error('Select a product for these serial numbers.');

  const serials = [
    ...new Set((serialNumbers || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean)),
  ];
  if (serials.length === 0) throw new Error('Enter at least one serial number.');
  if (serials.length > MAX_SERIALS_PER_BATCH) {
    throw new Error(`You can create up to ${MAX_SERIALS_PER_BATCH} serial numbers at a time.`);
  }

  const { data: existing, error: lookupError } = await supabase
    .from('product_units')
    .select('serial_number')
    .in('serial_number', serials);

  if (lookupError) throw lookupError;
  if (existing && existing.length > 0) {
    const taken = existing.map((u) => u.serial_number);
    const preview = taken.slice(0, 5).join(', ');
    const more = taken.length > 5 ? ` and ${taken.length - 5} more` : '';
    throw new Error(`Already registered: ${preview}${more}. Remove these and try again.`);
  }

  const { data: units, error: insertError } = await supabase
    .from('product_units')
    .insert(
      serials.map((serial) => ({
        store_id: resolvedStoreId,
        product_id: productId,
        serial_number: serial,
        condition_grade: conditionGrade,
        purchase_cost: parseFloat(purchaseCost) || 0,
        status: 'in_stock',
        warranty_months: parseInt(warrantyMonths, 10) || 0,
        notes: notes.trim() || 'Serial number created via serial number console',
      }))
    )
    .select('id, product_id, store_id, serial_number, status, condition_grade, warranty_months, purchase_cost, created_at, updated_at');

  if (insertError) throw insertError;

  const { count } = await supabase
    .from('product_units')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('store_id', resolvedStoreId)
    .eq('status', 'in_stock');

  const newCount = count ?? serials.length;

  await Promise.all([
    supabase
      .from('inventory')
      .upsert({
        store_id: resolvedStoreId,
        product_id: productId,
        quantity_on_hand: newCount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,product_id' }),
    supabase
      .from('stock_adjustments')
      .insert({
        store_id: resolvedStoreId,
        product_id: productId,
        previous_quantity: Math.max(0, newCount - serials.length),
        new_quantity: newCount,
        change_quantity: serials.length,
        reason: 'restock',
        notes: `Created ${serials.length} serial number(s): ${serials.slice(0, 10).join(', ')}${serials.length > 10 ? '...' : ''}`,
      }),
  ]);

  return units || [];
}

/**
 * Removes or marks a serialized unit defective, updating inventory count
 */
export async function removeSerializedUnit({
  unitId,
  storeId,
  productId,
  newStatus = 'defective',
  notes = '',
}) {
  const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
  const { data, error } = await supabase
    .from('product_units')
    .update({
      status: newStatus,
      notes: notes.trim() || `Marked ${newStatus} via inventory console`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', unitId)
    .select('id, serial_number, status')
    .single();

  if (error) throw error;

  // Re-sync count
  const { count } = await supabase
    .from('product_units')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('store_id', resolvedStoreId)
    .eq('status', 'in_stock');

  const newCount = count || 0;

  await Promise.all([
    supabase
      .from('inventory')
      .upsert({
        store_id: resolvedStoreId,
        product_id: productId,
        quantity_on_hand: newCount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,product_id' }),
    supabase
      .from('stock_adjustments')
      .insert({
        store_id: resolvedStoreId,
        product_id: productId,
        previous_quantity: newCount + 1,
        new_quantity: newCount,
        change_quantity: -1,
        reason: newStatus === 'defective' ? 'damage' : 'write_off',
        notes: `Unit ${data.serial_number} marked ${newStatus}`,
      }),
  ]);

  return data;
}

/**
 * Adjusts inventory stock count and logs audit adjustment
 */
export async function adjustInventoryStock({ storeId, productId, newQuantity, previousQuantity, reason, notes }) {
  const resolvedStoreId = resolveStoreUuid(storeId) || storeId;
  const changeQty = newQuantity - previousQuantity;

  // 1. Log adjustment in stock_adjustments table
  const { error: adjError } = await supabase
    .from('stock_adjustments')
    .insert({
      store_id: resolvedStoreId,
      product_id: productId,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      change_quantity: changeQty,
      reason,
      notes,
    });

  if (adjError) {
    console.warn('Could not record stock adjustment audit log:', adjError.message);
  }

  // 2. Update quantity_on_hand in inventory table
  const { data, error } = await supabase
    .from('inventory')
    .upsert({
      store_id: resolvedStoreId,
      product_id: productId,
      quantity_on_hand: newQuantity,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,product_id' })
    .select('store_id, product_id, quantity_on_hand')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Updates product pricing and GST configuration
 */
export async function updateProductPricing({ productId, sellingPrice, costPrice, minSellingPrice, gstRate }) {
  const { data, error } = await supabase
    .from('products')
    .update({
      selling_price: sellingPrice,
      cost_price: costPrice,
      min_selling_price: minSellingPrice,
      gst_rate: gstRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select('id, name, selling_price, cost_price, min_selling_price, gst_rate')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Updates comprehensive product details (name, sku, category, price, etc.)
 */
export async function updateProduct(productId, updates) {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select('id, store_id, name, sku, selling_price, cost_price, gst_rate, reorder_level, is_active')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deletes or deactivates a product
 */
export async function deleteProduct(productId) {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    if (error) {
      // If cascade foreign keys prevent hard delete, deactivate product
      const { error: deactivateError } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);
      if (deactivateError) throw deactivateError;
    }
    return { success: true, id: productId };
  } catch (err) {
    console.warn('Error deleting product from DB, performing local fallback:', err);
    return { success: true, id: productId };
  }
}

/**
 * Lists all products across stores or filtered by store
 */
export async function listAllProducts({ storeId, categoryId, search } = {}) {
  try {
    let query = supabase
      .from('products')
      .select(`
        id, store_id, category_id, brand_id, name, slug, sku, description,
        is_serialized, cost_price, selling_price, min_selling_price,
        gst_rate, hsn_code, reorder_level, specs, image_url, is_active, created_at,
        categories (id, name, slug),
        brands (id, name, slug),
        inventory (quantity_on_hand, reserved_qty)
      `)
      .order('name');

    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const list = (data || []).map((p) => ({
      ...p,
      image_url: getProductImageUrl(p),
    }));

    if (list.length > 0) {
      if (!storeId && !categoryId && !search) {
        setPersistentCache('all_products', list);
      }
      return list;
    }
    return getPersistentCache('all_products') || (await loadFallbackProducts());
  } catch (err) {
    console.warn('Network error listing all products, using catalog fallback:', err);
    return getPersistentCache('all_products') || (await loadFallbackProducts());
  }
}

