import { Link } from 'react-router-dom';
import { formatCurrency } from '@/shared/lib/format';
import { Zap, AlertCircle, PackageX, Percent, ArrowUpRight } from 'lucide-react';

export function ProfitDoublingLevers({
  profitLevers = {},
  payments = {},
  storeCode = 'all',
}) {
  const cashVsEmi = payments.cashVsEmi || {};
  const emiUpsell = profitLevers.emiUpsell || {};
  const pendingReceivables = profitLevers.pendingReceivables || {};
  const deadStock = profitLevers.deadStock || {};
  const fastMoverRestocks = profitLevers.fastMoverRestocks || [];
  const attachRate = profitLevers.attachRate || {};
  const discountAudit = profitLevers.discountAudit || {};

  const targetStoreForInventory =
    storeCode === 'all' ? 'furniture-electronics' : storeCode;

  const highValueOppCount = Number(
    emiUpsell.highValueCashOpportunities ?? cashVsEmi.highValueCashOpportunities ?? 0
  );
  const highValueOppAmount = Number(
    emiUpsell.highValueCashAmount ?? cashVsEmi.highValueCashAmount ?? 0
  );

  const pendingAmount = Number(pendingReceivables.totalAmount ?? 0);
  const pendingCount = Number(pendingReceivables.billsCount ?? 0);

  const deadCapital = Number(deadStock.totalTrappedCapital ?? 0);
  const deadCount = Number(deadStock.count ?? 0);

  return (
    <div className="p-5 sm:p-6 rounded-xl border border-border bg-surface shadow-2xs space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            <Zap size={16} className="text-brand-gold shrink-0" />
            <span>Profit-Doubling Levers</span>
          </h2>
          <p className="text-xs text-muted">
            Practical showroom actions to increase average ticket size, free stuck cash, and protect net margin.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. EMI Ticket Upsell Lever */}
        <div className="p-4 rounded-xl border border-border bg-bg/60 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-sage-text">
              1. 0% EMI Upgrade Opportunity
            </div>
            <div className="text-xl font-bold font-mono text-text">
              {highValueOppCount} bills
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Full Cash/UPI bills of ₹15k+ ({formatCurrency(highValueOppAmount)}) in this period without EMI financing.
            </p>
          </div>
          <div className="pt-2 border-t border-border text-[11px] text-text font-medium">
            {cashVsEmi.emiMultiplier
              ? `EMI bills average ${cashVsEmi.emiMultiplier}x Cash bills — pitch Bajaj/TVS 0% EMI for higher-margin models.`
              : 'Pitch Bajaj Finserv / TVS 0% EMI on ₹15k+ items to upgrade customers to higher-margin tiers.'}
          </div>
        </div>

        {/* 2. Pending Credit Recovery */}
        <div className="p-4 rounded-xl border border-border bg-bg/60 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-crimson-text">
                2. Pending Credit Recovery
              </span>
              <AlertCircle size={14} className="text-brand-crimson shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-text">
              {formatCurrency(pendingAmount)}
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {pendingCount > 0
                ? `Uncollected balance across ${pendingCount} partial/pending bills waiting for collection.`
                : 'Zero unpaid counter dues right now — clean cash collection discipline.'}
            </p>
          </div>
          <Link
            to="/admin/invoices"
            className="pt-2 border-t border-border text-[11px] font-semibold text-text hover:text-brand-sage-text inline-flex items-center justify-between"
          >
            <span>Open All Bills to Collect</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* 3. Dead Stock vs Fast Restock */}
        <div className="p-4 rounded-xl border border-border bg-bg/60 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold-text">
                3. Dead Stock vs Fast Restocks
              </span>
              <PackageX size={14} className="text-brand-gold shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-text">
              {formatCurrency(deadCapital)}
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Trapped in {deadCount} stocked SKUs with zero sales in 30 days.{' '}
              {fastMoverRestocks.length > 0
                ? `${fastMoverRestocks.length} fast-moving SKU(s) are low on stock (${fastMoverRestocks[0].name}).`
                : 'Fast-moving items are well stocked.'}
            </p>
          </div>
          <Link
            to={`/admin/${targetStoreForInventory}/inventory`}
            className="pt-2 border-t border-border text-[11px] font-semibold text-text hover:text-brand-sage-text inline-flex items-center justify-between"
          >
            <span>Review Stock &amp; Reorder</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* 4. Add-On Attach Rate & Discount Guard */}
        <div className="p-4 rounded-xl border border-border bg-bg/60 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text">
                4. Add-On Attach &amp; Discounts
              </span>
              <Percent size={14} className="text-muted shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-text">
              {Number(attachRate.attachRatePct || 0).toFixed(1)}% attach
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {attachRate.attachedBills || 0} of {attachRate.deviceBills || 0} big-item bills included a high-margin accessory. Counter discounts: {formatCurrency(discountAudit.totalDiscount || 0)}.
            </p>
          </div>
          <div className="pt-2 border-t border-border text-[11px] text-text font-medium flex items-center justify-between gap-2">
            <span>
              Discounts = {Number(discountAudit.pctOfGrossProfit || 0).toFixed(1)}% of Gross Profit
            </span>
            {Number(attachRate.targetMonthlyGain || 0) > 0 && (
              <span className="font-mono text-brand-sage-text shrink-0">
                +{formatCurrency(attachRate.targetMonthlyGain)} goal
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
