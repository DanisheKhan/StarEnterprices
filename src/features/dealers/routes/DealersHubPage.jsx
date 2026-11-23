import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  useDealers,
  useDealerBills,
  useDealerAnalytics,
} from '../hooks/useDealers';
import { useStores } from '@/features/stores';
import { LoadingState, KpiGridSkeleton } from '@/shared/ui';
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
  const { data: dealers = [], isLoading: isLoadingDealers } = useDealers({
    storeId,
  });
  const { data: bills = [], isLoading: isLoadingBills } = useDealerBills({
    storeId,
  });
  const { data: analytics, isLoading: isLoadingAnalytics } = useDealerAnalytics(storeId);

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
            ACCOUNTS PAYABLE & PROCUREMENT
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Dealer & Supplier Khata
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed max-w-3xl">
            Multi-dealer central ledgers (Godrej, Samsung, Onida), partial payments, aging timeline, and strict GST vs. Kaccha separation.
          </p>
        </div>

        {/* 2. Shimmer Skeleton for Metrics - Never flash ₹0 */}
        <KpiGridSkeleton count={4} />

        {/* 3. Unified Standard Loading Screen */}
        <div className="bg-surface border border-border rounded-xl shadow-2xs">
          <LoadingState
            fullScreen
            title="Loading Dealer & Khata Register"
            message="Retrieving verified supplier balances, bills, and accounts payable..."
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
            ACCOUNTS PAYABLE & PROCUREMENT
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Dealer & Supplier Khata
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed max-w-3xl">
            Multi-dealer central ledgers (Godrej, Samsung, Onida), partial payments, aging timeline, and strict GST vs. Kaccha separation.
          </p>
        </div>

        <div>
          <Link
            to={`${basePath}/billing`}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-accent text-accent-fg hover:bg-accent/90 active:scale-[0.99] shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Record Purchase Bill</span>
          </Link>
        </div>
      </div>

      {/* 2. Executive Analytics & Aging Header */}
      <DealerStatsHeader analytics={analytics} isLoading={isLoadingAnalytics} />

      {/* 3. Navigation Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-px overflow-x-hidden">
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
            <span>All Bills & Aging ({bills.length})</span>
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
