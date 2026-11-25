import { supabase } from '@/shared/lib/supabase';
import { getPersistentCache, setPersistentCache } from '@/shared/lib/cachePersistence';

/**
 * Places a sale transaction atomically via database RPC
 */
export async function placeSale({
  storeId,
  customerName = 'Walk-in Customer',
  customerPhone = null,
  customerGstin = null,
  customerRegion = null,
  customerAddress = null,
  customerCity = null,
  items,
  payments,
}) {
  const { data, error } = await supabase.rpc('place_sale', {
    p_store_id: storeId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_customer_gstin: customerGstin,
    p_items: items,
    p_payments: payments,
    p_customer_region: customerRegion,
    p_customer_address: customerAddress,
    p_customer_city: customerCity,
  });

  if (error) throw error;
  return data;
}

/**
 * Lists past invoices for a store
 */
export async function listInvoices({ storeId, limit = 50 } = {}) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, store_id, invoice_number, financial_year, customer_name, customer_phone, subtotal, discount_amount, cgst_amount, sgst_amount, grand_total, status, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const items = data || [];
    setPersistentCache(`invoices_${storeId}`, items);
    return items;
  } catch (err) {
    console.warn(`[Billing API] Network error, loading cached invoices for ${storeId}:`, err);
    return getPersistentCache(`invoices_${storeId}`) || [];
  }
}

/**
 * Lists all invoices across all stores with full filtering & relation telemetry
 */
export async function listAllInvoices({
  storeId = 'all',
  status = 'all',
  dateRange = 'all',
  search = '',
  limit = 200,
} = {}) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId || '');
  let query = supabase
    .from('invoices')
    .select(`
      id, store_id, invoice_number, financial_year, customer_name, customer_phone, customer_gstin,
      customer_region, customer_address, customer_city,
      subtotal, discount_amount, cgst_amount, sgst_amount, igst_amount, grand_total, status, created_at,
      stores (id, name, code, invoice_prefix, gstin, city),
      payments (id, payment_method, amount, reference_number),
      order_items (id, product_id, unit_id, item_name, serial_number, quantity, unit_price, discount, total_amount, gst_rate)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (storeId && storeId !== 'all' && isUuid) {
    query = query.eq('store_id', storeId);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search && search.trim()) {
    const q = search.trim().replace(/[,%()]/g, '');
    if (q) {
      query = query.or(
        `invoice_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,customer_gstin.ilike.%${q}%,customer_city.ilike.%${q}%`
      );
    }
  }

  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    let dateFilter = null;
    if (dateRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = startOfDay.toISOString();
    } else if (dateRange === 'week') {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = pastWeek.toISOString();
    } else if (dateRange === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = startOfMonth.toISOString();
    }
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }
  }

  try {
    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];

    // Mathematically normalize status against payment sums
    results = results.map((inv) => {
      if (inv.status !== 'void' && inv.status !== 'returned' && inv.status !== 'partially_returned') {
        const paid = (inv.payments || []).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const grandTotal = parseFloat(inv.grand_total) || 0;
        const due = grandTotal - paid;
        if (due <= 0.5) {
          return { ...inv, status: 'paid' };
        } else if (paid > 0) {
          return { ...inv, status: 'partial' };
        } else {
          return { ...inv, status: 'pending' };
        }
      }
      return inv;
    });

    // Filter in memory by storeCode or store_id if not 'all'
    if (storeId && storeId !== 'all') {
      results = results.filter((inv) => inv.store_id === storeId || inv.stores?.code === storeId);
    }

    // Filter by search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        (inv) =>
          (inv.invoice_number && inv.invoice_number.toLowerCase().includes(q)) ||
          (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
          (inv.customer_phone && inv.customer_phone.toLowerCase().includes(q)) ||
          (inv.customer_gstin && inv.customer_gstin.toLowerCase().includes(q)) ||
          (inv.customer_city && inv.customer_city.toLowerCase().includes(q)) ||
          (inv.stores?.name && inv.stores.name.toLowerCase().includes(q))
      );
    }

    if (storeId === 'all' && status === 'all' && dateRange === 'all' && !search) {
      setPersistentCache('all_invoices', results);
    }

    return results;
  } catch (err) {
    console.warn('[Billing API] Error fetching all invoices, using persistent cache:', err);
    return getPersistentCache('all_invoices') || [];
  }
}

/**
 * Updates an invoice, its line items, and payment details atomically via database RPC
 */
export async function updateInvoice({ invoiceId, updates, items = [], payment = null }) {
  const { data, error } = await supabase.rpc('update_invoice_atomic', {
    p_invoice_id: invoiceId,
    p_updates: {
      customer_name: updates.customer_name ?? 'Walk-in Customer',
      customer_phone: updates.customer_phone || null,
      customer_gstin: updates.customer_gstin || null,
      ...(updates.customer_city !== undefined ? { customer_city: updates.customer_city || null } : {}),
      ...(updates.customer_address !== undefined ? { customer_address: updates.customer_address || null } : {}),
      ...(updates.customer_region !== undefined ? { customer_region: updates.customer_region || null } : {}),
      status: updates.status || 'paid',
      subtotal: updates.subtotal,
      discount_amount: updates.discount_amount || 0,
      cgst_amount: updates.cgst_amount,
      sgst_amount: updates.sgst_amount,
      grand_total: updates.grand_total,
    },
    p_items: (items || [])
      .filter((it) => it.id)
      .map((it) => ({
        id: it.id,
        item_name: it.item_name,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        discount: Number(it.discount || 0),
        gst_rate: Number(it.gst_rate ?? 18),
      })),
    p_removed_item_ids: updates.removedItemIds || [],
    p_payment: payment
      ? {
          id: payment.id || null,
          payment_method: payment.payment_method || 'cash',
          ...(payment.reference_number !== undefined
            ? { reference_number: payment.reference_number || null }
            : {}),
        }
      : null,
  });

  if (error) throw error;
  return data;
}

/**
 * Fetches complete invoice with items and payments for receipt printing or editing
 */
export async function getInvoiceDetail(invoiceId) {
  const [invRes, itemsRes, payRes, retRes] = await Promise.all([
    supabase
      .from('invoices')
      .select(`
        id, store_id, invoice_number, financial_year, customer_name, customer_phone, customer_gstin,
        customer_region, customer_address, customer_city,
        subtotal, discount_amount, cgst_amount, sgst_amount, grand_total, status, created_at,
        stores (id, name, code, gstin, address_line1, city, pincode, phone, email)
      `)
      .eq('id', invoiceId)
      .single(),
    supabase
      .from('order_items')
      .select('id, product_id, unit_id, item_name, serial_number, hsn_code, quantity, unit_price, discount, taxable_value, gst_rate, cgst_amount, sgst_amount, total_amount, product_units(warranty_months), products(specs)')
      .eq('invoice_id', invoiceId),
    supabase
      .from('payments')
      .select('id, payment_method, amount, reference_number')
      .eq('invoice_id', invoiceId),
    supabase
      .from('sales_returns')
      .select('id, return_number, refund_amount, gross_amount, deduction_amount, deduction_reason, refund_method, reason, notes, created_at')
      .eq('invoice_id', invoiceId),
  ]);

  if (invRes.error) throw invRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (payRes.error) throw payRes.error;

  return {
    ...invRes.data,
    items: itemsRes.data || [],
    payments: payRes.data || [],
    returns: retRes.data || [],
  };
}

/**
 * Records a new payment installment for an invoice (e.g. partial balance collection)
 */
export async function recordPayment({ invoiceId, paymentMethod, amount, referenceNumber = null }) {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // 1. Insert into payments table
  const { data: payData, error: payErr } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      payment_method: paymentMethod,
      amount: numAmount,
      reference_number: referenceNumber || null,
    })
    .select()
    .single();

  if (payErr) throw payErr;

  // 2. Fetch all payments and invoice total to update invoice status
  const [invRes, allPaysRes] = await Promise.all([
    supabase.from('invoices').select('id, grand_total').eq('id', invoiceId).single(),
    supabase.from('payments').select('amount').eq('invoice_id', invoiceId),
  ]);

  if (invRes.error) throw invRes.error;

  const grandTotal = parseFloat(invRes.data?.grand_total || 0);
  const totalPaid = (allPaysRes.data || []).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

  let newStatus = 'partial';
  if (totalPaid >= grandTotal) {
    newStatus = 'paid';
  } else if (totalPaid <= 0) {
    newStatus = 'pending';
  }

  const { error: updErr } = await supabase
    .from('invoices')
    .update({ status: newStatus })
    .eq('id', invoiceId);

  if (updErr) throw updErr;

  return { payment: payData, status: newStatus, totalPaid, balanceDue: Math.max(grandTotal - totalPaid, 0) };
}

/**
 * Processes a sales return / refund atomically via database RPC with deduction tracking
 */
export async function processReturn({
  invoiceId,
  items,
  refundAmount,
  deductionAmount = 0,
  deductionReason = null,
  grossAmount = null,
  refundMethod,
  reason,
  notes,
}) {
  let resolvedItems = items;
  const missingProductItems = (items || []).filter((it) => !it.product_id && it.order_item_id);
  if (missingProductItems.length > 0) {
    const { data: dbItems } = await supabase
      .from('order_items')
      .select('id, product_id, unit_id')
      .in('id', missingProductItems.map((it) => it.order_item_id));

    if (dbItems && dbItems.length > 0) {
      const itemMap = new Map(dbItems.map((dbIt) => [dbIt.id, dbIt]));
      resolvedItems = items.map((it) => {
        if (!it.product_id && it.order_item_id && itemMap.has(it.order_item_id)) {
          const dbIt = itemMap.get(it.order_item_id);
          return {
            ...it,
            product_id: dbIt.product_id,
            unit_id: it.unit_id || dbIt.unit_id || null,
          };
        }
        return it;
      });
    }
  }

  const numRefund = Math.max(0, parseFloat(refundAmount) || 0);
  const numDeduction = Math.max(0, parseFloat(deductionAmount) || 0);
  const numGross = grossAmount != null ? parseFloat(grossAmount) : numRefund + numDeduction;

  const { data, error } = await supabase.rpc('process_return', {
    p_invoice_id: invoiceId,
    p_items: resolvedItems,
    p_refund_amount: numRefund,
    p_refund_method: refundMethod || 'cash',
    p_reason: reason || 'Customer Return',
    p_notes: notes || null,
    p_deduction_amount: numDeduction,
    p_deduction_reason: deductionReason || null,
    p_gross_amount: numGross,
  });

  if (error) throw error;
  return data;
}

/**
 * Searches past customers by mobile number prefix for rapid repeat POS billing
 */
export async function searchCustomersByPhone(phonePrefix) {
  const digits = String(phonePrefix || '').replace(/\D/g, '');
  if (digits.length < 4) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('id, customer_name, customer_phone, customer_gstin, customer_region, customer_address, customer_city, created_at')
    .ilike('customer_phone', `%${digits}%`)
    .neq('status', 'void')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  const seenPhones = new Set();
  const matches = [];
  for (const row of data || []) {
    const clean = String(row.customer_phone || '').replace(/\D/g, '');
    if (!clean || seenPhones.has(clean)) continue;
    seenPhones.add(clean);
    matches.push({
      name: row.customer_name || 'Walk-in Customer',
      phone: row.customer_phone,
      gstin: row.customer_gstin || '',
      region: row.customer_region || 'Bhusawal Town',
      address: row.customer_address || '',
      city: row.customer_city || '',
    });
    if (matches.length >= 5) break;
  }

  return matches;
}
