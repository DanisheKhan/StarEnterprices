import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  LoadingState,
  RecordCard,
  RecordCardHeader,
  RecordCardBody,
  RecordCardSection,
  RecordCardSectionTitle,
  RecordCardFooter,
  RecordCardAction,
} from '@/shared/ui';
import { formatCurrency, formatPhone } from '@/shared/lib/format';
import {
  Search,
  Building2,
  Phone,
  FileText,
  CreditCard,
  Plus,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

export function DealerDirectoryTable({
  dealers = [],
  isLoading,
  onOpenAddDealer,
  onOpenRecordPayment,
  basePath = '/admin/dealers',
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all'); // all | has_balance | overdue | settled

  const filteredDealers = useMemo(() => {
    return dealers.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        d.name?.toLowerCase().includes(q) ||
        d.brand_name?.toLowerCase().includes(q) ||
        d.contact_person?.toLowerCase().includes(q) ||
        d.phone?.includes(q) ||
        d.gstin?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q);

      const matchType = typeFilter === 'all' || d.dealer_type === typeFilter;

      let matchBalance = true;
      const totalBal = d.metrics?.totalBalance || 0;
      if (balanceFilter === 'has_balance') {
        matchBalance = totalBal > 0;
      } else if (balanceFilter === 'overdue') {
        matchBalance = (d.metrics?.overdueAmount || 0) > 0;
      } else if (balanceFilter === 'settled') {
        matchBalance = totalBal <= 0;
      }

      return matchSearch && matchType && matchBalance;
    });
  }, [dealers, search, typeFilter, balanceFilter]);

  // Total outstanding balance across all filtered dealers
  const totalPayables = useMemo(() => {
    return filteredDealers.reduce((sum, d) => sum + (d.metrics?.totalBalance || 0), 0);
  }, [filteredDealers]);

  return (
    <div className="space-y-4">
      {/* Top Filter & Actions Bar */}
      <div className="bg-surface border border-border rounded-xl shadow-2xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search dealers by brand (Godrej, Samsung...), contact, phone, GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-sage"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter dealers by category"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="brand_direct">OEM / Brand Direct</option>
              <option value="distributor">Distributors / Stockists</option>
              <option value="wholesaler">Wholesalers</option>
              <option value="local_vendor">Local / Cash Vendors</option>
            </select>

            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value)}
              aria-label="Filter dealers by balance status"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage cursor-pointer"
            >
              <option value="all">All Balances</option>
              <option value="has_balance">With Outstanding Balance</option>
              <option value="overdue">Overdue Only</option>
              <option value="settled">Fully Settled (₹0)</option>
            </select>

            {/* Top Primary Action */}
            {onOpenAddDealer && (
              <button
                type="button"
                onClick={onOpenAddDealer}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-accent text-accent-fg hover:bg-accent/90 active:scale-[0.99] shadow-2xs transition-all cursor-pointer shrink-0"
              >
                <Plus size={13} className="stroke-[2.5]" />
                <span>Add Dealer</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Counter & Payable Summary Bar */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted">
          <span>
            Showing <strong className="text-text font-semibold">{filteredDealers.length}</strong>{' '}
            {filteredDealers.length === 1 ? 'supplier ledger' : 'supplier ledgers'}
          </span>
          {totalPayables > 0 && (
            <span>
              Total Network Payables:{' '}
              <strong className="text-brand-crimson font-mono font-bold">
                {formatCurrency(totalPayables)}
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
            title="Refreshing Dealer Directory"
            message="Synchronizing dealer network, contacts, and live balances..."
          />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredDealers.length === 0 && (
        <div className="py-16 text-center bg-surface border border-dashed border-border rounded-xl shadow-2xs space-y-2">
          <Building2 size={34} className="mx-auto text-muted/50 mb-1" />
          <p className="font-semibold text-text text-sm">No suppliers found</p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {search || typeFilter !== 'all' || balanceFilter !== 'all'
              ? 'No suppliers match your active search or filter criteria. Try clearing filters.'
              : 'No suppliers registered yet. Click "+ Add Dealer" to add your first supplier or brand ledger.'}
          </p>
        </div>
      )}

      {/* Individual Dealer Cards / Sections */}
      {!isLoading && filteredDealers.length > 0 && (
        <div className="space-y-3.5">
          {filteredDealers.map((d) => {
            const totalBalance = d.metrics?.totalBalance || 0;
            const gstBalance = d.metrics?.gstBalance || 0;
            const kacchaBalance = d.metrics?.kacchaBalance || 0;
            const overdueAmount = d.metrics?.overdueAmount || 0;
            const avgSpeed = d.metrics?.avgDaysTaken;
            const initials = (d.brand_name || d.name || 'DL').slice(0, 2).toUpperCase();

            return (
              <RecordCard key={d.id}>
                {/* 1. Header: Brand Identity & Balance Status */}
                <RecordCardHeader>
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Brand Avatar */}
                    <div className="w-9 h-9 rounded-lg bg-brand-sage-subtle border border-brand-sage-border text-brand-sage-text flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`${basePath}/${d.id}`}
                          className="font-bold text-sm text-text hover:text-brand-sage transition-colors truncate"
                        >
                          {d.name || d.brand_name}
                        </Link>

                        {/* Category Badge */}
                        <Badge
                          variant={
                            d.dealer_type === 'brand_direct'
                              ? 'blue'
                              : d.dealer_type === 'distributor'
                              ? 'purple'
                              : 'sage'
                          }
                          className="text-[10px] font-semibold px-2 py-0.5"
                        >
                          {d.dealer_type === 'brand_direct'
                            ? 'OEM / Brand Direct'
                            : d.dealer_type === 'distributor'
                            ? 'Distributor'
                            : d.dealer_type === 'wholesaler'
                            ? 'Wholesaler'
                            : 'Local Vendor'}
                        </Badge>

                        {d.brand_name && d.brand_name !== d.name && (
                          <span className="text-xs text-muted font-medium">
                            ({d.brand_name})
                          </span>
                        )}
                      </div>

                      {/* Location & Contact Subtitle */}
                      <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {d.city && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="text-muted shrink-0" />
                            <span>{d.city}</span>
                          </span>
                        )}
                        {d.city && d.contact_person && <span aria-hidden="true">•</span>}
                        {d.contact_person && (
                          <span>
                            Contact: <strong className="text-text font-medium">{d.contact_person}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Balance status indicator */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {overdueAmount > 0 ? (
                      <Badge variant="danger" className="text-[11px] font-bold px-2.5 py-0.5">
                        <AlertCircle size={11} className="shrink-0" />
                        <span>{formatCurrency(overdueAmount)} Overdue</span>
                      </Badge>
                    ) : totalBalance > 0 ? (
                      <Badge variant="amber" className="text-[11px] font-semibold px-2.5 py-0.5">
                        Balance Active
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-[11px] font-semibold px-2.5 py-0.5">
                        <CheckCircle2 size={11} className="shrink-0" />
                        <span>Khata Settled</span>
                      </Badge>
                    )}
                  </div>
                </RecordCardHeader>

                {/* 2. Body Grid: Contact / Billing / Financials */}
                <RecordCardBody>
                  {/* Column A: Contact & Compliance */}
                  <RecordCardSection className="md:col-span-4 space-y-2 text-xs">
                    <RecordCardSectionTitle icon={Phone}>
                      Contact & Compliance
                    </RecordCardSectionTitle>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted text-[11px]">Phone:</span>
                        <span className="font-mono font-medium text-text">
                          {d.phone ? formatPhone(d.phone) : '—'}
                        </span>
                      </div>

                      {d.gstin ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted text-[11px]">GSTIN:</span>
                          <span className="font-mono font-bold text-brand-sage-text uppercase">
                            {d.gstin}
                          </span>
                        </div>
                      ) : (
                        <div className="text-muted italic text-[11px]">
                          Non-GST Supplier
                        </div>
                      )}

                      {d.address && (
                        <div className="text-[11px] text-muted truncate" title={d.address}>
                          {d.address}
                        </div>
                      )}
                    </div>
                  </RecordCardSection>

                  {/* Column B: Billing Terms & Credit Agreement */}
                  <RecordCardSection className="md:col-span-4 space-y-2 text-xs">
                    <RecordCardSectionTitle icon={FileText}>
                      Billing & Credit Terms
                    </RecordCardSectionTitle>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted text-[11px]">Book Mode:</span>
                        <Badge
                          variant={
                            d.billing_mode === 'both'
                              ? 'purple'
                              : d.billing_mode === 'gst'
                              ? 'sage'
                              : 'amber'
                          }
                          className="text-[10px] font-semibold px-2 py-0.5"
                        >
                          {d.billing_mode === 'both'
                            ? 'GST & Kaccha Separation'
                            : d.billing_mode === 'gst'
                            ? 'GST Invoices Only'
                            : 'Kaccha / Cash Only'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-muted text-[11px]">Credit Term:</span>
                        <span className="font-semibold text-text">
                          {d.default_credit_days || 30} Days
                        </span>
                      </div>

                      {avgSpeed != null && (
                        <div className="text-[11px] text-muted flex items-center gap-1.5">
                          <Clock size={11} className="text-muted shrink-0" />
                          <span>
                            Avg Clearance Speed: <strong className="text-text">{avgSpeed} days</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </RecordCardSection>

                  {/* Column C: Outstanding Khata Balance */}
                  <RecordCardSection className="md:col-span-4 flex flex-col justify-between gap-3 text-left md:text-right">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                        Outstanding Khata Balance
                      </span>
                      {totalBalance > 0 ? (
                        <span className="font-mono tabular-nums text-xl sm:text-2xl font-bold tracking-tight text-brand-crimson block">
                          {formatCurrency(totalBalance)}
                        </span>
                      ) : (
                        <div className="flex items-center md:justify-end gap-2 mt-1">
                          <span className="font-mono tabular-nums text-xl sm:text-2xl font-bold tracking-tight text-brand-sage-text">
                            ₹0
                          </span>
                          <Badge variant="success" className="text-[10px] px-2 py-0.5">
                            Settled
                          </Badge>
                        </div>
                      )}
                    </div>

                    {totalBalance > 0 && (
                      <div className="pt-2.5 border-t border-border/70 flex items-center justify-between md:justify-end gap-2.5 text-xs">
                        <div className="text-[11px] text-muted flex items-center gap-2 flex-wrap">
                          {gstBalance > 0 && (
                            <span>
                              GST Book:{' '}
                              <strong className="font-mono tabular-nums text-text">
                                {formatCurrency(gstBalance)}
                              </strong>
                            </span>
                          )}
                          {gstBalance > 0 && kacchaBalance > 0 && <span aria-hidden="true">•</span>}
                          {kacchaBalance > 0 && (
                            <span>
                              Kaccha Book:{' '}
                              <strong className="font-mono tabular-nums text-pastel-amber-text">
                                {formatCurrency(kacchaBalance)}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </RecordCardSection>
                </RecordCardBody>

                {/* 3. Footer Toolbar Actions */}
                <RecordCardFooter>
                  {/* Left: Summary Metrics */}
                  <div className="text-xs text-muted flex items-center gap-x-2.5 gap-y-1 flex-wrap min-w-0">
                    <span>
                      Supplier Ledger ID:{' '}
                      <strong className="font-mono text-[11px] text-text">
                        {d.id.slice(0, 8)}...
                      </strong>
                    </span>
                    {d.metrics?.totalBillsCount != null && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span className="text-text font-medium">
                          {d.metrics.totalBillsCount}{' '}
                          {d.metrics.totalBillsCount === 1 ? 'bill recorded' : 'bills recorded'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                    <RecordCardAction
                      as={Link}
                      to={`${basePath}/billing`}
                      variant="neutral"
                      title={`Record purchase bill for ${d.name || d.brand_name}`}
                    >
                      <Plus size={13} className="stroke-[2.5] shrink-0" />
                      <span>New Bill</span>
                    </RecordCardAction>

                    {totalBalance > 0 && onOpenRecordPayment && (
                      <RecordCardAction
                        variant="amber-solid"
                        onClick={() => onOpenRecordPayment(d)}
                        title={`Record payment against balance of ${formatCurrency(totalBalance)}`}
                      >
                        <CreditCard size={13} className="stroke-[2.5] shrink-0" />
                        <span>Pay Khata ({formatCurrency(totalBalance)})</span>
                      </RecordCardAction>
                    )}

                    <RecordCardAction
                      as={Link}
                      to={`${basePath}/${d.id}`}
                      variant="primary"
                      title="Open complete multi-book khata ledger and statement passbook"
                    >
                      <span>Passbook & Ledger</span>
                      <ArrowRight size={13} className="shrink-0" />
                    </RecordCardAction>
                  </div>
                </RecordCardFooter>
              </RecordCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
