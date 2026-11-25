import { formatCurrency, toTitleCase } from '@/shared/lib/format';
import {
  Layers,
  Trophy,
  Wallet,
  MapPin,
} from 'lucide-react';

export function ManagerInsightsGrid({
  categories = [],
  starProducts = [],
  payments = {},
  cities = [],
}) {
  const topCategory = categories[0] || null;
  const maxCategoryRev = Math.max(1, ...categories.map((c) => Number(c.netRevenue ?? c.revenue ?? 0)));

  const starProduct = starProducts[0] || null;
  const topProductsList = starProducts.slice(0, 5);

  const paymentList = payments.list || [];
  const cashVsEmi = payments.cashVsEmi || {};
  const totalPaymentPersons = paymentList.reduce((sum, p) => sum + Number(p.personsCount || 0), 0);

  const maxCityCustomers = Math.max(1, ...cities.map((c) => Number(c.customersCount || c.billsCount || 0)));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0">
      {/* 1. MOST SELLING CATEGORY */}
      <div className="p-5 sm:p-6 rounded-xl border border-border bg-surface shadow-2xs space-y-4 min-w-0 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Layers size={15} className="text-brand-sage shrink-0" />
                <span>Most Selling Categories</span>
              </h3>
              <p className="text-xs text-muted">Which category is selling most (Excl. GST sales &amp; profit)</p>
            </div>
            <span className="text-xs font-mono text-muted">{categories.length} categories</span>
          </div>

          {topCategory && (
            <div className="p-3.5 rounded-lg border border-brand-sage-border bg-brand-sage-subtle/40 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-sage-text block">
                  #1 Best-Selling Category
                </span>
                <div className="text-base font-bold text-text truncate">{topCategory.name}</div>
                <div className="text-xs text-muted">
                  {topCategory.units || 0} units sold • {Number(topCategory.marginPct || 0).toFixed(1)}% margin
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-bold font-mono text-text">
                  {formatCurrency(topCategory.netRevenue ?? topCategory.revenue ?? 0)}
                </div>
                <div className="text-xs font-mono font-semibold text-brand-sage-text">
                  Profit {formatCurrency(topCategory.profit || 0)}
                </div>
              </div>
            </div>
          )}

          {categories.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted">
              No category sales recorded in this period.
            </div>
          ) : (
            <div className="space-y-3">
              {categories.slice(0, 6).map((cat, idx) => {
                const rev = Number(cat.netRevenue ?? cat.revenue ?? 0);
                const widthPct = rev > 0 ? Math.max(4, Math.round((rev / maxCategoryRev) * 100)) : 0;

                return (
                  <div key={cat.slug || cat.name || idx} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-muted w-4">{idx + 1}.</span>
                        <span className="font-semibold text-text truncate">{cat.name}</span>
                        <span className="text-[11px] text-muted font-mono shrink-0">
                          ({cat.units || 0} pcs)
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 font-mono">
                        <span className="font-semibold text-text">{formatCurrency(rev)}</span>
                        <span className="text-[11px] text-brand-sage-text">
                          +{formatCurrency(cat.profit || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-bg border border-border/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${idx === 0 ? 'bg-brand-sage' : 'bg-text/30'}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. STAR PRODUCT & TOP SELLERS */}
      <div className="p-5 sm:p-6 rounded-xl border border-border bg-surface shadow-2xs space-y-4 min-w-0 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Trophy size={15} className="text-brand-gold shrink-0" />
                <span>Star Product &amp; Top SKUs</span>
              </h3>
              <p className="text-xs text-muted">Top revenue &amp; profit driver with live stock check</p>
            </div>
            <span className="text-xs font-mono text-muted">Top {topProductsList.length}</span>
          </div>

          {starProduct && (
            <div className="p-3.5 rounded-lg border border-brand-gold-border bg-brand-gold-subtle/40 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold-text block">
                  Star Product ({starProduct.category})
                </span>
                <div className="text-base font-bold text-text truncate">{starProduct.name}</div>
                <div className="text-xs text-muted font-mono">
                  {starProduct.unitsSold || 0} sold • Stock left: {starProduct.currentStock ?? 0}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-bold font-mono text-text">
                  {formatCurrency(starProduct.netRevenue ?? starProduct.revenue ?? 0)}
                </div>
                <div className="text-xs font-mono font-semibold text-brand-sage-text">
                  Profit {formatCurrency(starProduct.profit || 0)} ({Number(starProduct.marginPct || 0).toFixed(1)}%)
                </div>
              </div>
            </div>
          )}

          {topProductsList.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted">
              No product sales recorded in this period.
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {topProductsList.map((prod, idx) => {
                const stockBadge =
                  prod.stockStatus === 'out_of_stock'
                    ? 'border-brand-crimson-border bg-brand-crimson-subtle text-brand-crimson-text'
                    : prod.stockStatus === 'low_stock'
                    ? 'border-brand-gold-border bg-brand-gold-subtle text-brand-gold-text'
                    : 'border-brand-sage-border bg-brand-sage-subtle text-brand-sage-text';

                return (
                  <div
                    key={prod.id || idx}
                    className="p-2.5 px-3 flex items-center justify-between gap-2 text-xs bg-bg/40"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-text truncate">
                        {idx + 1}. {prod.name}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                        <span>{prod.category}</span>
                        <span>•</span>
                        <span className="font-mono">{prod.unitsSold} sold</span>
                        <span className={`px-1.5 py-0 rounded border text-[10px] font-medium ${stockBadge}`}>
                          {prod.currentStock} in stock
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <div className="font-semibold text-text">
                        {formatCurrency(prod.netRevenue ?? prod.revenue ?? 0)}
                      </div>
                      <div className="text-[11px] text-brand-sage-text">
                        +{formatCurrency(prod.profit || 0)} ({Number(prod.marginPct || 0).toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. EMI vs CASH CUSTOMERS (PERSONS COUNT) */}
      <div className="p-5 sm:p-6 rounded-xl border border-border bg-surface shadow-2xs space-y-4 min-w-0 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Wallet size={15} className="text-text shrink-0" />
                <span>EMI vs Cash Customers (Persons)</span>
              </h3>
              <p className="text-xs text-muted">
                How many customers paid via Cash, EMI financing, UPI &amp; Card
              </p>
            </div>
            <span className="text-xs font-mono text-muted">{totalPaymentPersons} payments</span>
          </div>

          {/* Direct Cash vs EMI Comparison Boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-brand-gold-border bg-brand-gold-subtle/40 space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold-text block">
                Cash Customers
              </span>
              <div className="text-xl font-bold font-mono text-text">
                {cashVsEmi.cashPersons ?? 0}{' '}
                <span className="text-xs font-sans font-medium text-muted">persons</span>
              </div>
              <div className="text-[11px] text-muted font-mono">
                Avg {formatCurrency(cashVsEmi.cashAvgTicket || 0)} / bill
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-bg space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text block">
                EMI Finance Customers
              </span>
              <div className="text-xl font-bold font-mono text-text">
                {cashVsEmi.emiPersons ?? 0}{' '}
                <span className="text-xs font-sans font-medium text-muted">persons</span>
              </div>
              <div className="text-[11px] text-muted font-mono">
                Avg {formatCurrency(cashVsEmi.emiAvgTicket || 0)} / bill
              </div>
            </div>
          </div>

          {/* Full Channel Breakdown */}
          <div className="space-y-3">
            {paymentList.map((item) => (
              <div key={item.method} className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-text truncate">{item.label}</span>
                    <span className="px-1.5 py-0.5 rounded border border-border bg-bg text-[10px] font-mono text-text shrink-0">
                      {item.personsCount ?? 0} {(item.personsCount ?? 0) === 1 ? 'person' : 'persons'}
                    </span>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="font-semibold text-text">{formatCurrency(item.amount || 0)}</span>
                    <span className="text-muted ml-1">({item.pct || 0}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-bg border border-border/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.barColor || 'bg-accent'}`}
                    style={{ width: `${Math.min(100, Math.max(item.amount > 0 ? 4 : 0, item.pct || 0))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-2.5 px-3 rounded-lg border border-border bg-bg text-[11px] text-muted flex items-center justify-between gap-2">
          <span>EMI vs Cash Ticket Insight:</span>
          <strong className="font-mono text-text">
            {cashVsEmi.emiMultiplier
              ? `EMI ticket is ${cashVsEmi.emiMultiplier}x Cash avg`
              : `${cashVsEmi.upiPersons ?? 0} UPI • ${cashVsEmi.cardPersons ?? 0} Card buyers`}
          </strong>
        </div>
      </div>

      {/* 4. CUSTOMER CITY MATRIX */}
      <div className="p-5 sm:p-6 rounded-xl border border-border bg-surface shadow-2xs space-y-4 min-w-0 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <MapPin size={15} className="text-brand-sage shrink-0" />
                <span>Customer Origin by City</span>
              </h3>
              <p className="text-xs text-muted">
                Cities customers come from, customer count &amp; Cash vs EMI mix
              </p>
            </div>
            <span className="text-xs font-mono text-muted shrink-0">
              {cities.length} {cities.length === 1 ? 'city' : 'cities'}
            </span>
          </div>

          {cities.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted">
              No customer city data recorded in this period.
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {cities.slice(0, 12).map((item, idx) => {
                const custCount = Number(item.customersCount || item.billsCount || 0);
                const widthPct =
                  custCount > 0 ? Math.max(4, Math.round((custCount / maxCityCustomers) * 100)) : 0;

                return (
                  <div key={item.city || idx} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-text truncate flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-muted">{idx + 1}.</span>
                          <span className="truncate">{toTitleCase(item.city)}</span>
                        </div>
                        <div className="text-[11px] text-muted font-mono">
                          {custCount} {custCount === 1 ? 'customer' : 'customers'} ({Number(item.customerSharePct ?? 0).toFixed(1)}%) • {item.billsCount || 0} bills • Cash {item.cashCount || 0} • EMI {item.emiCount || 0}
                        </div>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <div className="font-semibold text-text">{formatCurrency(item.grossSales || 0)}</div>
                        <div className="text-[11px] text-muted">{Number(item.sharePct || 0).toFixed(1)}% sales</div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-bg border border-border/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${idx === 0 ? 'bg-brand-sage' : 'bg-accent/60'}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-2.5 px-3 rounded-lg border border-border bg-bg text-[11px] text-muted">
          Customer city is captured on every POS bill in Step 2 (older pre-update bills show as Not Specified).
        </div>
      </div>
    </div>
  );
}
