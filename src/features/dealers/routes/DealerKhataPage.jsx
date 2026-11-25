import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDealer, useDealers } from '../hooks/useDealers';
import { DealerKhataLedger } from '../components/DealerKhataLedger';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { DebitNoteModal } from '../components/DebitNoteModal';
import { BillTimelineModal } from '../components/BillTimelineModal';
import { ArrowLeft } from 'lucide-react';

export function DealerKhataPage() {
  const { dealerId, storeCode } = useParams();

  const { data: dealer, isLoading } = useDealer(dealerId);
  const { data: allDealers = [] } = useDealers();

  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isDebitNoteOpen, setIsDebitNoteOpen] = useState(false);
  const [timelineBill, setTimelineBill] = useState(null);

  const backLink = storeCode ? `/admin/${storeCode}/dealers` : '/admin/dealers';

  return (
    <div className="w-full space-y-6 min-w-0 pb-12">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <Link
          to={backLink}
          className="inline-flex items-center gap-1.5 font-semibold text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to All Dealers</span>
        </Link>
        <span className="text-muted">/</span>
        <span className="font-bold text-text">
          {isLoading ? 'Loading...' : dealer?.brand_name || dealer?.name} Khata Passbook
        </span>
      </div>

      {/* Passbook Ledger */}
      <DealerKhataLedger
        dealerId={dealerId}
        onOpenRecordPayment={() => setIsRecordPaymentOpen(true)}
        onOpenDebitNote={() => setIsDebitNoteOpen(true)}
        onOpenTimeline={(id, bill) => setTimelineBill(bill || { id })}
      />

      {/* Modals with preselected dealer */}
      {dealer && (
        <>
          <RecordPaymentModal
            isOpen={isRecordPaymentOpen}
            onClose={() => setIsRecordPaymentOpen(false)}
            dealers={allDealers}
            preselectedDealer={dealer}
          />

          <DebitNoteModal
            isOpen={isDebitNoteOpen}
            onClose={() => setIsDebitNoteOpen(false)}
            dealers={allDealers}
            preselectedDealer={dealer}
          />
        </>
      )}

      {timelineBill && (
        <BillTimelineModal
          isOpen={Boolean(timelineBill)}
          onClose={() => setTimelineBill(null)}
          billId={timelineBill.id}
          initialBill={timelineBill}
          onOpenRecordPayment={() => setIsRecordPaymentOpen(true)}
        />
      )}
    </div>
  );
}
