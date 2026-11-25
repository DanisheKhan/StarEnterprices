import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, LoadingState, RecordCardAction } from '@/shared/ui';
import { useDealerStatement } from '../hooks/useDealers';
import { formatCurrency, formatDate, formatPhone } from '@/shared/lib/format';
import {
  FileText,
  CreditCard,
  Phone,
  Printer,
  Plus,
  Layers,
  Clock,
} from 'lucide-react';

export function DealerKhataLedger({
  dealerId,
  onOpenRecordPayment,
  onOpenTimeline,
}) {
  const [billTypeFilter, setBillTypeFilter] = useState('all'); // all | gst | kaccha

  const { data: statement, isLoading } = useDealerStatement(dealerId, {
    billType: billTypeFilter,
  });

  const dealer = statement?.dealer;
  const entries = statement?.entries || [];

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* Dealer Profile & Khata Header */}
      <Card className="p-5 bg-surface border border-border rounded-xl shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-sage-subtle border border-brand-sage-border text-brand-sage-text flex items-center justify-center font-bold text-lg shrink-0">
              {dealer?.brand_name?.slice(0, 2).toUpperCase() || 'DL'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-text">
                  {dealer?.brand_name || dealer?.name}
                </h2>
                <Badge variant="default" className="text-xs px-2.5 py-0.5 font-medium">
                  {dealer?.dealer_type?.replace('_', ' ').toUpperCase()}
                </Badge>
                {dealer?.billing_mode && (
                  <Badge variant="purple" className="text-[10px] font-semibold px-2 py-0.5">
                    Mode: {dealer.billing_mode.toUpperCase()}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5">{dealer?.name}</div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted mt-2">
                <span className="flex items-center gap-1 font-mono">
                  <Phone size={12} /> {formatPhone(dealer?.phone)}
                </span>
                {dealer?.gstin && (
                  <span className="font-mono">GSTIN: {dealer.gstin}</span>
                )}
                {dealer?.city && <span>City: {dealer.city}</span>}
                <span className="font-semibold text-text">
                  Credit Terms: {dealer?.default_credit_days || 30} Days
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <RecordCardAction variant="neutral" onClick={handlePrint}>
              <Printer size={13} />
              <span>Print Ledger</span>
            </RecordCardAction>

            <RecordCardAction as={Link} to="/admin/dealers/billing" variant="primary">
              <Plus size={13} className="stroke-[2.5]" />
              <span>Record Purchase Bill</span>
            </RecordCardAction>

            <RecordCardAction
              variant="sage-active"
              onClick={() => onOpenRecordPayment(dealer)}
            >
              <CreditCard size={13} className="stroke-[2.5]" />
              <span>Record Payment</span>
            </RecordCardAction>
          </div>
        </div>

        {/* 4 KPI Summary Blocks for this Dealer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border">
          <div className="p-3 rounded-lg bg-surface-subtle border border-border">
            <div className="text-[11px] text-muted uppercase font-bold tracking-wider">
              Total Invoiced
            </div>
            <div className="text-base font-bold font-mono tabular-nums text-text mt-1">
              {isLoading ? '...' : formatCurrency(statement?.totalBillsAmount || 0)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-brand-sage-subtle/50 border border-brand-sage-border">
            <div className="text-[11px] text-brand-sage-text uppercase font-bold tracking-wider">
              Total Paid
            </div>
            <div className="text-base font-bold font-mono tabular-nums text-brand-sage-text mt-1">
              {isLoading ? '...' : formatCurrency(statement?.totalPaidAmount || 0)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-pastel-purple/60 border border-pastel-purple-border">
            <div className="text-[11px] text-pastel-purple-text uppercase font-bold tracking-wider">
              Debit Notes (Returns)
            </div>
            <div className="text-base font-bold font-mono tabular-nums text-pastel-purple-text mt-1">
              {isLoading ? '...' : formatCurrency(statement?.totalDebitsAmount || 0)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-pastel-amber/60 border border-pastel-amber-border">
            <div className="text-[11px] text-pastel-amber-text uppercase font-bold tracking-wider">
              Current Outstanding
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-pastel-amber-text mt-1">
              {isLoading ? '...' : formatCurrency(statement?.closingBalance || 0)}
            </div>
          </div>
        </div>
      </Card>

      {/* Ledger Table with Two-Book Separation Toggle */}
      <Card className="bg-surface border border-border rounded-xl shadow-2xs overflow-hidden">
        {/* Toggle Bar */}
        <div className="p-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text uppercase tracking-wide">
              Khata Passbook Ledger
            </span>
            <span className="text-[11px] text-muted">
              ({entries.length} entries)
            </span>
          </div>

          {/* Kaccha vs GST Tabs */}
          <div className="inline-flex rounded-lg border border-border bg-surface-subtle p-0.5 text-xs">
            <button
              onClick={() => setBillTypeFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                billTypeFilter === 'all'
                  ? 'bg-surface text-text shadow-2xs'
                  : 'text-muted hover:text-text'
              }`}
            >
              All Ledgers
            </button>
            <button
              onClick={() => setBillTypeFilter('gst')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                billTypeFilter === 'gst'
                  ? 'bg-brand-sage text-white shadow-2xs'
                  : 'text-muted hover:text-text'
              }`}
            >
              <FileText size={12} />
              <span>GST Only (Pakka)</span>
            </button>
            <button
              onClick={() => setBillTypeFilter('kaccha')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                billTypeFilter === 'kaccha'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-muted hover:text-text'
              }`}
            >
              <Layers size={12} />
              <span>Kaccha Only (Estimates)</span>
            </button>
          </div>
        </div>

        {/* Mobile Passbook Card Stack */}
        <div className="sm:hidden divide-y divide-border min-w-0">
          {isLoading ? (
            <LoadingState size="sm" message="Loading Khata statement..." className="py-12" />
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              No transactions recorded for this dealer yet.
            </div>
          ) : (
            entries.map((row) => {
              const isBill = row.entryType === 'BILL';
              const isPayment = row.entryType === 'PAYMENT';

              return (
                <div key={row.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-muted shrink-0">
                        {formatDate(row.date, false)}
                      </span>
                      {isBill ? (
                        <Badge
                          variant={row.billType === 'gst' ? 'sage' : 'amber'}
                          className="text-[9px] font-bold uppercase px-1.5 py-0.5"
                        >
                          {row.billType === 'gst' ? 'GST Bill' : 'Kaccha'}
                        </Badge>
                      ) : isPayment ? (
                        <Badge variant="success" className="text-[9px] font-bold uppercase px-1.5 py-0.5">
                          Payment
                        </Badge>
                      ) : (
                        <Badge variant="purple" className="text-[9px] font-bold uppercase px-1.5 py-0.5">
                          Debit Note
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-text truncate">{row.refNumber}</span>
                  </div>

                  {row.description && (
                    <p className="text-[11px] text-muted line-clamp-2">{row.description}</p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/60 font-mono tabular-nums">
                    <div className="flex items-center gap-3">
                      {row.debit > 0 && (
                        <span className="text-text font-semibold">+{formatCurrency(row.debit)}</span>
                      )}
                      {row.credit > 0 && (
                        <span className="text-brand-sage-text font-semibold">-{formatCurrency(row.credit)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-pastel-amber-text font-bold">Bal: {formatCurrency(row.runningBalance)}</span>
                      {isBill && onOpenTimeline && (
                        <button
                          type="button"
                          onClick={() => onOpenTimeline(row.id, row.metadata)}
                          title="Inspect Payment Speed & Timeline"
                          className="p-1 rounded text-muted hover:text-accent hover:bg-surface-subtle cursor-pointer"
                        >
                          <Clock size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Ledger Passbook Table */}
        <div className="hidden sm:block w-full overflow-x-auto min-w-0">
          <table className="w-full min-w-176 table-fixed text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-subtle/80 border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
                <th className="py-3 px-3 w-[11%]">Date</th>
                <th className="py-3 px-3 w-[12%]">Type</th>
                <th className="py-3 px-3 w-[15%]">Voucher / Ref</th>
                <th className="py-3 px-3 w-[24%]">Description</th>
                <th className="py-3 px-3 text-right w-[11%]">Debit (+)</th>
                <th className="py-3 px-3 text-right w-[11%]">Credit (-)</th>
                <th className="py-3 px-3 text-right w-[11%]">Balance</th>
                <th className="py-3 px-3 text-center w-[5%]">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <LoadingState
                      size="sm"
                      message="Loading Khata statement..."
                      className="py-12"
                    />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    No transactions recorded for this dealer yet.
                  </td>
                </tr>
              ) : (
                entries.map((row) => {
                  const isBill = row.entryType === 'BILL';
                  const isPayment = row.entryType === 'PAYMENT';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-surface-subtle/50 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-text whitespace-nowrap min-w-0 truncate">
                        {formatDate(row.date, false)}
                      </td>

                      {/* Entry Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap min-w-0">
                        {isBill ? (
                          <Badge
                            variant={row.billType === 'gst' ? 'sage' : 'amber'}
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5"
                          >
                            {row.billType === 'gst' ? 'GST Bill' : 'Kaccha'}
                          </Badge>
                        ) : isPayment ? (
                          <Badge variant="success" className="text-[9px] font-bold uppercase px-1.5 py-0.5">
                            Payment
                          </Badge>
                        ) : (
                          <Badge variant="purple" className="text-[9px] font-bold uppercase px-1.5 py-0.5">
                            Debit Note
                          </Badge>
                        )}
                      </td>

                      {/* Reference Number */}
                      <td className="py-2.5 px-3 font-mono font-semibold text-text whitespace-nowrap min-w-0 truncate">
                        {row.refNumber}
                      </td>

                      {/* Description */}
                      <td className="py-2.5 px-3 text-muted min-w-0 truncate" title={row.description}>
                        {row.description}
                      </td>

                      {/* Debit (+) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-text whitespace-nowrap min-w-0">
                        {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                      </td>

                      {/* Credit (-) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-sage whitespace-nowrap min-w-0">
                        {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                      </td>

                      {/* Running Balance */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-pastel-amber-text whitespace-nowrap min-w-0">
                        {formatCurrency(row.runningBalance)}
                      </td>

                      {/* Timeline audit action */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap min-w-0">
                        {isBill && onOpenTimeline && (
                          <button
                            onClick={() => onOpenTimeline(row.id, row.metadata)}
                            title="Inspect Payment Speed & Timeline"
                            className="p-1 rounded text-muted hover:text-accent hover:bg-surface-subtle transition-colors cursor-pointer"
                          >
                            <Clock size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
