import { useState } from 'react';
import { formatCurrency } from '@/shared/lib/format';
import { BarChart3, Building2, TrendingUp } from 'lucide-react';

/**
 * Computes smooth cubic SVG path segments for timeline trend lines
 */
function buildSmoothPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export function StorePerformanceChart({
  salesVelocity = [],
  lifetimeTimeline = {},
  branches = [],
  dateRange = 'month',
}) {
  const [chartMode, setChartMode] = useState('trend'); // 'trend' | 'lifetime' | 'stores'
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedLifetimeIdx, setSelectedLifetimeIdx] = useState(null);

  const safePoints = Array.isArray(salesVelocity) ? salesVelocity : [];
  const defaultIdx = (() => {
    for (let i = safePoints.length - 1; i >= 0; i -= 1) {
      if ((safePoints[i]?.revenue || 0) > 0) return i;
    }
    return safePoints.length > 0 ? safePoints.length - 1 : null;
  })();

  const activeIdx = selectedIdx !== null && safePoints[selectedIdx] ? selectedIdx : defaultIdx;
  const activePoint = activeIdx !== null ? safePoints[activeIdx] : null;

  const maxVal = Math.max(
    1,
    ...safePoints.map((pt) => Math.max(Number(pt.revenue || 0), Number(pt.profit || 0)))
  );

  const lifetimeMonths = Array.isArray(lifetimeTimeline.months) ? lifetimeTimeline.months : [];
  const lifetimeTotals = lifetimeTimeline.totals || {};
  const defaultLifetimeIdx = (() => {
    for (let i = lifetimeMonths.length - 1; i >= 0; i -= 1) {
      if ((lifetimeMonths[i]?.revenue || 0) > 0) return i;
    }
    return lifetimeMonths.length > 0 ? lifetimeMonths.length - 1 : null;
  })();
  const activeLifetimeIdx =
    selectedLifetimeIdx !== null && lifetimeMonths[selectedLifetimeIdx]
      ? selectedLifetimeIdx
      : defaultLifetimeIdx;
  const activeLifetimePoint = activeLifetimeIdx !== null ? lifetimeMonths[activeLifetimeIdx] : null;

  // Build SVG coordinates for Lifetime Timeline (720 x 190 canvas)
  const chartWidth = 720;
  const chartHeight = 190;
  const padX = 28;
  const padTop = 18;
  const baseY = 166;
  const plotHeight = baseY - padTop;
  const maxLifetimeVal = Math.max(
    1,
    ...lifetimeMonths.map((m) => Math.max(Number(m.revenue || 0), Number(m.profit || 0)))
  );

  const revCoords = lifetimeMonths.map((m, idx) => {
    const x =
      lifetimeMonths.length <= 1
        ? chartWidth / 2
        : padX + (idx / (lifetimeMonths.length - 1)) * (chartWidth - padX * 2);
    const y = baseY - (Number(m.revenue || 0) / maxLifetimeVal) * plotHeight;
    return { x, y };
  });

  const profCoords = lifetimeMonths.map((m, idx) => {
    const x =
      lifetimeMonths.length <= 1
        ? chartWidth / 2
        : padX + (idx / (lifetimeMonths.length - 1)) * (chartWidth - padX * 2);
    const y = baseY - (Number(m.profit || 0) / maxLifetimeVal) * plotHeight;
    return { x, y };
  });

  const revLinePath = buildSmoothPath(revCoords);
  const profLinePath = buildSmoothPath(profCoords);
  const revAreaPath =
    revCoords.length > 1
      ? `${revLinePath} L ${revCoords[revCoords.length - 1].x.toFixed(1)} ${baseY} L ${revCoords[0].x.toFixed(1)} ${baseY} Z`
      : '';
  const profAreaPath =
    profCoords.length > 1
      ? `${profLinePath} L ${profCoords[profCoords.length - 1].x.toFixed(1)} ${baseY} L ${profCoords[0].x.toFixed(1)} ${baseY} Z`
      : '';

  const maxBranchRev = Math.max(
    1,
    ...branches.map((b) => Number(b.netRevenue || b.sales || 0))
  );

  return (
    <div className="p-5 sm:p-6 rounded-xl border border-border bg-surface shadow-2xs space-y-5 min-w-0">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            {chartMode === 'lifetime' ? (
              <TrendingUp size={16} className="text-brand-sage shrink-0" />
            ) : chartMode === 'trend' ? (
              <BarChart3 size={16} className="text-brand-sage shrink-0" />
            ) : (
              <Building2 size={16} className="text-brand-sage shrink-0" />
            )}
            <span>
              {chartMode === 'lifetime'
                ? 'Store Lifetime Performance Timeline'
                : chartMode === 'trend'
                ? `Store Sales & Profit Performance (${dateRange === 'all' ? 'Full Year Monthly' : dateRange === 'month' ? 'From 1st of Month' : 'Last 7 Days'})`
                : 'Branch Performance & Stock Dataset'}
            </span>
          </h2>
          <p className="text-xs text-muted">
            {chartMode === 'lifetime'
              ? 'Full calendar progression from Month 1 (Jan 2026) through the current month.'
              : chartMode === 'trend'
              ? 'Net taxable sales compared directly with true gross profit across each billing day.'
              : 'Side-by-side revenue, profit margin, billed volume, and live inventory valuation per branch.'}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-bg p-0.5 text-xs shrink-0 self-start xl:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setChartMode('trend')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
              chartMode === 'trend'
                ? 'bg-accent text-accent-fg shadow-2xs'
                : 'text-muted hover:text-text'
            }`}
          >
            Sales &amp; Profit Graph
          </button>
          <button
            type="button"
            onClick={() => setChartMode('lifetime')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
              chartMode === 'lifetime'
                ? 'bg-accent text-accent-fg shadow-2xs'
                : 'text-muted hover:text-text'
            }`}
          >
            Lifetime Timeline
          </button>
          <button
            type="button"
            onClick={() => setChartMode('stores')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
              chartMode === 'stores'
                ? 'bg-accent text-accent-fg shadow-2xs'
                : 'text-muted hover:text-text'
            }`}
          >
            Store Comparison
          </button>
        </div>
      </div>

      {chartMode === 'trend' && (
        <div className="space-y-4">
          {/* Active Point Readout & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-bg text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-text/20 inline-block" />
                <span className="text-muted font-medium">Net Sales (Excl. GST)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-brand-sage inline-block" />
                <span className="text-muted font-medium">Gross Profit</span>
              </div>
            </div>

            {activePoint ? (
              <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                <span className="font-semibold text-text font-sans">
                  {activePoint.label} ({activePoint.dayOfWeek}):
                </span>
                <span className="text-text font-semibold">
                  Sales {formatCurrency(activePoint.revenue || 0)}
                </span>
                <span className="text-brand-sage-text font-semibold">
                  Profit {formatCurrency(activePoint.profit || 0)} ({Number(activePoint.marginPct || 0).toFixed(1)}%)
                </span>
                <span className="text-muted">
                  {activePoint.invoices || 0} bills
                </span>
              </div>
            ) : (
              <span className="text-muted">Hover or tap a bar to inspect daily profit</span>
            )}
          </div>

          {/* Interactive Grouped Bar Chart */}
          {safePoints.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted border border-dashed border-border rounded-lg">
              No trend points available for this date range.
            </div>
          ) : (
            <div className="w-full overflow-x-auto pb-1">
              <div className="min-w-96 space-y-2">
                <div className="h-52 flex items-end gap-1.5 sm:gap-2 px-1 pt-4 border-b border-border">
                  {safePoints.map((pt, idx) => {
                    const rev = Number(pt.revenue || 0);
                    const prof = Number(pt.profit || 0);
                    const revPct = rev > 0 ? Math.max(4, Math.round((rev / maxVal) * 100)) : 2;
                    const profPct = prof > 0 ? Math.max(3, Math.round((prof / maxVal) * 100)) : 0;
                    const isFocused = activeIdx === idx;

                    return (
                      <button
                        key={pt.date || idx}
                        type="button"
                        onMouseEnter={() => setSelectedIdx(idx)}
                        onFocus={() => setSelectedIdx(idx)}
                        onClick={() => setSelectedIdx(idx)}
                        className={`flex-1 h-full flex flex-col justify-end items-center group cursor-pointer rounded-t-md px-0.5 transition-colors ${
                          isFocused ? 'bg-surface-subtle' : 'hover:bg-surface-subtle/60'
                        }`}
                        aria-label={`${pt.label}: Sales ${formatCurrency(rev)}, Profit ${formatCurrency(prof)}`}
                      >
                        <div className="w-full h-full flex items-end justify-center gap-0.5 sm:gap-1 pb-0.5">
                          <div
                            className={`w-1/2 max-w-4 rounded-t-sm transition-all ${
                              isFocused ? 'bg-text/45' : 'bg-text/20 group-hover:bg-text/30'
                            }`}
                            style={{ height: `${revPct}%` }}
                          />
                          <div
                            className={`w-1/2 max-w-4 rounded-t-sm transition-all ${
                              isFocused ? 'bg-brand-sage' : 'bg-brand-sage/80 group-hover:bg-brand-sage'
                            }`}
                            style={{ height: `${profPct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* X-Axis Labels */}
                <div className="flex items-center gap-1.5 sm:gap-2 px-1">
                  {safePoints.map((pt, idx) => {
                    const isFocused = activeIdx === idx;
                    const step = safePoints.length > 16 ? 4 : safePoints.length > 8 ? 2 : 1;
                    const showLabel =
                      idx === 0 ||
                      idx === safePoints.length - 1 ||
                      idx % step === 0 ||
                      isFocused;

                    return (
                      <div
                        key={pt.date || idx}
                        className={`flex-1 text-center text-[10px] font-mono truncate ${
                          isFocused ? 'text-text font-bold' : 'text-muted'
                        }`}
                      >
                        {showLabel ? pt.label : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {chartMode === 'lifetime' && (
        <div className="space-y-4">
          {/* Lifetime Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border bg-bg flex items-center justify-between gap-2">
              <span className="text-muted font-medium">Lifetime Net Sales</span>
              <span className="font-mono font-bold text-text">
                {formatCurrency(lifetimeTotals.netRevenue || 0)}
              </span>
            </div>
            <div className="p-3 rounded-lg border border-brand-sage-border bg-brand-sage-subtle/40 flex items-center justify-between gap-2">
              <span className="text-brand-sage-text font-medium">Lifetime Gross Profit</span>
              <span className="font-mono font-bold text-brand-sage-text">
                {formatCurrency(lifetimeTotals.profit || 0)} ({Number(lifetimeTotals.avgMarginPct || 0).toFixed(1)}%)
              </span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-bg flex items-center justify-between gap-2">
              <span className="text-muted font-medium">Total Lifetime Bills</span>
              <span className="font-mono font-bold text-text">
                {lifetimeTotals.billsCount || 0} bills ({formatCurrency(lifetimeTotals.grossSales || 0)} incl. GST)
              </span>
            </div>
          </div>

          {/* Active Month Timeline Inspector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-bg text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-text inline-block" />
                <span className="text-muted font-medium">Monthly Net Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-brand-sage inline-block" />
                <span className="text-muted font-medium">Monthly Gross Profit</span>
              </div>
            </div>

            {activeLifetimePoint ? (
              <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                <span className="font-bold text-text font-sans">
                  {activeLifetimePoint.fullLabel || activeLifetimePoint.label}:
                </span>
                <span className="text-text font-semibold">
                  Sales {formatCurrency(activeLifetimePoint.revenue || 0)}
                </span>
                <span className="text-brand-sage-text font-semibold">
                  Profit {formatCurrency(activeLifetimePoint.profit || 0)} ({Number(activeLifetimePoint.marginPct || 0).toFixed(1)}%)
                </span>
                <span className="text-muted">
                  Cumulative: {formatCurrency(activeLifetimePoint.cumulativeRevenue || 0)} ({activeLifetimePoint.invoices || 0} bills)
                </span>
              </div>
            ) : (
              <span className="text-muted">Hover or tap a month point to inspect lifetime growth</span>
            )}
          </div>

          {/* Interactive SVG Area + Line Timeline Graph */}
          {lifetimeMonths.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted border border-dashed border-border rounded-lg">
              No lifetime timeline data available yet.
            </div>
          ) : (
            <div className="space-y-2">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-52 overflow-visible select-none"
                role="img"
                aria-label="Store Lifetime Monthly Sales and Profit Timeline"
              >
                {/* Horizontal Reference Lines */}
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const yPos = baseY - ratio * plotHeight;
                  return (
                    <line
                      key={ratio}
                      x1={padX}
                      y1={yPos}
                      x2={chartWidth - padX}
                      y2={yPos}
                      className="stroke-border"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  );
                })}
                <line
                  x1={padX}
                  y1={baseY}
                  x2={chartWidth - padX}
                  y2={baseY}
                  className="stroke-border"
                  strokeWidth="1.5"
                />

                {/* Area Fills */}
                {revAreaPath && <path d={revAreaPath} className="fill-text/5" />}
                {profAreaPath && <path d={profAreaPath} className="fill-brand-sage/15" />}

                {/* Smooth Trend Curves */}
                {revLinePath && (
                  <path
                    d={revLinePath}
                    fill="none"
                    className="stroke-text/70"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}
                {profLinePath && (
                  <path
                    d={profLinePath}
                    fill="none"
                    className="stroke-brand-sage"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}

                {/* Interactive Month Nodes & Labels */}
                {lifetimeMonths.map((m, idx) => {
                  const ptRev = revCoords[idx];
                  const ptProf = profCoords[idx];
                  const isFocused = activeLifetimeIdx === idx;

                  return (
                    <g
                      key={m.date || idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setSelectedLifetimeIdx(idx)}
                      onClick={() => setSelectedLifetimeIdx(idx)}
                    >
                      {/* Invisible wide hit column */}
                      <rect
                        x={ptRev.x - 24}
                        y={0}
                        width={48}
                        height={chartHeight}
                        fill="transparent"
                      />
                      {isFocused && (
                        <line
                          x1={ptRev.x}
                          y1={padTop}
                          x2={ptRev.x}
                          y2={baseY}
                          className="stroke-border"
                          strokeWidth="1"
                        />
                      )}
                      <circle
                        cx={ptRev.x}
                        cy={ptRev.y}
                        r={isFocused ? 5.5 : 3.5}
                        className="fill-surface stroke-text"
                        strokeWidth="2"
                      />
                      <circle
                        cx={ptProf.x}
                        cy={ptProf.y}
                        r={isFocused ? 5.5 : 3.5}
                        className="fill-surface stroke-brand-sage"
                        strokeWidth="2"
                      />
                      <text
                        x={ptRev.x}
                        y={baseY + 16}
                        textAnchor="middle"
                        className={`text-[11px] font-mono ${
                          isFocused ? 'fill-text font-bold' : 'fill-muted'
                        }`}
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      )}

      {chartMode === 'stores' && (
        /* Store Comparison Cards & Valuation Dataset */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.length === 0 ? (
            <div className="col-span-full py-10 text-center text-xs text-muted border border-dashed border-border rounded-lg">
              No branch performance data available.
            </div>
          ) : (
            branches.map((branch) => {
              const netRev = Number(branch.netRevenue ?? branch.sales ?? 0);
              const barPct = netRev > 0 ? Math.max(4, Math.round((netRev / maxBranchRev) * 100)) : 0;

              return (
                <div
                  key={branch.code}
                  className="p-4 rounded-xl border border-border bg-bg/60 space-y-3 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text truncate">{branch.name}</div>
                      <div className="text-[11px] text-muted font-mono">
                        GSTIN: {branch.gstin} • {branch.invoices || 0} bills
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold font-mono text-text">
                        {formatCurrency(branch.grossSales ?? branch.sales ?? 0)}
                      </div>
                      <div className="text-[11px] text-brand-sage-text font-mono font-semibold">
                        Profit {formatCurrency(branch.profit || 0)} ({Number(branch.marginPct || 0).toFixed(1)}%)
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-surface border border-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-sage transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted block">Avg Bill</span>
                      <span className="font-mono font-semibold text-text">{formatCurrency(branch.aov || 0)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted block">Stock Cost</span>
                      <span className="font-mono font-semibold text-text">
                        {formatCurrency(branch.stockCostValue || 0)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-muted block">In Stock</span>
                      <span className="font-mono font-semibold text-text">
                        {branch.stockUnits || 0} units ({branch.activeSkus || 0} SKUs)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
