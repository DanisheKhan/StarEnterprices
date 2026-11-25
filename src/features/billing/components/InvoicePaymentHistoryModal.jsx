import { useState } from 'react';
import { Modal, Button, Badge, LoadingState } from '@/shared/ui';
import { motion } from '@/shared/motion';
import { formatCurrency, formatDate, formatPhone, toTitleCase } from '@/shared/lib/format';
import { useInvoiceDetail } from '../hooks/useBilling';
import { cn } from '@/shared/lib/cn';
import {
  FileText,
  ArrowDownLeft,
  CheckCircle2,
  RotateCcw,
  Clock,
  Receipt,
  Printer,
  Coins,
  User,
  Phone,
  MapPin,
  Store,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wallet,
} from 'lucide-react';

const STATUS_BADGE_MAP = {
  paid: { variant: 'success', label: 'Paid in Full' },
  partial: { variant: 'warning', label: 'Partially Paid' },
  pending: { variant: 'danger', label: 'Payment Pending' },
  returned: { variant: 'warning', label: 'Returned' },
  void: { variant: 'default', label: 'Void / Cancelled' },
};

const METHOD_BADGE_MAP = {
  CASH: 'Cash Register',
  UPI: 'UPI / QR Scan',
  CARD: 'Card / POS Swipe',
  EMI: 'Consumer EMI',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
};

function formatMethodLabel(method) {
  const key = String(method || '').toUpperCase().trim();
  return METHOD_BADGE_MAP[key] || toTitleCase(key.replace(/_/g, ' ')) || 'Payment';
}

export function InvoicePaymentHistoryModal({
  isOpen,
  onClose,
  invoiceId,
  initialInvoice = null,
  onOpenPrint,
  onOpenCollect,
}) {
  const [showItems, setShowItems] = useState(false);
  const { data: detail, isLoading } = useInvoiceDetail(isOpen ? invoiceId : null);

  if (!isOpen) return null;

  const inv = detail || initialInvoice;

  if (!inv) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Invoice & Payment History" size="lg">
        <LoadingState label="Loading invoice payment history..." />
      </Modal>
    );
  }

  const items = inv.items || inv.order_items || [];
  const rawPayments = inv.payments || [];
  const rawReturns = inv.returns || [];

  const payments = [...rawPayments].sort(
    (a, b) => new Date(a.created_at || inv.created_at || 0) - new Date(b.created_at || inv.created_at || 0)
  );
  const returns = [...rawReturns].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );

  const grandTotal = Number(inv.grand_total || 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalRefunded = returns.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
  const balanceDue = Math.max(0, grandTotal - totalPaid);

  const effectiveStatus =
    inv.status === 'void' || inv.status === 'returned'
      ? inv.status
      : balanceDue <= 0.01
        ? 'paid'
        : totalPaid > 0
          ? 'partial'
          : inv.status || 'pending';

  const isTaxInvoice =
    Boolean(inv.customer_gstin) ||
    Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0) + Number(inv.igst_amount || 0) > 0;

  const statusMeta = STATUS_BADGE_MAP[effectiveStatus] || { variant: 'default', label: effectiveStatus };
  const collectedPct = grandTotal > 0 ? Math.min(100, Math.round((totalPaid / grandTotal) * 100)) : 0;

  // Build chronological timeline entries with running balance (pure reduce to satisfy react-hooks/immutability)
  const chronologicalEvents = [
    ...payments.map((p, idx) => ({
      kind: 'payment',
      id: p.id || `pay-${idx}`,
      installmentNo: idx + 1,
      method: p.payment_method,
      amount: Number(p.amount || 0),
      reference: p.reference_number,
      timestamp: p.created_at || inv.created_at,
      hasExactTimestamp: Boolean(p.created_at),
    })),
    ...returns.map((r, idx) => ({
      kind: 'return',
      id: r.id || `ret-${idx}`,
      returnNumber: r.return_number,
      method: r.refund_method,
      amount: Number(r.refund_amount || 0),
      grossAmount: Number(r.gross_amount || 0),
      deductionAmount: Number(r.deduction_amount || 0),
      reason: r.reason || r.notes,
      timestamp: r.created_at,
      hasExactTimestamp: Boolean(r.created_at),
    })),
  ]
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
    .reduce(
      (acc, evt) => {
        if (evt.kind === 'payment') {
          const nextRunningPaid = acc.runningPaid + evt.amount;
          return {
            runningPaid: nextRunningPaid,
            events: [
              ...acc.events,
              {
                ...evt,
                runningPaid: nextRunningPaid,
                remainingAfter: Math.max(0, grandTotal - nextRunningPaid),
              },
            ],
          };
        }
        return {
          runningPaid: acc.runningPaid,
          events: [...acc.events, evt],
        };
      },
      { runningPaid: 0, events: [] }
    ).events;

  const customerLocation = [toTitleCase(inv.customer_city), toTitleCase(inv.customer_address)]
    .filter(Boolean)
    .join(' — ');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invoice & Payment History" size="lg">
      <div className="space-y-4">
        {/* 1. Header Summary Card */}
        <div className="rounded-xl border border-border bg-surface-subtle/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-text">#{inv.invoice_number}</span>
              <Badge variant={isTaxInvoice ? 'primary' : 'default'}>
                {isTaxInvoice ? 'GST Tax Invoice' : 'Retail / Cash Bill'}
              </Badge>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <User size={14} className="text-muted shrink-0" />
              <span className="truncate">{toTitleCase(inv.customer_name || 'Walk-in Customer')}</span>
              {inv.customer_gstin && (
                <span className="font-mono text-[11px] font-normal text-muted uppercase">
                  • GSTIN {inv.customer_gstin}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {inv.customer_phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} className="shrink-0" />
                  <span className="font-mono">{formatPhone(inv.customer_phone)}</span>
                </span>
              )}
              {customerLocation && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="shrink-0" />
                  <span>{customerLocation}</span>
                </span>
              )}
              {inv.stores?.name && (
                <span className="inline-flex items-center gap-1">
                  <Store size={12} className="shrink-0" />
                  <span>{toTitleCase(inv.stores.name)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {effectiveStatus === 'returned'
                ? 'Total Refunded'
                : effectiveStatus === 'void'
                  ? 'Invoice Voided'
                  : 'Remaining Balance'}
            </p>
            <p
              className={cn(
                'text-2xl font-bold font-mono tabular-nums mt-0.5',
                effectiveStatus === 'paid'
                  ? 'text-brand-sage'
                  : effectiveStatus === 'returned'
                    ? 'text-amber-700'
                    : effectiveStatus === 'void'
                      ? 'text-muted'
                      : 'text-brand-crimson'
              )}
            >
              {effectiveStatus === 'returned'
                ? formatCurrency(totalRefunded || totalPaid)
                : effectiveStatus === 'void'
                  ? '₹0'
                  : formatCurrency(balanceDue)}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {collectedPct}% of {formatCurrency(grandTotal)} collected
            </p>
          </div>
        </div>

        {/* 2. Collection Status Banner */}
        {effectiveStatus === 'paid' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
              <span>
                Settled in full across <strong className="font-mono">{payments.length}</strong>{' '}
                {payments.length === 1 ? 'installment' : 'installments'}.
              </span>
            </div>
            <span className="font-mono font-bold text-emerald-800 shrink-0">
              {formatCurrency(totalPaid)} Received
            </span>
          </div>
        )}

        {balanceDue > 0.01 && effectiveStatus !== 'void' && effectiveStatus !== 'returned' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-amber-700 shrink-0" />
              <span>
                {payments.length > 0 ? (
                  <>
                    Collected <strong className="font-mono">{formatCurrency(totalPaid)}</strong> in{' '}
                    <strong className="font-mono">{payments.length}</strong>{' '}
                    {payments.length === 1 ? 'entry' : 'entries'}. Pending udhaar balance:{' '}
                    <strong className="font-mono">{formatCurrency(balanceDue)}</strong>.
                  </>
                ) : (
                  <>
                    No payment received yet. Full invoice amount of{' '}
                    <strong className="font-mono">{formatCurrency(balanceDue)}</strong> is due on credit.
                  </>
                )}
              </span>
            </div>
            <span className="font-mono font-bold text-amber-800 shrink-0">{collectedPct}% Paid</span>
          </div>
        )}

        {/* 3. 4-Column Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-border bg-surface p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Invoice Date</p>
            <p className="text-xs font-semibold text-text mt-1">{formatDate(inv.created_at, false)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Installments</p>
            <p className="text-xs font-semibold font-mono text-text mt-1">
              {payments.length} {payments.length === 1 ? 'Entry' : 'Entries'}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Paid So Far</p>
            <p className="text-xs font-bold font-mono text-brand-sage mt-1">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Total Bill</p>
            <p className="text-xs font-bold font-mono text-text mt-1">
              {formatCurrency(grandTotal)}
            </p>
          </div>
        </div>

        {/* 4. Purchased Items Collapsible Section */}
        {items.length > 0 && (
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => setShowItems((prev) => !prev)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-text bg-surface-subtle/50 hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Receipt size={13} className="text-muted shrink-0" />
                <span>
                  Billed Items ({items.length} {items.length === 1 ? 'Item' : 'Items'})
                </span>
              </span>
              {showItems ? (
                <ChevronUp size={14} className="text-muted" />
              ) : (
                <ChevronDown size={14} className="text-muted" />
              )}
            </button>

            {showItems && (
              <div className="divide-y divide-border/60">
                {items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-text truncate">
                        {toTitleCase(item.item_name || 'Item')}
                      </p>
                      <p className="text-[11px] text-muted font-mono">
                        Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                        {item.serial_number ? ` • S/N: ${item.serial_number}` : ''}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-text shrink-0">
                      {formatCurrency(item.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Chronological Ledger Spine Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Wallet size={13} />
              Payment & Settlement Timeline
            </h4>
            {isLoading && <span className="text-[11px] text-muted">Refreshing timestamps...</span>}
          </div>

          <div className="relative pl-6 pt-1 pb-1">
            {/* Vertical Timeline Spine */}
            <div
              className="absolute left-2.5 -translate-x-1/2 top-3 bottom-3 w-0.5 bg-border"
              aria-hidden="true"
            />

            <div className="flex flex-col-reverse gap-3.5">
              {/* Base Event: Invoice Created */}
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <span
                  className="absolute -left-6 top-2.5 w-5 h-5 rounded-full bg-surface border-2 border-border flex items-center justify-center text-muted"
                  aria-hidden="true"
                >
                  <FileText size={10} />
                </span>
                <div className="rounded-lg border border-border bg-surface-subtle/50 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-text">Invoice Generated</p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {formatDate(inv.created_at, true)} • Bill #{inv.invoice_number}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-text">
                      {formatCurrency(grandTotal)}
                    </span>
                    <p className="text-[10px] text-muted uppercase">Bill Total</p>
                  </div>
                </div>
              </motion.div>

              {/* Subsequent Installment & Return Events */}
              {chronologicalEvents.map((evt, idx) => {
                if (evt.kind === 'return') {
                  return (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(0.25, idx * 0.04) }}
                      className="relative"
                    >
                      <span
                        className="absolute -left-6 top-2.5 w-5 h-5 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center text-amber-700"
                        aria-hidden="true"
                      >
                        <RotateCcw size={10} />
                      </span>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-amber-950">
                              Sales Return & Refund
                            </span>
                            {evt.returnNumber && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                                #{evt.returnNumber}
                              </span>
                            )}
                            {evt.method && (
                              <Badge variant="warning">{formatMethodLabel(evt.method)}</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-amber-900/80">
                            {formatDate(evt.timestamp, true)}
                            {evt.reason ? ` • ${toTitleCase(evt.reason)}` : ''}
                          </p>
                          {evt.deductionAmount > 0 && (
                            <p className="text-[10px] text-amber-800 font-mono">
                              Gross: {formatCurrency(evt.grossAmount)} • Deduction:{' '}
                              {formatCurrency(evt.deductionAmount)}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm font-bold text-amber-800">
                            -{formatCurrency(evt.amount)}
                          </span>
                          <p className="text-[10px] text-amber-700 uppercase font-semibold">Refunded</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(0.25, idx * 0.04) }}
                    className="relative"
                  >
                    <span
                      className="absolute -left-6 top-2.5 w-5 h-5 rounded-full bg-emerald-100 border-2 border-emerald-600 flex items-center justify-center text-emerald-700"
                      aria-hidden="true"
                    >
                      <ArrowDownLeft size={10} />
                    </span>
                    <div className="rounded-lg border border-emerald-200/80 bg-surface p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-text">
                            {evt.installmentNo === 1 && payments.length > 1
                              ? 'Payment #1 (Initial)'
                              : `Payment #${evt.installmentNo}`}
                          </span>
                          <Badge variant="success">{formatMethodLabel(evt.method)}</Badge>
                          {evt.reference && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-muted">
                              Ref: {evt.reference}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted">
                          {formatDate(evt.timestamp, evt.hasExactTimestamp)}
                          {!evt.hasExactTimestamp ? ' (At Invoice Time)' : ''}
                        </p>
                        <p className="text-[11px] text-muted font-mono">
                          Cumulative Paid: {formatCurrency(evt.runningPaid)} • Balance Left:{' '}
                          <span
                            className={cn(
                              'font-semibold',
                              evt.remainingAfter <= 0.01 ? 'text-brand-sage' : 'text-brand-crimson'
                            )}
                          >
                            {formatCurrency(evt.remainingAfter)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-sm font-bold text-brand-sage">
                          +{formatCurrency(evt.amount)}
                        </span>
                        <p className="text-[10px] text-muted uppercase">Received</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Settled Milestone Footer (renders at top because of flex-col-reverse) */}
              {effectiveStatus === 'paid' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="relative"
                >
                  <span
                    className="absolute -left-6 top-2.5 w-5 h-5 rounded-full bg-brand-sage text-white flex items-center justify-center shadow-2xs"
                    aria-hidden="true"
                  >
                    <Sparkles size={10} />
                  </span>
                  <div className="rounded-lg border border-brand-sage/40 bg-brand-sage-subtle/40 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-brand-sage">
                      Invoice Account Cleared & Settled
                    </span>
                    <span className="font-mono font-bold text-brand-sage">₹0 Due</span>
                  </div>
                </motion.div>
              )}

              {/* Empty state when zero payments & zero returns recorded */}
              {chronologicalEvents.length === 0 && (
                <div className="relative">
                  <span
                    className="absolute -left-6 top-2.5 w-5 h-5 rounded-full bg-rose-50 border-2 border-brand-crimson/50 flex items-center justify-center text-brand-crimson"
                    aria-hidden="true"
                  >
                    <Clock size={10} />
                  </span>
                  <div className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-muted">
                    No installments recorded yet. Use <strong>Collect Balance</strong> below when the
                    customer makes an advance or final payment.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6. Modal Footer Actions */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenPrint && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  onOpenPrint(inv.id);
                }}
              >
                <Printer size={14} className="mr-1.5" />
                Print Receipt
              </Button>
            )}

            {balanceDue > 0.01 &&
              effectiveStatus !== 'void' &&
              effectiveStatus !== 'returned' &&
              onOpenCollect && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    onClose();
                    onOpenCollect(inv);
                  }}
                >
                  <Coins size={14} className="mr-1.5" />
                  Collect Balance ({formatCurrency(balanceDue)})
                </Button>
              )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
