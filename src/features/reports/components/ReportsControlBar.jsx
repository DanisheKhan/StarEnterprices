import { Building2, Calendar, Printer } from 'lucide-react';
import { Button } from '@/shared/ui';

const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const STORE_OPTIONS = [
  { id: 'all', label: 'All Branches' },
  { id: 'furniture-electronics', label: 'Furniture & Electronics' },
  { id: 'mobiles', label: 'Star Mobiles' },
];

export function ReportsControlBar({
  dateRange,
  setDateRange,
  storeCode,
  setStoreCode,
  onOpenZReport,
  activeStoreLabel,
}) {
  return (
    <div className="flex flex-col gap-4 pb-5 border-b border-border min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-brand-sage shrink-0" />
            <span className="font-bold uppercase tracking-wider text-muted truncate">
              Store Intelligence • {activeStoreLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Reports &amp; Profit Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-2xl">
            Tax-accurate profit (excl. GST), stock valuation, category winners, EMI vs Cash customers &amp; regional reach.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Store Filter */}
          <div className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 h-9 text-xs shadow-2xs">
            <Building2 size={14} className="text-muted shrink-0" />
            <select
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value)}
              aria-label="Select Store Branch"
              className="bg-transparent text-text font-semibold text-xs focus:outline-none cursor-pointer pr-1"
            >
              {STORE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Pills */}
          <div className="inline-flex items-center bg-surface border border-border rounded-lg p-1 gap-0.5 shadow-2xs overflow-x-auto max-w-full">
            <Calendar size={13} className="text-muted mx-1.5 shrink-0 hidden sm:block" />
            {DATE_RANGES.map((item) => {
              const isActive = dateRange === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateRange(item.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-accent text-accent-fg shadow-2xs'
                      : 'text-muted hover:text-text hover:bg-surface-subtle'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Printable Z-Report */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenZReport}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Printer size={14} className="text-muted" />
            <span>Z-Report</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
