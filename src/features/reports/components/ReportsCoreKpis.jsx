import { formatCurrency } from '@/shared/lib/format';
import { CalendarCheck, TrendingUp, Boxes, Receipt } from 'lucide-react';

export function ReportsCoreKpis({
  summary = {},
  thisMonthProfit = {},
  inventoryValuation = {},
  periodComparison = {},
  isLoading = false,
}) {
  if (isLoading && !summary.totalSales && !thisMonthProfit.netProfit) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-36 rounded-xl border border-border bg-surface p-5 animate-pulse space-y-3"
          >
            <div className="h-3 w-28 bg-surface-subtle rounded" />
            <div className="h-7 w-36 bg-surface-subtle rounded" />
            <div className="h-3 w-full bg-surface-subtle rounded" />
          </div>
        ))}
      </div>
    );
  }

  const monthLabel = thisMonthProfit.monthLabel || 'This Month';
  const monthNetProfit = Number(thisMonthProfit.netProfit ?? 0);
  const monthGrossProfit = Number(thisMonthProfit.grossProfit ?? 0);
  const monthCardMdr = Number(thisMonthProfit.cardMdrCost ?? 0);
  const monthMarginPct = Number(thisMonthProfit.marginPct ?? 0);
  const monthBills = Number(thisMonthProfit.billsCount ?? 0);

  const periodGrossProfit = Number(summary.estimatedGrossProfit ?? 0);
  const periodMarginPct = Number(summary.grossMarginPercent ?? 0);
  const netRevenue = Number(summary.netRevenue ?? 0);
  const totalCogs = Number(summary.totalCogs ?? 0);
  const deltaPct = periodComparison.deltaPct;

  const stockCostValue = Number(inventoryValuation.costValue ?? summary.totalInventoryValue ?? 0);
  const stockRetailValue = Number(inventoryValuation.retailValue ?? summary.potentialRetailValue ?? 0);
  const stockExpectedProfit = Number(
    inventoryValuation.expectedProfit ?? Math.max(0, stockRetailValue - stockCostValue)
  );
  const totalUnits = Number(inventoryValuation.totalUnits ?? summary.totalStockUnits ?? 0);
  const activeSkus = Number(inventoryValuation.activeSkus ?? summary.totalSkusCount ?? 0);

  const totalSales = Number(summary.totalSales ?? 0);
  const totalInvoices = Number(summary.totalInvoices ?? 0);
  const averageTicket = Number(summary.averageTicket ?? 0);
  const totalGst = Number(summary.totalGst ?? 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
      {/* 1. This Month's Net Profit */}
      <div className="p-5 rounded-xl border border-border bg-surface shadow-2xs flex flex-col justify-between space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              This Month&apos;s Profit
            </span>
            <span className="text-[11px] text-muted">{monthLabel} • {monthBills} bills</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-brand-sage-subtle border border-brand-sage-border flex items-center justify-center text-brand-sage shrink-0">
            <CalendarCheck size={16} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-bold font-mono tracking-tight text-text truncate">
            {formatCurrency(monthNetProfit)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="px-1.5 py-0.5 rounded border border-brand-sage-border bg-brand-sage-subtle text-brand-sage-text font-semibold font-mono">
              {monthMarginPct.toFixed(1)}% net margin
            </span>
          </div>
        </div>

        <div className="pt-2.5 border-t border-border/70 flex items-center justify-between text-[11px] text-muted gap-2">
          <span>Gross {formatCurrency(monthGrossProfit)}</span>
          <span className="font-mono">
            {monthCardMdr > 0 ? `MDR -${formatCurrency(monthCardMdr)}` : 'No Card MDR'}
          </span>
        </div>
      </div>

      {/* 2. Period Gross Profit (Excl. GST) */}
      <div className="p-5 rounded-xl border border-border bg-surface shadow-2xs flex flex-col justify-between space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Gross Profit
            </span>
            <span className="text-[11px] text-muted">Net Sales (Excl. GST) − COGS</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text shrink-0">
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-bold font-mono tracking-tight text-text truncate">
            {formatCurrency(periodGrossProfit)}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="px-1.5 py-0.5 rounded border border-border bg-bg font-mono font-semibold text-text">
              {periodMarginPct.toFixed(1)}% margin
            </span>
            {deltaPct !== null && deltaPct !== undefined && (
              <span
                className={`font-mono font-semibold ${
                  Number(deltaPct) >= 0 ? 'text-brand-sage-text' : 'text-brand-crimson-text'
                }`}
              >
                {Number(deltaPct) >= 0 ? '+' : ''}
                {Number(deltaPct).toFixed(1)}% vs prior
              </span>
            )}
          </div>
        </div>

        <div className="pt-2.5 border-t border-border/70 flex items-center justify-between text-[11px] text-muted gap-2">
          <span>Net {formatCurrency(netRevenue)}</span>
          <span className="font-mono">COGS {formatCurrency(totalCogs)}</span>
        </div>
      </div>

      {/* 3. Items Valuation (Live Inventory) */}
      <div className="p-5 rounded-xl border border-border bg-surface shadow-2xs flex flex-col justify-between space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Items Valuation
            </span>
            <span className="text-[11px] text-muted">
              {totalUnits} units across {activeSkus} SKUs
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-brand-gold-subtle border border-brand-gold-border flex items-center justify-center text-brand-gold shrink-0">
            <Boxes size={16} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-bold font-mono tracking-tight text-text truncate">
            {formatCurrency(stockCostValue)}
          </div>
          <div className="text-[11px] text-muted">
            Stock value at cost • Retail <strong className="font-mono text-text">{formatCurrency(stockRetailValue)}</strong>
          </div>
        </div>

        <div className="pt-2.5 border-t border-border/70 flex items-center justify-between text-[11px] text-muted gap-2">
          <span>Est. profit in stock:</span>
          <span className="font-mono font-semibold text-brand-sage-text">
            +{formatCurrency(stockExpectedProfit)}
          </span>
        </div>
      </div>

      {/* 4. Total Billed Sales & GST Register */}
      <div className="p-5 rounded-xl border border-border bg-surface shadow-2xs flex flex-col justify-between space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Total Billed Sales
            </span>
            <span className="text-[11px] text-muted">
              {totalInvoices} bills • Avg {formatCurrency(averageTicket)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-muted shrink-0">
            <Receipt size={16} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-bold font-mono tracking-tight text-text truncate">
            {formatCurrency(totalSales)}
          </div>
          <div className="text-[11px] text-muted">
            Tax-inclusive bill value
          </div>
        </div>

        <div className="pt-2.5 border-t border-border/70 flex items-center justify-between text-[11px] text-muted gap-2">
          <span>GST Collected (Govt):</span>
          <span className="font-mono font-semibold text-text">{formatCurrency(totalGst)}</span>
        </div>
      </div>
    </div>
  );
}
