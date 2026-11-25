import { supabase } from '@/shared/lib/supabase';
import { getPersistentCache, setPersistentCache } from '@/shared/lib/cachePersistence';

const DEALER_COLUMNS = 'id, store_id, name, trade_name, brand_name, contact_person, phone, alternate_phone, email, address, city, state_code, gstin, pan_number, bank_name, account_number, ifsc_code, upi_id, dealer_type, billing_mode, default_credit_days, opening_balance, notes, is_active, created_at, updated_at';
const DEALER_BILL_COLUMNS = 'id, store_id, dealer_id, bill_type, bill_number, bill_date, credit_days, due_date, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax_amount, round_off, total_amount, paid_amount, balance_amount, status, cleared_at, payment_days_taken, attachment_url, notes, items, created_at, updated_at';
const DEALER_PAYMENT_COLUMNS = 'id, store_id, dealer_id, bill_id, payment_number, payment_date, amount, payment_mode, payment_channel, transaction_ref, cheque_date, receipt_attachment_url, notes, created_at';
const DEALER_DEBIT_NOTE_COLUMNS = 'id, store_id, dealer_id, bill_id, note_number, note_date, amount, reason, description, attachment_url, created_at';

/**
 * Lists all active dealers with computed ledger summaries via server-side RPC
 */
export async function listDealers({ storeId, includeInactive = false } = {}) {
  try {
    const { data, error } = await supabase.rpc('get_dealer_directory_summary', {
      p_store_id: storeId || null,
      p_include_inactive: Boolean(includeInactive),
    });

    if (error) throw error;
    const enriched = Array.isArray(data) ? data : [];

    if (!storeId && !includeInactive) {
      setPersistentCache('dealers_directory', enriched);
    }
    return enriched;
  } catch (err) {
    console.warn('[Dealers API] Network error loading dealers, using cache:', err);
    const cached = getPersistentCache('dealers_directory');
    return Array.isArray(cached) ? cached : [];
  }
}

/**
 * Gets a single dealer profile with bills and recent payments
 */
export async function getDealerById(dealerId) {
  const { data, error } = await supabase
    .from('dealers')
    .select(`
      ${DEALER_COLUMNS},
      bills:dealer_bills(${DEALER_BILL_COLUMNS}),
      payments:dealer_payments(${DEALER_PAYMENT_COLUMNS}),
      debit_notes:dealer_debit_notes(${DEALER_DEBIT_NOTE_COLUMNS})
    `)
    .eq('id', dealerId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Creates a new dealer profile
 */
export async function createDealer(payload) {
  const { data, error } = await supabase
    .from('dealers')
    .insert([
      {
        name: payload.name.trim(),
        brand_name: payload.brand_name?.trim() || payload.name.trim(),
        contact_person: payload.contact_person?.trim() || null,
        phone: payload.phone.trim(),
        alternate_phone: payload.alternate_phone?.trim() || null,
        email: payload.email?.trim() || null,
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || 'Local',
        state_code: payload.state_code || '09',
        gstin: payload.gstin?.trim().toUpperCase() || null,
        pan_number: payload.pan_number?.trim().toUpperCase() || null,
        bank_name: payload.bank_name?.trim() || null,
        account_number: payload.account_number?.trim() || null,
        ifsc_code: payload.ifsc_code?.trim().toUpperCase() || null,
        upi_id: payload.upi_id?.trim() || null,
        dealer_type: payload.dealer_type || 'brand_direct',
        billing_mode: payload.billing_mode || 'both',
        default_credit_days: Number(payload.default_credit_days) || 30,
        opening_balance: Number(payload.opening_balance) || 0,
        notes: payload.notes?.trim() || null,
        store_id: payload.store_id || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Enriches a bill with sortedTimeline combining payments and debit notes
 */
export function enrichBillTimeline(bill) {
  if (!bill) return null;
  if (bill.sortedTimeline && Array.isArray(bill.sortedTimeline)) return bill;

  const payments = (bill.payments || []).map((p) => ({
    ...p,
    timelineType: 'payment',
    timestamp: p.payment_date || p.created_at,
  }));

  const debits = (bill.debit_notes || []).map((d) => ({
    ...d,
    timelineType: 'debit_note',
    timestamp: d.note_date || d.created_at,
  }));

  const timeline = [...payments, ...debits].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  return {
    ...bill,
    sortedTimeline: timeline,
  };
}

/**
 * Lists dealer bills with optional filters (dealerId, billType: gst/kaccha, status, storeId)
 */
export async function listDealerBills({
  dealerId,
  billType,
  status,
  storeId,
  limit = 100,
} = {}) {
  const cacheKey = `dealers_bills_${storeId || 'all'}`;

  try {
    let query = supabase
      .from('dealer_bills')
      .select(`
        ${DEALER_BILL_COLUMNS},
        dealer:dealers(id, name, brand_name, phone, gstin, billing_mode),
        payments:dealer_payments(id, payment_number, payment_date, amount, payment_mode, payment_channel, transaction_ref, notes, cheque_date),
        debit_notes:dealer_debit_notes(id, note_number, note_date, amount, reason, description)
      `)
      .order('bill_date', { ascending: false })
      .limit(limit);

    if (dealerId) {
      query = query.eq('dealer_id', dealerId);
    }
    if (billType && billType !== 'all') {
      query = query.eq('bill_type', billType);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (storeId) {
      query = query.or(`store_id.eq.${storeId},store_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    const enriched = (data || []).map((bill) => {
      let daysOverdue = 0;
      let daysUntilDue = 0;
      if (bill.due_date && bill.balance_amount > 0) {
        const due = new Date(bill.due_date);
        const diffDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          daysOverdue = diffDays;
        } else {
          daysUntilDue = Math.abs(diffDays);
        }
      }

      return enrichBillTimeline({
        ...bill,
        daysOverdue,
        daysUntilDue,
        isOverdue: daysOverdue > 0,
      });
    });

    // Cache un-filtered base list
    if (!dealerId && !billType && !status) {
      setPersistentCache(cacheKey, enriched);
    }

    return enriched;
  } catch (err) {
    console.warn('[Dealers API] Network error loading bills, using cache:', err);
    const cached = getPersistentCache(cacheKey);
    return Array.isArray(cached) ? cached : [];
  }
}

/**
 * Gets comprehensive detail for a single bill including full payment and debit note timeline
 */
export async function getDealerBillDetail(billId) {
  const cacheKey = `dealer_bill_detail_${billId}`;

  try {
    const { data, error } = await supabase
      .from('dealer_bills')
      .select(`
        ${DEALER_BILL_COLUMNS},
        dealer:dealers(${DEALER_COLUMNS}),
        payments:dealer_payments(${DEALER_PAYMENT_COLUMNS}),
        debit_notes:dealer_debit_notes(${DEALER_DEBIT_NOTE_COLUMNS})
      `)
      .eq('id', billId)
      .single();

    if (error) throw error;

    const result = enrichBillTimeline(data);
    setPersistentCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[Dealers API] Network error fetching bill detail, checking cache:', err);
    const cached = getPersistentCache(cacheKey);
    if (cached) return cached;

    // Fallback: search in all bills persistent cache
    const allBills = getPersistentCache('dealers_bills_all');
    if (Array.isArray(allBills)) {
      const match = allBills.find((b) => b && b.id === billId);
      if (match) return enrichBillTimeline(match);
    }
    throw err;
  }
}

/**
 * Creates a new dealer bill (GST Tax Invoice or Kaccha Estimate)
 */
export async function createDealerBill(payload) {
  const creditDays = Number(payload.credit_days) || 30;
  const billDate = payload.bill_date || new Date().toISOString().split('T')[0];

  // Auto calculate due date
  const dueDateObj = new Date(billDate);
  dueDateObj.setDate(dueDateObj.getDate() + creditDays);
  const dueDate = dueDateObj.toISOString().split('T')[0];

  const totalAmount = Number(payload.total_amount || 0);
  const taxableAmount = Number(payload.taxable_amount || 0);
  const cgst = Number(payload.cgst_amount || 0);
  const sgst = Number(payload.sgst_amount || 0);
  const igst = Number(payload.igst_amount || 0);

  // Clean and validate items payload
  const items = Array.isArray(payload.items)
    ? payload.items
        .filter((it) => it && (it.name?.trim() || it.description?.trim()))
        .map((it) => ({
          name: (it.name || it.description || '').trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unit_price: Math.max(0, Number(it.unit_price ?? it.price) || 0),
          total: Math.max(
            0,
            Number(it.total) ||
              Math.max(1, Number(it.quantity) || 1) * Math.max(0, Number(it.unit_price ?? it.price) || 0)
          ),
          notes: it.notes?.trim() || null,
        }))
    : [];

  const { data, error } = await supabase
    .from('dealer_bills')
    .insert([
      {
        dealer_id: payload.dealer_id,
        store_id: payload.store_id || null,
        bill_type: payload.bill_type || 'gst',
        bill_number: payload.bill_number.trim(),
        bill_date: billDate,
        credit_days: creditDays,
        due_date: dueDate,
        taxable_amount: taxableAmount,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_tax_amount: cgst + sgst + igst,
        total_amount: totalAmount,
        items,
        notes: payload.notes?.trim() || null,
        attachment_url: payload.attachment_url || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // If initial payment(s) were provided (Fully Paid or Partially Paid / Split), record payment vouchers
  const initialPayments = Array.isArray(payload.initial_payments)
    ? payload.initial_payments
    : payload.initial_payment && Number(payload.initial_payment.amount) > 0
    ? [payload.initial_payment]
    : [];

  for (const pmt of initialPayments) {
    if (Number(pmt.amount) > 0) {
      try {
        await recordDealerPayment({
          dealer_id: payload.dealer_id,
          bill_id: data.id,
          store_id: payload.store_id || null,
          payment_date: pmt.payment_date || billDate,
          amount: Number(pmt.amount),
          payment_mode: pmt.payment_mode || 'cash',
          payment_channel:
            payload.bill_type === 'kaccha'
              ? 'secondary_cash'
              : (pmt.payment_channel || 'official_bank'),
          transaction_ref: pmt.transaction_ref || null,
          cheque_date: pmt.payment_mode === 'cheque' ? pmt.cheque_date || null : null,
          notes:
            pmt.notes?.trim() ||
            (pmt.cheque_bank
              ? `Initial payment via ${pmt.payment_mode?.toUpperCase()} (${pmt.cheque_bank}) on bill ${payload.bill_number}`
              : `Initial payment on bill ${payload.bill_number}`),
        });
      } catch (paymentErr) {
        console.error('[createDealerBill] Error recording initial payment voucher:', paymentErr);
      }
    }
  }

  return data;
}

/**
 * Records a partial or full payment against a dealer bill
 */
export async function recordDealerPayment(payload) {
  const paymentNumber =
    payload.payment_number ||
    `PAY-${Date.now().toString().slice(-6)}`;

  const { data, error } = await supabase
    .from('dealer_payments')
    .insert([
      {
        dealer_id: payload.dealer_id,
        bill_id: payload.bill_id || null,
        store_id: payload.store_id || null,
        payment_number: paymentNumber,
        payment_date: payload.payment_date || new Date().toISOString().split('T')[0],
        amount: Number(payload.amount),
        payment_mode: payload.payment_mode || 'bank_transfer',
        payment_channel: payload.payment_channel || 'official_bank',
        transaction_ref: payload.transaction_ref?.trim() || null,
        cheque_date: payload.cheque_date || null,
        receipt_attachment_url: payload.receipt_attachment_url || null,
        notes: payload.notes?.trim() || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Creates a debit note for returns, damage or rate revisions
 */
export async function createDealerDebitNote(payload) {
  const noteNumber =
    payload.note_number ||
    `DN-${Date.now().toString().slice(-6)}`;

  const { data, error } = await supabase
    .from('dealer_debit_notes')
    .insert([
      {
        dealer_id: payload.dealer_id,
        bill_id: payload.bill_id || null,
        store_id: payload.store_id || null,
        note_number: noteNumber,
        note_date: payload.note_date || new Date().toISOString().split('T')[0],
        amount: Number(payload.amount),
        reason: payload.reason || 'purchase_return',
        description: payload.description?.trim() || null,
        attachment_url: payload.attachment_url || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generates an end-to-end chronological Khata statement (passbook) for a dealer
 */
export async function getDealerStatement(dealerId, { billType = 'all' } = {}) {
  const [dealerRes, billsRes, paymentsRes, debitsRes] = await Promise.all([
    supabase.from('dealers').select('id, name, brand_name, phone, gstin, billing_mode, default_credit_days, opening_balance, is_active').eq('id', dealerId).single(),
    supabase.from('dealer_bills').select('id, dealer_id, store_id, bill_number, bill_date, credit_days, due_date, total_amount, paid_amount, balance_amount, status, bill_type, taxable_amount, cgst_amount, sgst_amount, igst_amount, items, notes, created_at').eq('dealer_id', dealerId).order('bill_date', { ascending: true }),
    supabase.from('dealer_payments').select('id, dealer_id, bill_id, payment_date, amount, payment_mode, payment_channel, transaction_ref, cheque_date, notes, created_at, bill:dealer_bills(bill_number, bill_type)').eq('dealer_id', dealerId).order('payment_date', { ascending: true }),
    supabase.from('dealer_debit_notes').select('id, dealer_id, bill_id, note_number, note_date, amount, reason, created_at, bill:dealer_bills(bill_number, bill_type)').eq('dealer_id', dealerId).order('note_date', { ascending: true }),
  ]);

  if (dealerRes.error) throw dealerRes.error;
  const dealer = dealerRes.data;

  let bills = billsRes.data || [];
  let payments = paymentsRes.data || [];
  let debits = debitsRes.data || [];

  if (billType !== 'all') {
    bills = bills.filter((b) => b.bill_type === billType);
    payments = payments.filter((p) => !p.bill || p.bill.bill_type === billType);
    debits = debits.filter((d) => !d.bill || d.bill.bill_type === billType);
  }

  // Combine into single ledger flow
  const ledgerEntries = [];

  bills.forEach((b) => {
    ledgerEntries.push({
      id: b.id,
      date: b.bill_date,
      entryType: 'BILL',
      billType: b.bill_type,
      refNumber: b.bill_number,
      description: `${b.bill_type === 'gst' ? 'GST Tax Invoice' : 'Kaccha Parchi/Slip'} (${b.status})`,
      debit: Number(b.total_amount), // Increases payable
      credit: 0,
      metadata: b,
    });
  });

  payments.forEach((p) => {
    ledgerEntries.push({
      id: p.id,
      date: p.payment_date,
      entryType: 'PAYMENT',
      billType: p.bill?.bill_type || 'unlinked',
      refNumber: p.payment_number,
      description: `Payment (${
        p.payment_mode === 'cheque' ? 'CHEQUE' : p.payment_mode?.toUpperCase()
      }${p.transaction_ref ? ` - ${p.transaction_ref}` : ''}${
        p.payment_mode === 'cheque' && p.cheque_date ? ` dated ${p.cheque_date}` : ''
      })`,
      debit: 0,
      credit: Number(p.amount), // Reduces payable
      metadata: p,
    });
  });

  debits.forEach((d) => {
    ledgerEntries.push({
      id: d.id,
      date: d.note_date,
      entryType: 'DEBIT_NOTE',
      billType: d.bill?.bill_type || 'unlinked',
      refNumber: d.note_number,
      description: `Debit Note (${d.reason.replace('_', ' ')})`,
      debit: 0,
      credit: Number(d.amount), // Reduces payable
      metadata: d,
    });
  });

  // Sort chronological
  ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute running balance
  let running = Number(dealer.opening_balance || 0);
  const rowsWithBalance = ledgerEntries.map((row) => {
    running = running + row.debit - row.credit;
    return {
      ...row,
      runningBalance: running,
    };
  });

  return {
    dealer,
    openingBalance: Number(dealer.opening_balance || 0),
    closingBalance: running,
    totalBillsAmount: bills.reduce((s, b) => s + Number(b.total_amount), 0),
    totalPaidAmount: payments.reduce((s, p) => s + Number(p.amount), 0),
    totalDebitsAmount: debits.reduce((s, d) => s + Number(d.amount), 0),
    entries: rowsWithBalance,
  };
}

/**
 * Computes high level executive analytics across all dealers
 */
export async function getDealerAnalyticsSummary({ storeId } = {}) {
  const cacheKey = `dealers_analytics_${storeId || 'all'}`;

  try {
    let query = supabase.from('dealer_bills').select(`
      id, bill_type, total_amount, paid_amount, balance_amount, status, bill_date, due_date, cleared_at, payment_days_taken, store_id
    `);

    if (storeId) {
      query = query.or(`store_id.eq.${storeId},store_id.is.null`);
    }

    const { data: bills, error } = await query;
    if (error) throw error;

    const allBills = bills || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    let totalPayable = 0;
    let gstPayable = 0;
    let kacchaPayable = 0;
    let totalPurchases = 0;
    let totalPaid = 0;

    let overdueCount = 0;
    let overdueAmount = 0;

    // Aging buckets for outstanding balances
    const aging = {
      current: { count: 0, amount: 0 }, // 0 to due_date
      bucket0_15: { count: 0, amount: 0 }, // 1 to 15 days overdue
      bucket16_30: { count: 0, amount: 0 }, // 16 to 30 days overdue
      bucket31_60: { count: 0, amount: 0 }, // 31 to 60 days overdue
      bucket60_plus: { count: 0, amount: 0 }, // 60+ days overdue
    };

    const clearedDays = [];

    allBills.forEach((b) => {
      const total = Number(b.total_amount || 0);
      const paid = Number(b.paid_amount || 0);
      const balance = Number(b.balance_amount || 0);

      totalPurchases += total;
      totalPaid += paid;
      totalPayable += balance;

      if (b.bill_type === 'gst') {
        gstPayable += balance;
      } else {
        kacchaPayable += balance;
      }

      if (b.status === 'paid' && b.payment_days_taken != null) {
        clearedDays.push(Number(b.payment_days_taken));
      }

      if (balance > 0 && b.due_date) {
        const due = new Date(b.due_date);
        const diffDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          aging.current.count += 1;
          aging.current.amount += balance;
        } else {
          overdueCount += 1;
          overdueAmount += balance;

          if (diffDays <= 15) {
            aging.bucket0_15.count += 1;
            aging.bucket0_15.amount += balance;
          } else if (diffDays <= 30) {
            aging.bucket16_30.count += 1;
            aging.bucket16_30.amount += balance;
          } else if (diffDays <= 60) {
            aging.bucket31_60.count += 1;
            aging.bucket31_60.amount += balance;
          } else {
            aging.bucket60_plus.count += 1;
            aging.bucket60_plus.amount += balance;
          }
        }
      }
    });

    const avgDaysToClear =
      clearedDays.length > 0
        ? Math.round(clearedDays.reduce((a, c) => a + c, 0) / clearedDays.length)
        : null;

    const summary = {
      totalPayable,
      gstPayable,
      kacchaPayable,
      totalPurchases,
      totalPaid,
      overdueCount,
      overdueAmount,
      avgDaysToClear,
      aging,
    };

    setPersistentCache(cacheKey, summary);
    return summary;
  } catch (err) {
    console.warn('[Dealers API] Network error loading analytics summary, using cache:', err);
    return getPersistentCache(cacheKey) || null;
  }
}
