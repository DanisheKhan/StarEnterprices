import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  useDealers,
  useDealerBills,
  useDealerAnalytics,
} from '../hooks/useDealers';
import { useStores } from '@/features/stores';
import { LoadingState, KpiGridSkeleton, Badge } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format';
import { DealerStatsHeader } from '../components/DealerStatsHeader';
import { DealerDirectoryTable } from '../components/DealerDirectoryTable';
import { BillsRegisterTable } from '../components/BillsRegisterTable';
import { AddDealerModal } from '../components/AddDealerModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { DebitNoteModal } from '../components/DebitNoteModal';
import { BillTimelineModal } from '../components/BillTimelineModal';
import { DealerBillPrintModal } from '../components/DealerBillPrintModal';
import {
  Building2,
  FileText,
  Plus,
  AlertTriangle,
} from 'lucide-react';

export function DealersHubPage() {
  const { storeCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: stores = [] } = useStores();

  const currentStore = stores.find((s) => s.code === storeCode);
  const storeId = currentStore?.id || null;

  const [activeTab, setActiveTab] = useState('bills'); // bills | directory

  // Modals state
  const [isAddDealerOpen, setIsAddDealerOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isDebitNoteOpen, setIsDebitNoteOpen] = useState(false);
  const [timelineBill, setTimelineBill] = useState(null);
  const [printingBill, setPrintingBill] = useState(null);

  // Selected item contexts for modals
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);

  // Data queries
  const { data: rawDealers, isLoading: isLoadingDealers } = useDealers({
    storeId,
  });
  const { data: rawBills, isLoading: isLoadingBills } = useDealerBills({
    storeId,
  });
  const { data: analytics, isLoading: isLoadingAnalytics } = useDealerAnalytics(storeId);

  const dealers = useMemo(() => {
    return Array.isArray(rawDealers) ? rawDealers.filter(Boolean) : [];
  }, [rawDealers]);

  const bills = useMemo(() => {
    return Array.isArray(rawBills) ? rawBills.filter(Boolean) : [];
  }, [rawBills]);

  // Urgent payment reminders calculation
  const urgentOverdue = useMemo(() => {
    return bills.filter(
      (b) => b && b.status !== 'paid' && b.isOverdue && Number(b.balance_amount) > 0
    );
  }, [bills]);

  const dueSoon = useMemo(() => {
    return bills.filter(
      (b) =>
        b &&
        b.status !== 'paid' &&
        !b.isOverdue &&
        (b.daysUntilDue ?? 999) <= 7 &&
        Number(b.balance_amount) > 0
    );
  }, [bills]);

  const totalOverdueAmount = useMemo(() => {
    return urgentOverdue.reduce((sum, b) => sum + Number(b?.balance_amount || 0), 0);
  }, [urgentOverdue]);

  const totalDueSoonAmount = useMemo(() => {
    return dueSoon.reduce((sum, b) => sum + Number(b?.balance_amount || 0), 0);
  }, [dueSoon]);

  // Auto-open print preview if redirected from PurchaseBillingPage via ?print=id
  const printParamId = searchParams.get('print');
  useEffect(() => {
    if (printParamId && bills.length > 0) {
      const match = bills.find((b) => b.id === printParamId);
      if (match) {
        setPrintingBill(match);
      }
    }
  }, [printParamId, bills]);

  function handleClosePrintModal() {
    setPrintingBill(null);
    if (searchParams.has('print')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('print');
      setSearchParams(nextParams, { replace: true });
    }
  }

  const isInitialLoading =
    (isLoadingBills && bills.length === 0) ||
    (isLoadingDealers && dealers.length === 0) ||
    (isLoadingAnalytics && !analytics);

  const basePath = storeCode ? `/admin/${storeCode}/dealers` : '/admin/dealers';

  function handleOpenRecordPayment(dealer = null, bill = null) {
    setSelectedDealer(dealer);
    setSelectedBill(bill);
    setIsRecordPaymentOpen(true);
  }

  function handleOpenDebitNote(dealer = null) {
    setSelectedDealer(dealer);
    setIsDebitNoteOpen(true);
  }

  function handleOpenTimeline(billId, bill = null) {
    if (bill) {
      setTimelineBill(bill);
    } else if (typeof billId === 'object' && billId !== null) {
      setTimelineBill(billId);
    } else {
      const found = bills.find((b) => b.id === billId);
      setTimelineBill(found || { id: billId });
    }
  }

  if (isInitialLoading) {
    return (
      <div className="w-full space-y-6 min-w-0 pb-12 animate-in fade-in duration-150">
        {/* 1. Page Header */}
        <div className="pb-4 border-b border-border min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
            SUPPLIER DUES & REMINDERS • KHATA
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Dealer Dues & Payment Reminders
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed max-w-3xl">
            Track goods bought from dealers on credit, pending amounts to give, and upcoming payment due dates.
          </p>
        </div>

        {/* 2. Shimmer Skeleton for Metrics - Never flash ₹0 */}
        <KpiGridSkeleton count={4} />

        {/* 3. Unified Standard Loading Screen */}
        <div className="bg-surface border border-border rounded-xl shadow-2xs">
          <LoadingState
            fullScreen
            title="Loading Dealer Dues & Reminders"
            message="Retrieving supplier balances, upcoming due dates, and payment history..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 min-w-0 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border min-w-0">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
            SUPPLIER DUES & REMINDERS • KHATA
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Dealer Dues & Payment Reminders
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed max-w-3xl">
            Track goods bought from dealers on credit, pending amounts to give, and upcoming payment due dates.
          </p>
        </div>

        <div>
          <Link
            to={`${basePath}/billing`}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg bg-accent text-accent-fg hover:bg-accent/90 active:scale-[0.99] shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Record Purchase & Payment Terms</span>
          </Link>
        </div>
      </div>

      {/* Active Payment Reminders Alert Strip */}
      {(urgentOverdue.length > 0 || dueSoon.length > 0) && (
        <div className="p-4 rounded-xl border bg-surface border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                urgentOverdue.length > 0
                  ? 'bg-brand-crimson-subtle text-brand-crimson border border-brand-crimson-border'
                  : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-text flex items-center gap-2 flex-wrap">
                <span>Payment Reminders for Goods Bought</span>
                {urgentOverdue.length > 0 && (
                  <Badge variant="danger" className="text-[10px] uppercase font-bold px-1.5 py-0.5">
                    {urgentOverdue.length} Overdue
                  </Badge>
                )}
                {dueSoon.length > 0 && (
                  <Badge variant="amber" className="text-[10px] uppercase font-bold px-1.5 py-0.5">
                    {dueSoon.length} Due This Week
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted mt-1 flex items-center gap-2 flex-wrap">
                {urgentOverdue.length > 0 && (
                  <span className="font-semibold text-brand-crimson">
                    {formatCurrency(totalOverdueAmount)} overdue past agreed terms!
                  </span>
                )}
                {urgentOverdue.length > 0 && dueSoon.length > 0 && <span>•</span>}
                {dueSoon.length > 0 && (
                  <span>
                    {formatCurrency(totalDueSoonAmount)} due to be paid within the next 7 days.
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-text hover:bg-surface-subtle transition-all cursor-pointer shrink-0 self-start sm:self-auto"
          >
            View Dues
          </button>
        </div>
      )}

      {/* 2. Executive Analytics & Aging Header */}
      <DealerStatsHeader analytics={analytics} isLoading={isLoadingAnalytics} />

      {/* 3. Navigation Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-px overflow-x-auto no-scrollbar min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('bills')}
            className={`pb-3 px-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap focus:outline-none ${
              activeTab === 'bills'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <FileText size={14} />
            <span>All Bills & Dues ({bills.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`pb-3 px-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap focus:outline-none ${
              activeTab === 'directory'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <Building2 size={14} />
            <span>Dealer Directory ({dealers.length})</span>
          </button>
        </div>
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'bills' && (
        <BillsRegisterTable
          bills={bills}
          dealers={dealers}
          currentStore={currentStore}
          isLoading={isLoadingBills}
          onOpenRecordPayment={handleOpenRecordPayment}
          onOpenTimeline={handleOpenTimeline}
        />
      )}

      {activeTab === 'directory' && (
        <DealerDirectoryTable
          dealers={dealers}
          isLoading={isLoadingDealers}
          onOpenAddDealer={() => setIsAddDealerOpen(true)}
          onOpenRecordPayment={handleOpenRecordPayment}
          basePath={basePath}
        />
      )}

      {/* Modals */}
      <AddDealerModal
        isOpen={isAddDealerOpen}
        onClose={() => setIsAddDealerOpen(false)}
        storeId={storeId}
      />

      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        dealers={dealers}
        preselectedDealer={selectedDealer}
        preselectedBill={selectedBill}
        storeId={storeId}
      />

      <DebitNoteModal
        isOpen={isDebitNoteOpen}
        onClose={() => setIsDebitNoteOpen(false)}
        dealers={dealers}
        preselectedDealer={selectedDealer}
        storeId={storeId}
      />

      {timelineBill && (
        <BillTimelineModal
          isOpen={Boolean(timelineBill)}
          onClose={() => setTimelineBill(null)}
          billId={timelineBill.id}
          initialBill={timelineBill}
          onOpenRecordPayment={handleOpenRecordPayment}
        />
      )}

      {printingBill && (
        <DealerBillPrintModal
          isOpen={Boolean(printingBill)}
          onClose={handleClosePrintModal}
          bill={printingBill}
          currentStore={currentStore}
        />
      )}
    </div>
  );
}
