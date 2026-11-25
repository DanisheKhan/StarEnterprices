import { memo } from 'react';
import { Badge, WhatsAppIcon } from '@/shared/ui';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import {
  FileText,
  Calendar,
  Building2,
  Package,
  Barcode,
  Coins,
  RotateCcw,
  Pencil,
  Printer,
  CheckCircle2,
  AlertCircle,
  User,
} from 'lucide-react';

export const InvoiceCard = memo(function InvoiceCard({
  invoice,
  storeName = '',
  onViewPrint,
  onEdit,
  onWhatsApp,
  onCollect,
  onReturn,
}) {
  const inv = invoice;
  const grandTotal = parseFloat(inv.grand_total) || 0;
  const totalPaid = (inv.payments || []).reduce(
    (acc, p) => acc + (parseFloat(p.amount) || 0),
    0
  );
  const balanceDue = Math.max(grandTotal - totalPaid, 0);

  const totalTax =
    (parseFloat(inv.cgst_amount) || 0) +
    (parseFloat(inv.sgst_amount) || 0) +
    (parseFloat(inv.igst_amount) || 0);

  // Compute effective status
  let effectiveStatus = inv.status;
  if (inv.status !== 'returned' && inv.status !== 'partially_returned' && inv.status !== 'void') {
    if (balanceDue <= 0.01) {
      effectiveStatus = 'paid';
    } else if (totalPaid > 0) {
      effectiveStatus = 'partial';
    } else {
      effectiveStatus = 'pending';
    }
  }

  const items = inv.order_items || [];
  const itemsCount = items.length;
  const payments = inv.payments || [];
  const paymentsCount = payments.length;

  const paymentMethodsSet = new Set(
    payments.map((p) => p.payment_method).filter(Boolean)
  );
  const paymentMethodLabel =
    paymentMethodsSet.size > 0
      ? Array.from(paymentMethodsSet)
          .map((m) => m.toUpperCase())
          .join(' + ')
      : 'Unrecorded';

  return (
    <div className="bg-surface border border-border rounded-xl shadow-2xs hover:border-brand-sage/40 transition-all overflow-hidden">
      {/* 1. Header Bar */}
      <div className="px-4 py-3 bg-surface-subtle/70 border-b border-border flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Invoice Number */}
          <div className="flex items-center gap-1.5">
            <FileText size={15} className="text-brand-sage shrink-0" />
            <span className="font-mono font-bold text-sm text-text">
              #{inv.invoice_number}
            </span>
          </div>

          {/* Tax Invoice vs Cash Bill Badge */}
          <span
            className={cn(
              'text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0',
              totalTax > 0
                ? 'bg-brand-sage-subtle text-brand-sage border-brand-sage-border'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            )}
          >
            {totalTax > 0 ? 'GST Tax Invoice' : 'Retail / Cash Bill'}
          </span>

          {/* Date & Time */}
          <div className="flex items-center gap-1 text-xs text-muted font-medium">
            <Calendar size={13} className="shrink-0" />
            <span>{inv.created_at ? formatDate(inv.created_at) : '—'}</span>
          </div>
        </div>

        {/* Right: Payment Status Badge & Due Warning */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={
              effectiveStatus === 'paid'
                ? 'success'
                : effectiveStatus === 'partial'
                ? 'amber'
                : effectiveStatus === 'pending'
                ? 'danger'
                : effectiveStatus === 'void'
                ? 'default'
                : 'outline'
            }
            className={cn(
              'text-[10px] font-bold uppercase px-2 py-0.5',
              (effectiveStatus === 'returned' || effectiveStatus === 'partially_returned') &&
                'border-purple-300 text-purple-700 bg-purple-50'
            )}
          >
            {effectiveStatus === 'paid'
              ? 'Fully Settled'
              : effectiveStatus === 'partial'
              ? 'Partially Paid'
              : effectiveStatus === 'pending'
              ? 'Unpaid / Pending'
              : effectiveStatus === 'partially_returned'
              ? 'Partially Returned'
              : effectiveStatus}
          </Badge>

          {effectiveStatus === 'paid' ? (
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 flex items-center gap-1">
              <CheckCircle2 size={11} className="shrink-0" />
              <span>Paid in Full</span>
            </span>
          ) : balanceDue > 0.01 ? (
            <span className="text-[11px] text-brand-crimson font-bold bg-brand-crimson-subtle border border-brand-crimson-border rounded px-2 py-0.5 flex items-center gap-1">
              <AlertCircle size={11} className="shrink-0" />
              <span>Due: {formatCurrency(balanceDue)}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* 2. Body (3-Column Layout) */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Column A: Customer / Client Details */}
        <div className="space-y-1.5 md:col-span-4 md:border-r md:border-border/60 md:pr-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <User size={12} className="text-brand-sage" />
            <span>Customer / Buyer</span>
          </div>
          <div className="font-bold text-sm text-text leading-snug truncate" title={inv.customer_name}>
            {inv.customer_name || 'Walk-in Customer'}
          </div>
          <div className="space-y-0.5 text-xs text-muted">
            {inv.customer_phone && (
              <div className="font-mono text-muted">{inv.customer_phone}</div>
            )}
            <div className="text-[11px] text-muted flex items-center gap-1">
              <Building2 size={11} className="shrink-0" />
              <span className="truncate">{storeName || inv.stores?.name || 'Star Enterprises'}</span>
            </div>
            {inv.customer_gstin && (
              <div className="text-[11px] font-mono text-brand-sage uppercase">
                GSTIN: {inv.customer_gstin}
              </div>
            )}
          </div>
        </div>

        {/* Column B: Items Purchased & Description */}
        <div className="space-y-1.5 md:col-span-5 md:border-r md:border-border/60 md:pr-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Package size={12} className="text-brand-sage" />
            <span>Items Purchased / Description</span>
            {itemsCount > 0 && (
              <span className="text-[10px] font-normal text-muted lowercase">
                ({itemsCount} {itemsCount === 1 ? 'item' : 'items'})
              </span>
            )}
          </div>

          {itemsCount > 0 ? (
            <div className="space-y-1.5">
              {items.slice(0, 3).map((it, idx) => {
                const qty = Number(it.quantity) || 1;
                const unitPrice = parseFloat(it.unit_price) || 0;
                return (
                  <div
                    key={idx}
                    className="p-1.5 rounded-lg bg-surface-subtle/50 border border-border/50 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text font-bold truncate">
                        {it.item_name || 'Item'}
                      </span>
                      <span className="font-mono text-muted text-[11px] shrink-0 font-semibold">
                        Qty: {qty}
                        {unitPrice > 0 ? ` × ₹${unitPrice.toLocaleString('en-IN')}` : ''}
                      </span>
                    </div>
                    {it.serial_number && (
                      <div className="flex items-center gap-1 font-mono text-[10px] text-brand-sage">
                        <Barcode size={11} className="shrink-0" />
                        <span>S/N: {it.serial_number}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {itemsCount > 3 && (
                <div className="text-[11px] text-muted font-medium italic pl-1">
                  +{itemsCount - 3} more {itemsCount - 3 === 1 ? 'item' : 'items'}...
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted italic">No item lines recorded</p>
          )}
        </div>

        {/* Column C: Financial Breakdown & Balance Due */}
        <div className="space-y-2 md:col-span-3 text-left md:text-right">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
              Total Invoice Amount
            </span>
            <span className="font-mono text-xl font-bold text-text block">
              {formatCurrency(grandTotal)}
            </span>
            {totalTax > 0 && (
              <span className="text-[10px] font-mono text-muted block mt-0.5">
                (incl. {formatCurrency(totalTax)} GST)
              </span>
            )}
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between md:justify-end gap-3 text-xs">
            <span className="text-muted text-[11px] font-semibold">
              {balanceDue > 0.01 ? 'Money to Collect:' : 'Payment Status:'}
            </span>
            <span
              className={cn(
                'font-mono font-bold text-base',
                balanceDue > 0.01 ? 'text-brand-crimson' : 'text-emerald-600'
              )}
            >
              {balanceDue > 0.01 ? formatCurrency(balanceDue) : '₹0 (Settled)'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Footer Bar & Actions */}
      <div className="px-4 py-2.5 bg-surface-subtle/40 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Financial Summary */}
        <div className="flex items-center gap-2.5 text-xs text-muted flex-wrap">
          <span>
            Paid so far:{' '}
            <strong className="font-mono text-text">{formatCurrency(totalPaid)}</strong>
          </span>
          <span>•</span>
          <span>
            Mode: <strong className="text-text font-medium">{paymentMethodLabel}</strong>
          </span>
          {paymentsCount > 0 && (
            <>
              <span>•</span>
              <span className="text-emerald-700 font-medium">
                {paymentsCount} payment {paymentsCount === 1 ? 'entry' : 'entries'} recorded
              </span>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
          {/* Print Button */}
          <button
            type="button"
            onClick={() => onViewPrint?.(inv.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-muted hover:text-text hover:bg-surface-subtle shadow-2xs transition-all cursor-pointer"
            title="View & Print GST Tax Invoice"
          >
            <Printer size={13} className="shrink-0" />
            <span>Print</span>
          </button>

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => onEdit?.(inv.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-muted hover:border-brand-sage hover:text-brand-sage hover:bg-brand-sage-subtle shadow-2xs transition-all cursor-pointer"
            title="Edit Customer, Line Items, & Pricing"
          >
            <Pencil size={13} className="shrink-0" />
            <span>Edit</span>
          </button>

          {/* WhatsApp Button */}
          <button
            type="button"
            onClick={() => onWhatsApp?.(inv)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer',
              balanceDue > 0.01
                ? 'border border-emerald-500/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-600'
                : 'border border-border bg-surface text-muted hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/60'
            )}
            title={
              balanceDue > 0.01
                ? `Send WhatsApp Payment Reminder (Due: ${formatCurrency(balanceDue)})`
                : 'Send Invoice Receipt via WhatsApp'
            }
          >
            <WhatsAppIcon
              size={13}
              className={cn('shrink-0', balanceDue > 0.01 ? 'text-emerald-700' : 'text-current')}
            />
            <span>WhatsApp</span>
          </button>

          {/* Return Button (if fully paid & return eligible) */}
          {effectiveStatus === 'paid' && onReturn && (
            <button
              type="button"
              onClick={() => onReturn(inv)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/5 shadow-2xs transition-all cursor-pointer"
              title="Process item return or warranty replacement"
            >
              <RotateCcw size={13} className="shrink-0" />
              <span>Return</span>
            </button>
          )}

          {/* Collect Payment (if balance due > 0) */}
          {balanceDue > 0.01 && onCollect && (
            <button
              type="button"
              onClick={() => onCollect(inv)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-accent text-accent-fg hover:bg-accent/90 active:scale-[0.99] shadow-2xs transition-all cursor-pointer"
              title={`Collect outstanding balance: ${formatCurrency(balanceDue)}`}
            >
              <Coins size={13} className="stroke-[2.5]" />
              <span>Collect ({formatCurrency(balanceDue)})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
