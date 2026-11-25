import { useState, useMemo } from 'react';
import {
  Badge,
  LoadingState,
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
import { DealerBillPrintModal } from './DealerBillPrintModal';
import {
  FileText,
  Calendar,
  Search,
  Coins,
  History,
  Receipt,
  Package,
  Building2,
  Clock,
  AlertCircle,
  Printer,
  Phone,
  CheckCircle2,
} from 'lucide-react';

export function BillsRegisterTable({
  bills = [],
  dealers = [],
  currentStore,
  isLoading,
  onOpenRecordPayment,
  onOpenTimeline,
}) {
  const [search, setSearch] = useState('');
  const [dealerFilter, setDealerFilter] = useState('all');
  const [billTypeFilter, setBillTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [printingBill, setPrintingBill] = useState(null);

  // Derive unique dealer list for filter dropdown
  const dealerOptions = useMemo(() => {
    const map = new Map();
    dealers.forEach((d) => {
      if (d.id) map.set(d.id, d.name || d.brand_name || 'Unnamed Dealer');
    });
    bills.forEach((b) => {
      if (b.dealer?.id && !map.has(b.dealer.id)) {
        map.set(b.dealer.id, b.dealer.name || b.dealer.brand_name || 'Unnamed Dealer');
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dealers, bills]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        b.bill_number?.toLowerCase().includes(q) ||
        b.dealer?.name?.toLowerCase().includes(q) ||
        b.dealer?.brand_name?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q) ||
        (Array.isArray(b.items) &&
          b.items.some((it) => it?.name?.toLowerCase().includes(q)));

      const matchDealer =
        dealerFilter === 'all' ||
        b.dealer_id === dealerFilter ||
        b.dealer?.id === dealerFilter;

      const matchType = billTypeFilter === 'all' || b.bill_type === billTypeFilter;
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;

      return matchSearch && matchDealer && matchType && matchStatus;
    }).sort((a, b) => {
      const dateDiff = String(b.bill_date || '').localeCompare(String(a.bill_date || ''));
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [bills, search, dealerFilter, billTypeFilter, statusFilter]);

  // Aggregate stats of currently displayed bills
  const totalBalanceDue = useMemo(() => {
    return filteredBills.reduce((acc, b) => acc + (Number(b.balance_amount) || 0), 0);
  }, [filteredBills]);

  return (
    <div className="space-y-4">
      {/* Top Controls Toolbar */}
      <div className="bg-surface border border-border rounded-xl shadow-2xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search Bill #, Supplier, Item, Notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-sage"
            />
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Dealer Filter */}
            <select
              value={dealerFilter}
              onChange={(e) => setDealerFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage cursor-pointer max-w-48"
            >
              <option value="all">All Dealers / Suppliers</option>
              {dealerOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={billTypeFilter}
              onChange={(e) => setBillTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage cursor-pointer"
            >
              <option value="all">All Bill Types (GST + Kaccha)</option>
              <option value="gst">GST Tax Invoices Only</option>
              <option value="kaccha">Kaccha (Non-GST / Estimates) Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="unpaid">Unpaid Only</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Fully Settled / Paid</option>
            </select>
          </div>
        </div>

        {/* Results Counter & Payable Summary Bar */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted">
          <span>
            Showing <strong className="text-text font-semibold">{filteredBills.length}</strong>{' '}
            {filteredBills.length === 1 ? 'purchase / due' : 'purchases / dues'}
          </span>
          {totalBalanceDue > 0 && (
            <span>
              Total Money to Give:{' '}
              <strong className="text-brand-crimson font-mono font-bold">
                {formatCurrency(totalBalanceDue)}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-surface border border-border rounded-xl shadow-2xs">
          <LoadingState
            size="md"
            title="Refreshing Dues & Reminders"
            message="Updating balances, due dates, and payment history..."
          />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredBills.length === 0 && (
        <div className="py-16 text-center bg-surface border border-dashed border-border rounded-xl shadow-2xs space-y-2">
          <Receipt size={34} className="mx-auto text-muted/50 mb-1" />
          <p className="font-semibold text-text text-sm">No dealer dues found</p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {search || dealerFilter !== 'all' || billTypeFilter !== 'all' || statusFilter !== 'all'
              ? 'No records match your active search or filter criteria. Try clearing filters.'
              : 'No dealer dues recorded yet. Click "+ Add Purchase / Due Reminder" above to record what you bought.'}
          </p>
        </div>
      )}

      {/* Individual Bills - Distinct Sections (Cards) */}
      {!isLoading && filteredBills.length > 0 && (
        <div className="space-y-3.5">
          {filteredBills.map((b) => {
            const total = Number(b.total_amount || 0);
            const paid = Number(b.paid_amount || 0);
            const balance = Number(b.balance_amount || 0);
            const totalTax =
              (Number(b.cgst_amount) || 0) +
              (Number(b.sgst_amount) || 0) +
              (Number(b.igst_amount) || 0) ||
              Number(b.total_tax_amount) ||
              0;

            const itemsCount = Array.isArray(b.items) ? b.items.length : 0;
            const paymentsCount = Array.isArray(b.payments) ? b.payments.length : 0;

            return (
              <RecordCard key={b.id}>
                {/* 1. Bill Section Header */}
                <RecordCardHeader>
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    {/* Bill / Invoice Number with icon badge */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-brand-sage-subtle border border-brand-sage-border text-brand-sage flex items-center justify-center shrink-0">
                        <FileText size={14} />
                      </span>
                      <span className="font-mono font-bold text-sm text-text tracking-tight">
                        #{b.bill_number}
                      </span>
                    </div>

                    {/* GST vs Kaccha Badge */}
                    <Badge
                      variant={b.bill_type === 'gst' ? 'sage' : 'amber'}
                      className="text-[10px] font-bold uppercase px-2 py-0.5"
                    >
                      {b.bill_type === 'gst' ? 'GST Tax Invoice' : 'Kaccha / Estimate'}
                    </Badge>

                    {/* Bill Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                      <Calendar size={13} className="shrink-0" />
                      <span>{b.bill_date ? formatDate(b.bill_date, false) : '—'}</span>
                    </div>
                  </div>

                  {/* Right: Payment Status Badge & Due Countdown */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Badge
                      variant={
                        b.status === 'paid'
                          ? 'success'
                          : b.status === 'partially_paid'
                          ? 'amber'
                          : 'danger'
                      }
                      className="text-[10px] font-bold uppercase px-2.5 py-0.5"
                    >
                      {b.status === 'paid' && <CheckCircle2 size={11} className="shrink-0" />}
                      <span>
                        {b.status === 'paid'
                          ? 'Fully Settled'
                          : b.status === 'partially_paid'
                          ? 'Partially Paid'
                          : 'Unpaid'}
                      </span>
                    </Badge>

                    {b.status === 'paid' ? (
                      b.payment_days_taken != null && (
                        <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5">
                          <Clock size={11} className="shrink-0" />
                          <span>Cleared in {b.payment_days_taken || 0}d</span>
                        </Badge>
                      )
                    ) : b.isOverdue ? (
                      <Badge variant="danger" className="text-[11px] font-bold px-2.5 py-0.5">
                        <AlertCircle size={11} className="shrink-0" />
                        <span>{b.daysOverdue}d overdue! Pay dealer</span>
                      </Badge>
                    ) : b.daysUntilDue === 0 ? (
                      <Badge variant="amber" className="text-[11px] font-bold px-2.5 py-0.5">
                        <Clock size={11} className="shrink-0" />
                        <span>Payment due today</span>
                      </Badge>
                    ) : b.daysUntilDue <= 7 ? (
                      <Badge variant="amber" className="text-[11px] font-semibold px-2.5 py-0.5">
                        <Clock size={11} className="shrink-0" />
                        <span>Due in {b.daysUntilDue}d</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5">
                        Due in {b.daysUntilDue}d ({b.credit_days}d credit)
                      </Badge>
                    )}
                  </div>
                </RecordCardHeader>

                {/* 2. Bill Section Body (3-Column Breakdown) */}
                <RecordCardBody>
                  {/* Column A: Supplier / Brand Details */}
                  <RecordCardSection className="md:col-span-4 space-y-2">
                    <RecordCardSectionTitle icon={Building2}>
                      Supplier / Brand Dealer
                    </RecordCardSectionTitle>

                    <div className="font-bold text-sm text-text leading-snug truncate" title={b.dealer?.name || b.dealer?.brand_name}>
                      {b.dealer?.name || b.dealer?.brand_name || 'Unknown Supplier'}
                    </div>
                    <div className="space-y-1 text-xs text-muted">
                      {b.dealer?.phone && (
                        <div className="flex items-center gap-1.5 font-mono text-text/80">
                          <Phone size={11} className="text-muted shrink-0" />
                          <span>{formatPhone(b.dealer.phone)}</span>
                        </div>
                      )}
                      {b.dealer?.gstin && b.bill_type === 'gst' && (
                        <div className="text-[11px] font-mono text-brand-sage-text uppercase">
                          GSTIN: {b.dealer.gstin}
                        </div>
                      )}
                    </div>
                  </RecordCardSection>

                  {/* Column B: Items & What Was Bought */}
                  <RecordCardSection className="md:col-span-5 space-y-2">
                    <RecordCardSectionTitle
                      icon={Package}
                      meta={itemsCount > 0 ? `(${itemsCount} ${itemsCount === 1 ? 'item' : 'items'})` : null}
                    >
                      Stock Bought / Description
                    </RecordCardSectionTitle>

                    {itemsCount > 0 ? (
                      <div className="space-y-1.5">
                        {b.items.slice(0, 3).map((it, idx) => (
                          <RecordCardLineItem
                            key={idx}
                            title={it.name || it.description || 'Item'}
                            qtyLabel={`Qty: ${it.quantity || 1}${
                              it.unit_price ? ` × ₹${Number(it.unit_price).toLocaleString('en-IN')}` : ''
                            }`}
                          />
                        ))}
                        {itemsCount > 3 && (
                          <div className="text-[11px] text-muted font-medium italic pl-1">
                            +{itemsCount - 3} more {itemsCount - 3 === 1 ? 'item' : 'items'}...
                          </div>
                        )}
                      </div>
                    ) : b.notes ? (
                      <p className="text-xs text-text font-medium italic leading-relaxed bg-surface-subtle/70 px-3 py-2 rounded-lg border border-border/80">
                        &ldquo;{b.notes}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-muted italic">
                        Consignment purchase entry
                      </p>
                    )}
                  </RecordCardSection>

                  {/* Column C: Financial Breakdown & Money to Give */}
                  <RecordCardSection className="md:col-span-3 flex flex-col justify-between gap-3 text-left md:text-right">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                        Total Purchase Cost
                      </span>
                      <span className="font-mono tabular-nums text-xl sm:text-2xl font-bold tracking-tight text-text block">
                        {formatCurrency(total)}
                      </span>
                      {b.bill_type === 'gst' && totalTax > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-muted block mt-0.5">
                          (incl. {formatCurrency(totalTax)} GST)
                        </span>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-border/70 flex items-center justify-between md:justify-end gap-2.5 text-xs">
                      <span className="text-muted text-[11px] font-semibold">
                        Money to Give:
                      </span>
                      {balance > 0.01 ? (
                        <span className="font-mono tabular-nums font-bold text-base text-brand-crimson">
                          {formatCurrency(balance)}
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

                {/* 3. Bill Section Footer & Actions */}
                <RecordCardFooter>
                  {/* Left: Summary Metrics */}
                  <div className="flex items-center gap-x-2.5 gap-y-1 text-xs text-muted flex-wrap min-w-0">
                    <span>
                      Paid so far:{' '}
                      <strong className="font-mono tabular-nums text-text">{formatCurrency(paid)}</strong>
                    </span>
                    <span aria-hidden="true">•</span>
                    <span>
                      Credit terms:{' '}
                      <strong className="text-text font-semibold">
                        {b.credit_days ? `${b.credit_days} days` : 'Immediate'}
                      </strong>
                    </span>
                    {paymentsCount > 0 && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span className="text-text font-medium">
                          {paymentsCount} payment {paymentsCount === 1 ? 'voucher' : 'vouchers'} recorded
                        </span>
                      </>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                    <RecordCardAction
                      variant="neutral"
                      onClick={() => setPrintingBill(b)}
                      title="Print purchase bill or voucher"
                    >
                      <Printer size={13} className="shrink-0" />
                      <span>Print</span>
                    </RecordCardAction>

                    {onOpenTimeline && (
                      <RecordCardAction
                        variant="sage"
                        onClick={() => onOpenTimeline(b.id, b)}
                        title="View payment vouchers and timeline for this bill"
                      >
                        <History size={13} className="shrink-0" />
                        <span>Payment History</span>
                      </RecordCardAction>
                    )}

                    {balance > 0.01 && onOpenRecordPayment && (
                      <RecordCardAction
                        variant="primary"
                        onClick={() => onOpenRecordPayment(b.dealer, b)}
                        title={`Give money to ${b.dealer?.name || 'dealer'}: ${formatCurrency(balance)}`}
                      >
                        <Coins size={13} className="stroke-[2.5] shrink-0" />
                        <span>Give Money ({formatCurrency(balance)})</span>
                      </RecordCardAction>
                    )}
                  </div>
                </RecordCardFooter>
              </RecordCard>
            );
          })}
        </div>
      )}

      {/* Printable Bill Dialog Modal */}
      {printingBill && (
        <DealerBillPrintModal
          isOpen={!!printingBill}
          onClose={() => setPrintingBill(null)}
          bill={printingBill}
          currentStore={currentStore}
        />
      )}
    </div>
  );
}
