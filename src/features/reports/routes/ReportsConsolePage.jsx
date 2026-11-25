import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOwnerDashboard } from '../hooks/useReports';
import { ReportsControlBar } from '../components/ReportsControlBar';
import { ReportsCoreKpis } from '../components/ReportsCoreKpis';
import { StorePerformanceChart } from '../components/StorePerformanceChart';
import { ManagerInsightsGrid } from '../components/ManagerInsightsGrid';
import { ProfitDoublingLevers } from '../components/ProfitDoublingLevers';
import { DayEndZReportModal } from '../components/DayEndZReportModal';
import { getErrorMessage } from '@/shared/lib/errors';
import { Info, AlertCircle } from 'lucide-react';

const STORE_LABELS = {
  all: 'All Branches (Enterprise)',
  'furniture-electronics': 'Star Furniture & Electronics',
  mobiles: 'Star Mobiles',
};

const DATE_RANGE_LABELS = {
  today: 'Today',
  week: 'Last 7 Days',
  month: 'This Month',
  all: 'All Time',
};

export function ReportsConsolePage() {
  const { storeCode: routeStoreCode } = useParams();
  const initialStore = routeStoreCode || 'all';
  return <ReportsConsoleContent key={initialStore} initialStoreCode={initialStore} />;
}

function ReportsConsoleContent({ initialStoreCode }) {
  const [dateRange, setDateRange] = useState('month');
  const [storeCode, setStoreCode] = useState(initialStoreCode);
  const [isZReportOpen, setIsZReportOpen] = useState(false);

  const {
    data: dashboardData,
    isLoading,
    error,
  } = useOwnerDashboard({ dateRange, storeCode });

  const summary = dashboardData?.summary || {};
  const thisMonthProfit = dashboardData?.thisMonthProfit || {};
  const inventoryValuation = dashboardData?.inventoryValuation || {};
  const periodComparison = dashboardData?.periodComparison || {};
  const salesVelocity = dashboardData?.salesVelocity || [];
  const lifetimeTimeline = dashboardData?.lifetimeTimeline || {};
  const branches = dashboardData?.branches || [];
  const categories = dashboardData?.categories || [];
  const starProducts = dashboardData?.starProducts || [];
  const payments = dashboardData?.payments || {};
  const regions = dashboardData?.regions || [];
  const profitLevers = dashboardData?.profitLevers || {};

  const activeBranchMeta = branches.find((b) => b.code === storeCode);
  const eodData = {
    storeName: activeBranchMeta?.name || 'Star Enterprises (Combined Branches)',
    gstin: activeBranchMeta?.gstin || '27AATPQ6775F1ZV',
    dateRangeLabel: DATE_RANGE_LABELS[dateRange] || dateRange,
    openingInvoice: summary.openingInvoice || 'N/A',
    closingInvoice: summary.closingInvoice || 'N/A',
    totalInvoices: summary.totalInvoices ?? 0,
    grossSales: summary.totalSales || 0,
    totalCogs: summary.totalCogs || 0,
    estimatedGrossProfit: summary.estimatedGrossProfit || 0,
    grossMarginPercent: summary.grossMarginPercent || 0,
    cgst: summary.cgstTotal ?? (summary.totalGst || 0) / 2,
    sgst: summary.sgstTotal ?? (summary.totalGst || 0) / 2,
    totalTax: summary.totalGst || 0,
    totalDiscounts: summary.totalDiscount || 0,
    cashDrawer: {
      cashInTill: payments.cash || 0,
      instantUpi: payments.upi || 0,
      posCards: payments.card || 0,
      estimatedCardMdr: payments.estimatedCardMdrCost || 0,
      netCardDeposit: Math.max(0, (payments.card || 0) - (payments.estimatedCardMdrCost || 0)),
      financierReceivable: payments.emi || 0,
    },
  };

  return (
    <div className="space-y-6 pb-12 min-w-0">
      {/* 1. Control Header */}
      <ReportsControlBar
        dateRange={dateRange}
        setDateRange={setDateRange}
        storeCode={storeCode}
        setStoreCode={setStoreCode}
        onOpenZReport={() => setIsZReportOpen(true)}
        activeStoreLabel={STORE_LABELS[storeCode] || 'All Branches'}
      />

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl border border-brand-crimson-border bg-brand-crimson-subtle/40 text-xs text-brand-crimson-text flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>Could not load report metrics: {getErrorMessage(error)}</span>
        </div>
      )}

      {/* Empty Period Hint */}
      {summary.totalInvoices === 0 && !isLoading && !error && (
        <div className="p-3.5 rounded-lg border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-muted">
            <Info size={15} className="text-accent shrink-0" />
            <span>
              No bills recorded for {DATE_RANGE_LABELS[dateRange] || dateRange} in {STORE_LABELS[storeCode] || storeCode}.
            </span>
          </div>
          {dateRange !== 'month' && (
            <button
              type="button"
              onClick={() => setDateRange('month')}
              className="text-text font-semibold underline hover:text-brand-sage-text cursor-pointer self-start sm:self-auto"
            >
              Switch to This Month
            </button>
          )}
        </div>
      )}

      {/* 2. Core 4 KPIs (This Month Profit, Gross Profit Excl GST, Items Valuation, Billed Sales) */}
      <ReportsCoreKpis
        summary={summary}
        thisMonthProfit={thisMonthProfit}
        inventoryValuation={inventoryValuation}
        periodComparison={periodComparison}
        isLoading={isLoading}
      />

      {/* 3. Store Performance Graph, Lifetime Timeline & Branch Comparison */}
      <StorePerformanceChart
        salesVelocity={salesVelocity}
        lifetimeTimeline={lifetimeTimeline}
        branches={branches}
        dateRange={dateRange}
      />

      {/* 4. Manager Insights Grid (Most Selling Category, Star Product, EMI vs Cash Persons, Region) */}
      <ManagerInsightsGrid
        categories={categories}
        starProducts={starProducts}
        payments={payments}
        regions={regions}
      />

      {/* 5. Actionable Profit-Doubling Levers */}
      <ProfitDoublingLevers
        profitLevers={profitLevers}
        payments={payments}
        storeCode={storeCode}
      />

      {/* Printable EOD Z-Report Modal */}
      {isZReportOpen && (
        <DayEndZReportModal
          isOpen={isZReportOpen}
          onClose={() => setIsZReportOpen(false)}
          eodData={eodData}
        />
      )}
    </div>
  );
}
