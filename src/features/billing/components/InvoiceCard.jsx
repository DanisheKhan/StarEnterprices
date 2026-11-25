import { memo } from 'react';
import {
  Badge,
  WhatsAppIcon,
  RecordCard,
  RecordCardHeader,
  RecordCardBody,
  RecordCardSection,
  RecordCardSectionTitle,
  RecordCardLineItem,
  RecordCardFooter,
  RecordCardAction,
} from '@/shared/ui';
import { formatCurrency, formatDate, formatPhone } from '@/shared/lib/format';
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
  Phone,
  MapPin,
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

  const statusBadgeVariant =
    effectiveStatus === 'paid'
      ? 'success'
      : effectiveStatus === 'partial'
      ? 'amber'
      : effectiveStatus === 'pending'
      ? 'danger'
      : effectiveStatus === 'returned' || effectiveStatus === 'partially_returned'
      ? 'purple'
      : 'default';

  const statusLabel =
    effectiveStatus === 'paid'
      ? 'Fully Settled'
      : effectiveStatus === 'partial'
      ? 'Partially Paid'
      : effectiveStatus === 'pending'
      ? 'Unpaid / Pending'
      : effectiveStatus === 'partially_returned'
      ? 'Partially Returned'
      : effectiveStatus === 'returned'
      ? 'Returned'
      : effectiveStatus;

  return (
    <RecordCard>
      {/* 1. Header Bar */}
      <RecordCardHeader>
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          {/* Invoice Number with subtle icon badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-brand-sage-subtle border border-brand-sage-border text-brand-sage flex items-center justify-center shrink-0">
              <FileText size={14} />
            </span>
            <span className="font-mono font-bold text-sm text-text tracking-tight">
              #{inv.invoice_number}
            </span>
          </div>

          {/* Tax Invoice vs Cash Bill Badge */}
          <Badge
            variant={totalTax > 0 ? 'sage' : 'amber'}
            className="text-[10px] font-bold uppercase px-2 py-0.5"
          >
            {totalTax > 0 ? 'GST Tax Invoice' : 'Retail / Cash Bill'}
          </Badge>

          {/* Date & Time */}
          <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
            <Calendar size={13} className="shrink-0" />
            <span>{inv.created_at ? formatDate(inv.created_at) : '—'}</span>
          </div>
        </div>

        {/* Right: Single clear Status Badge + Due callout when applicable */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Badge
            variant={statusBadgeVariant}
            className="text-[10px] font-bold uppercase px-2.5 py-0.5"
          >
            {effectiveStatus === 'paid' && <CheckCircle2 size={11} className="shrink-0" />}
            <span>{statusLabel}</span>
          </Badge>

          {balanceDue > 0.01 && (
            <Badge
              variant="danger"
              className="text-[11px] font-mono font-bold px-2.5 py-0.5"
            >
              <AlertCircle size={11} className="shrink-0" />
              <span>Due: {formatCurrency(balanceDue)}</span>
            </Badge>
          )}
        </div>
      </RecordCardHeader>

      {/* 2. Body (3-Column Layout with full-height dividers) */}
      <RecordCardBody>
        {/* Column A: Customer / Buyer Details */}
        <RecordCardSection className="md:col-span-4 space-y-2">
          <RecordCardSectionTitle icon={User}>
            Customer / Buyer
          </RecordCardSectionTitle>

          <div className="font-bold text-sm text-text leading-snug truncate" title={inv.customer_name}>
            {inv.customer_name || 'Walk-in Customer'}
          </div>

          <div className="space-y-1 text-xs text-muted">
            {inv.customer_phone && (
              <div className="flex items-center gap-1.5 font-mono text-text/80">
                <Phone size={11} className="text-muted shrink-0" />
                <span>{formatPhone(inv.customer_phone)}</span>
              </div>
            )}
            {(inv.customer_city || inv.customer_address) && (
              <div
                className="text-[11px] text-muted flex items-start gap-1.5"
                title={[inv.customer_address, inv.customer_city].filter(Boolean).join(', ')}
              >
                <MapPin size={11} className="shrink-0 mt-0.5" />
                <span className="truncate">
                  {inv.customer_city
                    ? inv.customer_address
                      ? `${inv.customer_city} — ${inv.customer_address}`
                      : inv.customer_city
                    : inv.customer_address}
                </span>
              </div>
            )}
            <div className="text-[11px] text-muted flex items-center gap-1.5">
              <Building2 size={11} className="shrink-0" />
              <span className="truncate">{storeName || inv.stores?.name || 'Star Enterprises'}</span>
            </div>
            {inv.customer_gstin && (
              <div className="text-[11px] font-mono text-brand-sage-text uppercase">
                GSTIN: {inv.customer_gstin}
              </div>
            )}
          </div>
        </RecordCardSection>

        {/* Column B: Items Purchased & Description */}
        <RecordCardSection className="md:col-span-5 space-y-2">
          <RecordCardSectionTitle
            icon={Package}
            meta={itemsCount > 0 ? `(${itemsCount} ${itemsCount === 1 ? 'item' : 'items'})` : null}
          >
            Items Purchased / Description
          </RecordCardSectionTitle>

          {itemsCount > 0 ? (
            <div className="space-y-1.5">
              {items.slice(0, 3).map((it, idx) => {
                const qty = Number(it.quantity) || 1;
                const unitPrice = parseFloat(it.unit_price) || 0;
                const qtyLabel = `Qty: ${qty}${
                  unitPrice > 0 ? ` × ₹${unitPrice.toLocaleString('en-IN')}` : ''
                }`;

                return (
                  <RecordCardLineItem
                    key={idx}
                    title={it.item_name || 'Item'}
                    qtyLabel={qtyLabel}
                    subContent={
                      it.serial_number && (
                        <div className="flex items-center gap-1 font-mono text-[10px] text-brand-sage-text">
                          <Barcode size={11} className="text-brand-sage shrink-0" />
                          <span className="truncate">S/N: {it.serial_number}</span>
                        </div>
                      )
                    }
                  />
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
        </RecordCardSection>

        {/* Column C: Financial Breakdown & Balance Due */}
        <RecordCardSection className="md:col-span-3 flex flex-col justify-between gap-3 text-left md:text-right">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
              Total Invoice Amount
            </span>
            <span className="font-mono tabular-nums text-xl sm:text-2xl font-bold tracking-tight text-text block">
              {formatCurrency(grandTotal)}
            </span>
            {totalTax > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-muted block mt-0.5">
                (incl. {formatCurrency(totalTax)} GST)
              </span>
            )}
          </div>

          <div className="pt-2.5 border-t border-border/70 flex items-center justify-between md:justify-end gap-2.5 text-xs">
            <span className="text-muted text-[11px] font-semibold">
              {balanceDue > 0.01 ? 'Money to Collect:' : 'Balance Due:'}
            </span>
            {balanceDue > 0.01 ? (
              <span className="font-mono tabular-nums font-bold text-base text-brand-crimson">
                {formatCurrency(balanceDue)}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-mono tabular-nums font-bold text-sm text-brand-sage-text">
                  ₹0
                </span>
                <Badge variant="success" className="text-[10px] px-1.5 py-0">
                  Settled
                </Badge>
              </div>
            )}
          </div>
        </RecordCardSection>
      </RecordCardBody>

      {/* 3. Footer Bar & Actions */}
      <RecordCardFooter>
        {/* Left: Financial Summary */}
        <div className="flex items-center gap-x-2.5 gap-y-1 text-xs text-muted flex-wrap min-w-0">
          <span>
            Paid so far:{' '}
            <strong className="font-mono tabular-nums text-text">{formatCurrency(totalPaid)}</strong>
          </span>
          <span aria-hidden="true">•</span>
          <span>
            Mode: <strong className="text-text font-semibold">{paymentMethodLabel}</strong>
          </span>
          {paymentsCount > 0 && (
            <>
              <span aria-hidden="true">•</span>
              <span className="text-text font-medium">
                {paymentsCount} payment {paymentsCount === 1 ? 'entry' : 'entries'} recorded
              </span>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
          <RecordCardAction
            variant="neutral"
            onClick={() => onViewPrint?.(inv.id)}
            title="View & Print GST Tax Invoice"
          >
            <Printer size={13} className="shrink-0" />
            <span>Print</span>
          </RecordCardAction>

          <RecordCardAction
            variant="sage"
            onClick={() => onEdit?.(inv.id)}
            title="Edit Customer, Line Items, & Pricing"
          >
            <Pencil size={13} className="shrink-0" />
            <span>Edit</span>
          </RecordCardAction>

          <RecordCardAction
            variant={balanceDue > 0.01 ? 'sage-active' : 'sage'}
            onClick={() => onWhatsApp?.(inv)}
            title={
              balanceDue > 0.01
                ? `Send WhatsApp Payment Reminder (Due: ${formatCurrency(balanceDue)})`
                : 'Send Invoice Receipt via WhatsApp'
            }
          >
            <WhatsAppIcon
              size={13}
              className={cn('shrink-0', balanceDue > 0.01 ? 'text-brand-sage' : 'text-current')}
            />
            <span>WhatsApp</span>
          </RecordCardAction>

          {effectiveStatus === 'paid' && onReturn && (
            <RecordCardAction
              variant="danger"
              onClick={() => onReturn(inv)}
              title="Process item return or warranty replacement"
            >
              <RotateCcw size={13} className="shrink-0" />
              <span>Return</span>
            </RecordCardAction>
          )}

          {balanceDue > 0.01 && onCollect && (
            <RecordCardAction
              variant="primary"
              onClick={() => onCollect(inv)}
              title={`Collect outstanding balance: ${formatCurrency(balanceDue)}`}
            >
              <Coins size={13} className="stroke-[2.5] shrink-0" />
              <span>Collect ({formatCurrency(balanceDue)})</span>
            </RecordCardAction>
          )}
        </div>
      </RecordCardFooter>
    </RecordCard>
  );
});
