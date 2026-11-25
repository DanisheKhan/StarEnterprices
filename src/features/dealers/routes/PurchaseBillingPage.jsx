import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate, useParams, Link } from 'react-router-dom';
import { Badge, Button } from '@/shared/ui';
import { useDealers } from '../hooks/useDealers';
import { createDealerBill } from '../api/dealers.api';
import { AddDealerModal } from '../components/AddDealerModal';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import {
  Package,
  Building2,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Plus,
  Calendar,
  Clock,
  Coins,
  AlertCircle,
  Building,
  Receipt,
  Landmark,
  FileText,
  QrCode,
} from 'lucide-react';

let nextRowSeq = 2;
function createRowId() {
  return nextRowSeq++;
}

const COMMON_BANKS = [
  'HDFC Bank',
  'State Bank of India (SBI)',
  'ICICI Bank',
  'Punjab National Bank (PNB)',
  'Axis Bank',
  'Bank of Baroda',
  'Kotak Mahindra Bank',
  'Canara Bank',
  'Union Bank of India',
  'Other Bank',
];

export function PurchaseBillingPage() {
  const { store, storeCode: outletStoreCode } = useOutletContext() || {};
  const { storeCode: paramStoreCode } = useParams();
  const navigate = useNavigate();

  const effectiveStoreCode = paramStoreCode || outletStoreCode || store?.code || 'furniture-electronics';
  const storeId = store?.id || null;
  const basePath = effectiveStoreCode ? `/admin/${effectiveStoreCode}/dealers` : '/admin/dealers';

  const { data: rawDealers = [] } = useDealers({ storeId });
  const dealers = useMemo(() => (Array.isArray(rawDealers) ? rawDealers.filter(Boolean) : []), [rawDealers]);

  // Stepper state: 1: Goods & Bill Details, 2: Payment Plan & Cheque Schedule
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1: Supplier & Goods Information
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [isAddDealerModalOpen, setIsAddDealerModalOpen] = useState(false);
  const [billType, setBillType] = useState('gst'); // 'gst' (Pakka) or 'kaccha' (Estimate/Informal)
  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Items List mode: default is 'lumpsum' as requested!
  const [entryMode, setEntryMode] = useState('lumpsum'); // 'lumpsum' | 'itemized'
  const [lumpSumAmount, setLumpSumAmount] = useState('');
  const [items, setItems] = useState([
    { id: 1, name: '', quantity: 1, unitPrice: '', total: 0 },
  ]);

  // Selected dealer object
  const selectedDealer = useMemo(() => {
    return dealers.find((d) => d.id === selectedDealerId) || null;
  }, [dealers, selectedDealerId]);

  function handleSelectDealer(nextDealerId, explicitDealer = null) {
    setSelectedDealerId(nextDealerId);
    const dealer = explicitDealer || dealers.find((d) => d.id === nextDealerId) || null;
    if (dealer) {
      if (dealer.billing_mode === 'kaccha') {
        setBillType('kaccha');
      } else if (dealer.billing_mode === 'gst') {
        setBillType('gst');
      }
      if (dealer.default_credit_days) {
        setCreditDays(Number(dealer.default_credit_days));
      }
    }
  }

  // Itemized calculation
  const calculatedItemsTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = Math.max(1, Number(it.quantity) || 1);
      const p = Math.max(0, Number(it.unitPrice) || 0);
      return sum + q * p;
    }, 0);
  }, [items]);

  // Grand Total Bill Amount
  const totalBillAmount = useMemo(() => {
    if (entryMode === 'lumpsum') {
      return Math.max(0, Number(lumpSumAmount) || 0);
    }
    return calculatedItemsTotal;
  }, [entryMode, lumpSumAmount, calculatedItemsTotal]);

  // =========================================================================
  // Step 2: Settlement Terms & Schedule
  // Modes: 'full' (Full Payment), 'partial' (Partial Payment), 'later' (Pay Later)
  // =========================================================================
  const [settlementMode, setSettlementMode] = useState('partial'); // 'full' | 'partial' | 'later'

  // Full Payment specific fields
  const [fullPaymentMode, setFullPaymentMode] = useState('cash'); // 'cash' | 'cheque' | 'bank_transfer' | 'upi'
  const [fullChequeNumber, setFullChequeNumber] = useState('');
  const [fullChequeBank, setFullChequeBank] = useState('HDFC Bank');
  const [fullChequeDate, setFullChequeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fullTransactionRef, setFullTransactionRef] = useState('');
  const [fullPaymentNotes, setFullPaymentNotes] = useState('');

  // Partial Payment specific fields
  // 1. Upfront Cash on Delivery
  const [cashAmount, setCashAmount] = useState('');
  const [cashNotes, setCashNotes] = useState('');

  // 2. Online / UPI Transfer
  const [onlineAmount, setOnlineAmount] = useState('');
  const [onlineRef, setOnlineRef] = useState('');

  // 3. Cheques & Post-Dated Cheques (PDC List)
  const [cheques, setCheques] = useState([
    {
      id: 1,
      amount: '',
      chequeNumber: '',
      bankName: 'HDFC Bank',
      customBankName: '',
      chequeDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
  ]);

  // Credit terms & Due Date for remaining balance
  const [creditDays, setCreditDays] = useState(30);
  const [customDueDate, setCustomDueDate] = useState('');
  const [promiseNotes, setPromiseNotes] = useState('');

  // Computed Due Date based on bill date + credit days
  const computedDueDate = useMemo(() => {
    if (customDueDate) return customDueDate;
    if (!billDate) return '';
    const d = new Date(billDate);
    d.setDate(d.getDate() + Number(creditDays || 0));
    return d.toISOString().split('T')[0];
  }, [billDate, creditDays, customDueDate]);

  // Total Payments / Cheques Committed
  const totalChequesAmount = useMemo(() => {
    return cheques.reduce((sum, chq) => sum + (Math.max(0, Number(chq.amount)) || 0), 0);
  }, [cheques]);

  const totalCommittedPaid = useMemo(() => {
    if (settlementMode === 'full') {
      return totalBillAmount;
    }
    if (settlementMode === 'later') {
      return 0;
    }
    const cash = Math.max(0, Number(cashAmount) || 0);
    const online = Math.max(0, Number(onlineAmount) || 0);
    return cash + online + totalChequesAmount;
  }, [settlementMode, totalBillAmount, cashAmount, onlineAmount, totalChequesAmount]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, totalBillAmount - totalCommittedPaid);
  }, [totalBillAmount, totalCommittedPaid]);

  // Timeline events preview generator for Step 2
  const timelineSchedule = useMemo(() => {
    const list = [];
    if (!billDate || totalBillAmount <= 0) return list;

    // Milestone 1: Goods Received
    list.push({
      id: 'intake',
      title: 'Goods Received & Consignment Billed',
      subtitle: `${billType === 'gst' ? 'GST Tax Invoice' : 'Kaccha Parchi'} #${billNumber || 'TBD'} from ${selectedDealer?.brand_name || selectedDealer?.name || 'Supplier'}`,
      amount: totalBillAmount,
      date: billDate,
      type: 'bill',
      icon: Package,
      badge: 'Billed',
      color: 'bg-brand-sage text-white',
    });

    if (settlementMode === 'full') {
      const modeLabel =
        fullPaymentMode === 'cash'
          ? 'Cash on Delivery'
          : fullPaymentMode === 'cheque'
          ? `Cheque (${fullChequeBank}) #${fullChequeNumber || 'N/A'}`
          : fullPaymentMode === 'bank_transfer'
          ? `Bank Transfer (Ref: ${fullTransactionRef || 'N/A'})`
          : `UPI / QR Transfer (Ref: ${fullTransactionRef || 'N/A'})`;

      list.push({
        id: 'full-pmt',
        title: `Full Settlement via ${fullPaymentMode.toUpperCase()}`,
        subtitle: modeLabel,
        amount: totalBillAmount,
        date: fullPaymentMode === 'cheque' ? (fullChequeDate || billDate) : billDate,
        type: 'payment',
        icon: CheckCircle2,
        badge: 'Cleared in Full',
        color: 'bg-emerald-600 text-white',
      });
      return list;
    }

    if (settlementMode === 'partial') {
      // Upfront Cash
      if (Number(cashAmount) > 0) {
        list.push({
          id: 'cash-upfront',
          title: 'Advance Cash Paid on Delivery',
          subtitle: cashNotes || 'Cash handed over upon goods unloading',
          amount: Number(cashAmount),
          date: billDate,
          type: 'payment',
          icon: Coins,
          badge: 'Cash Cleared',
          color: 'bg-emerald-600 text-white',
        });
      }

      // Online Transfer
      if (Number(onlineAmount) > 0) {
        list.push({
          id: 'online-upfront',
          title: 'Immediate Online / UPI Transfer',
          subtitle: onlineRef ? `Ref: ${onlineRef}` : 'Instant transfer',
          amount: Number(onlineAmount),
          date: billDate,
          type: 'payment',
          icon: QrCode,
          badge: 'Online Cleared',
          color: 'bg-blue-600 text-white',
        });
      }

      // Cheques & PDCs
      cheques.forEach((chq, idx) => {
        if (Number(chq.amount) > 0) {
          const isPdc = chq.chequeDate && chq.chequeDate > billDate;
          const bank = chq.bankName === 'Other Bank' ? (chq.customBankName || 'Other Bank') : chq.bankName;
          list.push({
            id: `cheque-${chq.id}`,
            title: isPdc ? `PDC Clearing (Cheque #${idx + 1})` : `Current Cheque #${idx + 1}`,
            subtitle: `${bank} • Cheque #${chq.chequeNumber || 'N/A'}${chq.notes ? ` • ${chq.notes}` : ''}`,
            amount: Number(chq.amount),
            date: chq.chequeDate || billDate,
            type: isPdc ? 'pdc' : 'payment',
            icon: Landmark,
            badge: isPdc ? 'PDC Scheduled' : 'Current Cheque',
            color: isPdc ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white',
          });
        }
      });
    }

    // Remaining Balance Due Milestone (for partial or later)
    if (remainingBalance > 0) {
      list.push({
        id: 'remaining-due',
        title: 'Remaining Khata Balance Due Date',
        subtitle: promiseNotes || `Agreed payment balance under ${creditDays}-day credit terms`,
        amount: remainingBalance,
        date: computedDueDate,
        type: 'due',
        icon: Clock,
        badge: 'Payment Due',
        color: 'bg-brand-crimson text-white',
      });
    }

    // Sort chronologically by date
    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [
    billDate,
    totalBillAmount,
    billType,
    billNumber,
    selectedDealer,
    settlementMode,
    fullPaymentMode,
    fullChequeBank,
    fullChequeNumber,
    fullChequeDate,
    fullTransactionRef,
    cashAmount,
    cashNotes,
    onlineAmount,
    onlineRef,
    cheques,
    remainingBalance,
    computedDueDate,
    promiseNotes,
    creditDays,
  ]);

  // Item manipulation handlers
  function handleAddItemRow() {
    setItems((prev) => [
      ...prev,
      { id: createRowId(), name: '', quantity: 1, unitPrice: '', total: 0 },
    ]);
  }

  function handleUpdateItemRow(id, field, value) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        const q = Math.max(1, Number(field === 'quantity' ? value : it.quantity) || 1);
        const p = Math.max(0, Number(field === 'unitPrice' ? value : it.unitPrice) || 0);
        updated.total = q * p;
        return updated;
      })
    );
  }

  function handleRemoveItemRow(id) {
    if (items.length <= 1) {
      setItems([{ id: createRowId(), name: '', quantity: 1, unitPrice: '', total: 0 }]);
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // Cheque manipulation handlers
  function handleAddChequeRow() {
    const nextDateObj = new Date(billDate);
    nextDateObj.setDate(nextDateObj.getDate() + 15);
    const defaultPdcDate = nextDateObj.toISOString().split('T')[0];

    setCheques((prev) => [
      ...prev,
      {
        id: createRowId(),
        amount: remainingBalance > 0 ? String(remainingBalance) : '',
        chequeNumber: '',
        bankName: selectedDealer?.bank_name || 'HDFC Bank',
        customBankName: '',
        chequeDate: defaultPdcDate,
        notes: 'Post-Dated Cheque (PDC)',
      },
    ]);
  }

  function handleUpdateChequeRow(id, field, value) {
    setCheques((prev) =>
      prev.map((chq) => (chq.id === id ? { ...chq, [field]: value } : chq))
    );
  }

  function handleRemoveChequeRow(id) {
    if (cheques.length <= 1) {
      setCheques([
        {
          id: createRowId(),
          amount: '',
          chequeNumber: '',
          bankName: 'HDFC Bank',
          customBankName: '',
          chequeDate: new Date().toISOString().split('T')[0],
          notes: '',
        },
      ]);
      return;
    }
    setCheques((prev) => prev.filter((chq) => chq.id !== id));
  }

  // Validation before going to Step 2
  function handleProceedToStep2() {
    setErrorMsg('');
    if (!selectedDealerId) {
      setErrorMsg('Please select a Supplier / Brand Dealer before proceeding.');
      return;
    }
    if (!billNumber.trim()) {
      setErrorMsg('Please enter the Bill / Invoice / Parchi Reference Number.');
      return;
    }
    if (totalBillAmount <= 0) {
      setErrorMsg('Total Purchase Amount must be greater than ₹0.');
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Final Submit Handler
  async function handleSavePurchase() {
    setErrorMsg('');
    if (totalCommittedPaid > totalBillAmount) {
      setErrorMsg('Total amount paid & cheques committed exceeds the total bill amount!');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Prepare items payload
      const preparedItems =
        entryMode === 'itemized'
          ? items
              .filter((it) => it.name.trim())
              .map((it) => ({
                name: it.name.trim(),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unit_price: Math.max(0, Number(it.unitPrice) || 0),
                total: Math.max(0, (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0)),
              }))
          : [
              {
                name: purchaseTitle.trim() || 'Lump-sum goods intake',
                quantity: 1,
                unit_price: totalBillAmount,
                total: totalBillAmount,
              },
            ];

      // 2. Prepare Tax breakdown for GST bills
      let taxableAmount = totalBillAmount;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (billType === 'gst') {
        // Approximate 18% inclusive GST
        taxableAmount = Number((totalBillAmount / 1.18).toFixed(2));
        const totalTax = totalBillAmount - taxableAmount;
        cgstAmount = Number((totalTax / 2).toFixed(2));
        sgstAmount = Number((totalTax / 2).toFixed(2));
      }

      // 3. Prepare Payments / Cheques payload
      const initialPayments = [];

      if (settlementMode === 'full') {
        const fullBank = fullChequeBank;
        initialPayments.push({
          payment_date: billDate,
          cheque_date: fullPaymentMode === 'cheque' ? (fullChequeDate || billDate) : null,
          amount: totalBillAmount,
          payment_mode: fullPaymentMode,
          payment_channel: billType === 'kaccha' ? 'secondary_cash' : 'official_bank',
          transaction_ref:
            fullPaymentMode === 'cheque'
              ? (fullChequeNumber.trim() || null)
              : (fullTransactionRef.trim() || null),
          notes:
            fullPaymentMode === 'cheque'
              ? `Full Cheque (${fullBank}) #${fullChequeNumber || 'N/A'}${fullPaymentNotes ? ` - ${fullPaymentNotes}` : ''}`
              : fullPaymentNotes.trim() || `Full payment via ${fullPaymentMode.toUpperCase()} on delivery`,
        });
      } else if (settlementMode === 'partial') {
        // Upfront Cash
        if (Number(cashAmount) > 0) {
          initialPayments.push({
            payment_date: billDate,
            amount: Number(cashAmount),
            payment_mode: 'cash',
            payment_channel: billType === 'kaccha' ? 'secondary_cash' : 'official_bank',
            notes: cashNotes.trim() || 'Advance cash paid on delivery',
          });
        }

        // Online / UPI
        if (Number(onlineAmount) > 0) {
          initialPayments.push({
            payment_date: billDate,
            amount: Number(onlineAmount),
            payment_mode: 'bank_transfer',
            payment_channel: 'official_bank',
            transaction_ref: onlineRef.trim() || null,
            notes: 'Immediate online/UPI transfer on delivery',
          });
        }

        // Cheques & PDCs
        for (const chq of cheques) {
          if (Number(chq.amount) > 0) {
            const isPdc = chq.chequeDate && chq.chequeDate > billDate;
            const bank = chq.bankName === 'Other Bank' ? (chq.customBankName || 'Other Bank') : chq.bankName;
            initialPayments.push({
              payment_date: billDate,
              cheque_date: chq.chequeDate || billDate,
              amount: Number(chq.amount),
              payment_mode: 'cheque',
              payment_channel: 'official_bank',
              transaction_ref: chq.chequeNumber.trim() || null,
              notes: `${isPdc ? 'PDC Cheque' : 'Cheque'} (${bank}) #${chq.chequeNumber || 'N/A'}${
                chq.notes ? ` - ${chq.notes}` : ''
              }`,
            });
          }
        }
      }

      // 4. Combined Notes
      const combinedNotes = [
        purchaseTitle.trim() ? `Purchase: ${purchaseTitle.trim()}` : null,
        promiseNotes.trim() ? `Promise/Terms: ${promiseNotes.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      // 5. Submit Bill
      await createDealerBill({
        store_id: storeId,
        dealer_id: selectedDealerId,
        bill_type: billType,
        bill_number: billNumber.trim(),
        bill_date: billDate,
        credit_days: Number(creditDays) || 30,
        due_date: computedDueDate,
        total_amount: totalBillAmount,
        taxable_amount: taxableAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        items: preparedItems,
        notes: combinedNotes || null,
        initial_payments: initialPayments,
      });

      // Navigate back to hub with success
      navigate(basePath, { replace: true });
    } catch (err) {
      console.error('[PurchaseBillingPage] Error saving bill:', err);
      setErrorMsg(err.message || 'Failed to save purchase bill. Please verify details and retry.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 px-3 sm:px-6 animate-in fade-in duration-150">
      {/* 1. Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <Link
            to={basePath}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            <span>Back to Supplier Dues & Khata</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-sage block">
              SUPPLIER INTAKE & SETTLEMENT WIZARD
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Record Purchase & Payment Terms
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed max-w-3xl">
            Enter goods received from dealer, bill details, and schedule payments (cash, cheques, PDCs, or credit terms).
          </p>
        </div>
      </div>

      {/* 2. Interactive Timeline Stepper (Matching POSPage design) */}
      <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {[
            {
              id: 1,
              label: 'Goods & Bill',
              subtitle: selectedDealer?.brand_name
                ? `${selectedDealer.brand_name} • ${formatCurrency(totalBillAmount)}`
                : 'Supplier, Invoice & Amount',
            },
            {
              id: 2,
              label: 'Payment & Settlement',
              subtitle:
                settlementMode === 'full'
                  ? 'Full Payment'
                  : settlementMode === 'partial'
                  ? 'Partial & Cheques'
                  : 'Pay Later (100% Credit)',
            },
          ].map((s, idx, arr) => {
            const isCurrent = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            const isClickable =
              s.id < currentStep ||
              (s.id === 2 && selectedDealerId && billNumber && totalBillAmount > 0);

            return (
              <div key={s.id} className="flex-1 flex items-center min-w-0 last:flex-initial">
                {/* Timeline Step Node Button */}
                <button
                  type="button"
                  disabled={!isClickable && !isCurrent}
                  onClick={() => {
                    if (s.id === 1) setCurrentStep(1);
                    if (s.id === 2) handleProceedToStep2();
                  }}
                  className={cn(
                    'flex items-center gap-2.5 sm:gap-3 text-left focus:outline-none transition-all select-none shrink-0',
                    isClickable || isCurrent ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  )}
                >
                  {/* Timeline Circle Marker */}
                  <div
                    className={cn(
                      'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all border-2',
                      isCompleted && 'bg-brand-sage text-white border-brand-sage shadow-2xs',
                      isCurrent && 'bg-accent text-accent-fg border-accent ring-4 ring-accent/15 shadow-2xs',
                      !isCurrent && !isCompleted && 'bg-surface text-muted border-border'
                    )}
                  >
                    {isCompleted ? (
                      <Check size={14} className="stroke-[3]" />
                    ) : (
                      <span>{s.id}</span>
                    )}
                  </div>

                  {/* Step Label & Subtitle */}
                  <div className="min-w-0">
                    <div
                      className={cn(
                        'text-xs sm:text-sm leading-tight truncate',
                        isCurrent
                          ? 'font-bold text-text'
                          : isCompleted
                          ? 'font-semibold text-text'
                          : 'font-medium text-muted'
                      )}
                    >
                      {s.label}
                    </div>
                    {s.subtitle && (
                      <div className="text-[11px] text-muted truncate mt-0.5 hidden xs:block">
                        {s.subtitle}
                      </div>
                    )}
                  </div>
                </button>

                {/* Timeline Connecting Line */}
                {idx < arr.length - 1 && (
                  <div className="flex-1 mx-3 sm:mx-6 h-0.5 bg-border relative overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: currentStep > s.id ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-brand-crimson-subtle border border-brand-crimson-border text-brand-crimson text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: GOODS & PURCHASE INTAKE                                          */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Card 1: Supplier / Brand Dealer */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-sage-subtle text-brand-sage border border-brand-sage-border flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text">Supplier / Brand Dealer</h2>
                  <p className="text-[11px] text-muted">Who did you buy these goods from?</p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddDealerModalOpen(true)}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>New Dealer</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Select Supplier / Manufacturer <span className="text-brand-crimson">*</span>
                </label>
                <select
                  value={selectedDealerId}
                  onChange={(e) => handleSelectDealer(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle font-medium text-text focus:outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                >
                  <option value="">-- Choose Brand Supplier / Mandi Workshop --</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.brand_name || d.name} ({d.billing_mode === 'kaccha' ? 'Kaccha Ledger' : 'GST Registered'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Purchase Title / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5x Samsung 55 UHD Smart TVs & 3x Refrigerators"
                  value={purchaseTitle}
                  onChange={(e) => setPurchaseTitle(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                />
              </div>
            </div>

            {/* Selected Dealer Preview Banner */}
            {selectedDealer && (
              <div className="p-3.5 rounded-xl bg-surface-subtle/80 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-text flex items-center gap-2">
                    <span>{selectedDealer.name}</span>
                    <Badge variant={selectedDealer.billing_mode === 'kaccha' ? 'amber' : 'success'} className="text-[10px] uppercase font-bold px-1.5 py-0.2">
                      {selectedDealer.billing_mode === 'kaccha' ? 'Kaccha / Mandi' : 'GST Pakka'}
                    </Badge>
                  </div>
                  <div className="text-muted text-[11px] flex items-center gap-3 flex-wrap">
                    <span>📞 {selectedDealer.phone}</span>
                    {selectedDealer.gstin && <span>GSTIN: <span className="font-mono font-medium">{selectedDealer.gstin}</span></span>}
                    <span>Terms: {selectedDealer.default_credit_days || 30} days credit</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-muted block uppercase font-bold">Outstanding Khata to Give</span>
                  <span className="font-bold text-sm text-brand-crimson">
                    {formatCurrency(selectedDealer.metrics?.totalBalance || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Bill Type & Reference */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-sage-subtle text-brand-sage border border-brand-sage-border flex items-center justify-center">
                <FileText size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text">Bill Type & Invoice Reference</h2>
                <p className="text-[11px] text-muted">Select official GST Tax Invoice or secondary Kaccha/Parchi receipt</p>
              </div>
            </div>

            {/* Bill Type Selector: 2 Big Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setBillType('gst')}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all cursor-pointer relative',
                  billType === 'gst'
                    ? 'border-brand-sage bg-brand-sage/5 shadow-2xs ring-2 ring-brand-sage/20'
                    : 'border-border bg-surface-subtle/40 hover:border-border-strong hover:bg-surface-subtle'
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={billType === 'gst' ? 'text-brand-sage' : 'text-muted'} />
                    <span className="text-xs font-bold text-text">GST Tax Invoice (Pakka)</span>
                  </div>
                  {billType === 'gst' && (
                    <Badge variant="success" className="text-[9px] uppercase font-bold px-1.5 py-0.2">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Official bill with GSTIN & ITC tax credit. Logged in official company purchase registers.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBillType('kaccha')}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all cursor-pointer relative',
                  billType === 'kaccha'
                    ? 'border-amber-500 bg-amber-500/5 shadow-2xs ring-2 ring-amber-500/20'
                    : 'border-border bg-surface-subtle/40 hover:border-border-strong hover:bg-surface-subtle'
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className={billType === 'kaccha' ? 'text-amber-600' : 'text-muted'} />
                    <span className="text-xs font-bold text-text">Kaccha / Parchi / Estimate</span>
                  </div>
                  {billType === 'kaccha' && (
                    <Badge variant="amber" className="text-[9px] uppercase font-bold px-1.5 py-0.2">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Informal workshop slip, local carpenter/artisan parchi, or secondary cash goods intake.
                </p>
              </button>
            </div>

            {/* Bill # and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {billType === 'gst' ? 'Invoice / Bill Number' : 'Parchi / Slip Reference Number'} <span className="text-brand-crimson">*</span>
                </label>
                <input
                  type="text"
                  placeholder={billType === 'gst' ? 'e.g. INV-SAM-2026-9041' : 'e.g. Parchi #042 / Slip #12'}
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  className="w-full h-10 px-3 text-xs font-mono font-medium rounded-xl border border-border bg-surface-subtle text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Goods Received / Bill Date <span className="text-brand-crimson">*</span>
                </label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Items Breakdown or Lump-Sum Total (Default Lump Sum) */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-sage-subtle text-brand-sage border border-brand-sage-border flex items-center justify-center">
                  <Package size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text">Purchased Items & Total Bill Amount</h2>
                  <p className="text-[11px] text-muted">Enter a fast lump-sum total or breakdown itemized line-items</p>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setEntryMode('lumpsum')}
                  className={cn(
                    'px-3 py-1.5 rounded font-semibold text-xs transition-all cursor-pointer',
                    entryMode === 'lumpsum'
                      ? 'bg-surface text-text shadow-2xs font-bold'
                      : 'text-muted hover:text-text'
                  )}
                >
                  Lump Sum Total
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('itemized')}
                  className={cn(
                    'px-3 py-1.5 rounded font-semibold text-xs transition-all cursor-pointer',
                    entryMode === 'itemized'
                      ? 'bg-surface text-text shadow-2xs font-bold'
                      : 'text-muted hover:text-text'
                  )}
                >
                  Itemized List
                </button>
              </div>
            </div>

            {/* Default: Lump Sum Mode */}
            {entryMode === 'lumpsum' ? (
              <div className="py-2 space-y-4">
                <div className="max-w-lg space-y-2">
                  <label className="block text-xs font-semibold text-text">
                    Total Bill Purchase Value (₹) <span className="text-brand-crimson">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold text-lg">₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 199999"
                      value={lumpSumAmount}
                      onChange={(e) => setLumpSumAmount(e.target.value)}
                      className="w-full h-14 pl-9 pr-4 text-xl font-bold font-mono rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                    />
                  </div>
                  <p className="text-[11px] text-muted">
                    Quick lump-sum mode: simply type the total invoice amount as printed on the supplier's bill or slip.
                  </p>
                </div>
              </div>
            ) : (
              /* Itemized Mode */
              <div className="space-y-3">
                <div className="space-y-2.5">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3 rounded-xl border border-border bg-surface-subtle/50 flex flex-col sm:flex-row items-center gap-3"
                    >
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                          Item Description / Model
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Samsung 55 Crystal 4K Smart TV / 7-Seater Teakwood Sofa"
                          value={it.name}
                          onChange={(e) => handleUpdateItemRow(it.id, 'name', e.target.value)}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                        />
                      </div>

                      <div className="w-full sm:w-24">
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItemRow(it.id, 'quantity', e.target.value)}
                          className="w-full h-9 px-2.5 text-xs text-center rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage font-medium"
                        />
                      </div>

                      <div className="w-full sm:w-36">
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                          Unit Rate (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={it.unitPrice}
                          onChange={(e) => handleUpdateItemRow(it.id, 'unitPrice', e.target.value)}
                          className="w-full h-9 px-3 text-xs text-right rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage font-mono font-medium"
                        />
                      </div>

                      <div className="w-full sm:w-36 text-right sm:text-right">
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                          Item Total
                        </label>
                        <span className="font-mono font-bold text-sm text-text block leading-9">
                          {formatCurrency((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))}
                        </span>
                      </div>

                      <div className="sm:pt-5">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(it.id)}
                          className="p-2 text-muted hover:text-brand-crimson transition-colors cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItemRow}
                    className="gap-1.5 text-xs cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Another Item</span>
                  </Button>

                  <div className="text-right">
                    <span className="text-[11px] text-muted block uppercase font-bold">Sum of Items</span>
                    <span className="text-base font-bold text-text font-mono">
                      {formatCurrency(calculatedItemsTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Total Summary Footer Banner */}
            <div className="p-4 rounded-xl bg-brand-sage-subtle/50 border border-brand-sage-border/60 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-sage block">
                  Total Bill Amount to Settle
                </span>
                <span className="text-2xl font-bold font-mono text-text">
                  {formatCurrency(totalBillAmount)}
                </span>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={handleProceedToStep2}
                className="gap-2 text-xs font-bold px-5 py-2.5 shadow-2xs cursor-pointer"
              >
                <span>Continue to Payment & Cheques</span>
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: PAYMENT TERMS & SETTLEMENT SCHEDULE (TIMELINE & MODES)           */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Bill Summary Top Banner */}
          <div className="bg-surface border border-border rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-sage-subtle text-brand-sage border border-brand-sage-border flex items-center justify-center shrink-0">
                <Receipt size={20} />
              </div>
              <div>
                <div className="text-xs font-bold text-text flex items-center gap-2">
                  <span>{selectedDealer?.brand_name || selectedDealer?.name}</span>
                  <Badge variant={billType === 'gst' ? 'success' : 'amber'} className="text-[9px] uppercase font-bold px-1.5 py-0.2">
                    {billType === 'gst' ? 'GST Invoice' : 'Kaccha Parchi'}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted font-mono mt-0.5">
                  #{billNumber} • {formatDate(billDate, false)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted block">Bill Total</span>
                <span className="font-bold text-lg font-mono text-text">
                  {formatCurrency(totalBillAmount)}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(1)}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Edit Goods</span>
              </Button>
            </div>
          </div>

          {/* Card 1: Settlement Mode Selector: Full Payment, Partial Payment, Pay Later */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-text">How are you settling this purchase?</h2>
              <p className="text-[11px] text-muted">
                Choose your settlement structure: Full payment upfront, Partial cash/cheque with balance, or Pay Later on credit.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Option 1: Full Payment */}
              <button
                type="button"
                onClick={() => setSettlementMode('full')}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all cursor-pointer relative',
                  settlementMode === 'full'
                    ? 'border-brand-sage bg-brand-sage/5 shadow-2xs ring-2 ring-brand-sage/20'
                    : 'border-border bg-surface-subtle/40 hover:bg-surface-subtle'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={16} className={settlementMode === 'full' ? 'text-brand-sage' : 'text-muted'} />
                    <span className="text-xs font-bold text-text">Full Payment</span>
                  </div>
                  {settlementMode === 'full' && (
                    <Badge variant="success" className="text-[8px] uppercase font-bold px-1.5 py-0.2">Active</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Settle the entire {formatCurrency(totalBillAmount)} today via Cheque, Cash, Bank Transfer, or UPI. Zero balance remaining.
                </p>
              </button>

              {/* Option 2: Partial Payment */}
              <button
                type="button"
                onClick={() => setSettlementMode('partial')}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all cursor-pointer relative',
                  settlementMode === 'partial'
                    ? 'border-brand-sage bg-brand-sage/5 shadow-2xs ring-2 ring-brand-sage/20'
                    : 'border-border bg-surface-subtle/40 hover:bg-surface-subtle'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Coins size={16} className={settlementMode === 'partial' ? 'text-brand-sage' : 'text-muted'} />
                    <span className="text-xs font-bold text-text">Partial Payment</span>
                  </div>
                  {settlementMode === 'partial' && (
                    <Badge variant="success" className="text-[8px] uppercase font-bold px-1.5 py-0.2">Active</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Pay an advance now (cash or cheques/PDCs) and schedule the remaining balance for a future due date.
                </p>
              </button>

              {/* Option 3: Pay Later */}
              <button
                type="button"
                onClick={() => setSettlementMode('later')}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all cursor-pointer relative',
                  settlementMode === 'later'
                    ? 'border-brand-sage bg-brand-sage/5 shadow-2xs ring-2 ring-brand-sage/20'
                    : 'border-border bg-surface-subtle/40 hover:bg-surface-subtle'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Clock size={16} className={settlementMode === 'later' ? 'text-brand-sage' : 'text-muted'} />
                    <span className="text-xs font-bold text-text">Pay Later (100% Credit)</span>
                  </div>
                  {settlementMode === 'later' && (
                    <Badge variant="success" className="text-[8px] uppercase font-bold px-1.5 py-0.2">Active</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  ₹0 paid today. Entire bill goes directly to the dealer's credit ledger under agreed maturity terms.
                </p>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION A: FULL PAYMENT METHOD DETAILS                                    */}
          {/* ========================================================================= */}
          {settlementMode === 'full' && (
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-border pb-3">
                <h3 className="text-sm font-bold text-text">Select Full Payment Method</h3>
                <p className="text-[11px] text-muted">
                  How are you paying the full amount of {formatCurrency(totalBillAmount)} today?
                </p>
              </div>

              {/* Method Selector Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'cash', label: 'Cash', icon: Coins },
                  { id: 'cheque', label: 'Cheque', icon: Landmark },
                  { id: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS)', icon: Building },
                  { id: 'upi', label: 'UPI / QR', icon: QrCode },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFullPaymentMode(m.id)}
                    className={cn(
                      'p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer',
                      fullPaymentMode === m.id
                        ? 'border-brand-sage bg-brand-sage/5 font-bold text-brand-sage ring-2 ring-brand-sage/20'
                        : 'border-border bg-surface-subtle text-text hover:bg-surface-subtle/80'
                    )}
                  >
                    <m.icon size={18} />
                    <span className="text-xs">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Full Payment Details Inputs */}
              {fullPaymentMode === 'cash' && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Cash Payment Notes / Cash Register Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid in full from shop daily cash drawer"
                    value={fullPaymentNotes}
                    onChange={(e) => setFullPaymentNotes(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                  />
                </div>
              )}

              {fullPaymentMode === 'cheque' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Cheque Number (6-digit)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 401901"
                      value={fullChequeNumber}
                      onChange={(e) => setFullChequeNumber(e.target.value)}
                      className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Cheque / Bank Name
                    </label>
                    <select
                      value={fullChequeBank}
                      onChange={(e) => setFullChequeBank(e.target.value)}
                      className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    >
                      {COMMON_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Date on Cheque
                    </label>
                    <input
                      type="date"
                      value={fullChequeDate}
                      onChange={(e) => setFullChequeDate(e.target.value)}
                      className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    />
                  </div>
                </div>
              )}

              {(fullPaymentMode === 'bank_transfer' || fullPaymentMode === 'upi') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Transaction Ref / UTR / UPI Ref Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR438910291902"
                      value={fullTransactionRef}
                      onChange={(e) => setFullTransactionRef(e.target.value)}
                      className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Transfer Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Transferred via HDFC Corporate NetBanking"
                      value={fullPaymentNotes}
                      onChange={(e) => setFullPaymentNotes(e.target.value)}
                      className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION B: PARTIAL PAYMENT DETAILS (CASH, CHEQUES/PDC, ONLINE)           */}
          {/* ========================================================================= */}
          {settlementMode === 'partial' && (
            <div className="space-y-5">
              {/* Upfront Cash & UPI Section */}
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center justify-center">
                    <Coins size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Upfront Cash / UPI on Delivery (Optional)</h3>
                    <p className="text-[11px] text-muted">Did you pay any immediate cash to the driver or distributor?</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">
                      Cash Paid Today (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0 (None)"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="w-full h-10 pl-8 pr-3 text-xs font-mono font-medium rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">
                      Cash Note / Receipt Slip
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paid in cash to tempo driver upon unloading"
                      value={cashNotes}
                      onChange={(e) => setCashNotes(e.target.value)}
                      className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-border/60">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">
                      Immediate Online / UPI Transfer (₹) (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0 (None)"
                        value={onlineAmount}
                        onChange={(e) => setOnlineAmount(e.target.value)}
                        className="w-full h-10 pl-8 pr-3 text-xs font-mono font-medium rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">
                      UPI Ref / Transaction UTR
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UPI/40291902910"
                      value={onlineRef}
                      onChange={(e) => setOnlineRef(e.target.value)}
                      className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    />
                  </div>
                </div>
              </div>

              {/* Cheques & Post-Dated Cheques (PDC Schedule) */}
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-700 border border-blue-500/20 flex items-center justify-center">
                      <Landmark size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text">Cheques & Post-Dated Cheques (PDCs)</h3>
                      <p className="text-[11px] text-muted">
                        Record cheques handed over to dealer, including future PDC clearing dates.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddChequeRow}
                    className="gap-1.5 text-xs cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Cheque / PDC</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  {cheques.map((chq, idx) => {
                    const isPdc = chq.chequeDate && chq.chequeDate > billDate;
                    return (
                      <div
                        key={chq.id}
                        className="p-4 rounded-xl border border-border bg-surface-subtle/60 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-text">Cheque #{idx + 1}</span>
                            {isPdc ? (
                              <Badge variant="blue" className="text-[9px] uppercase font-bold px-1.5 py-0.2">
                                PDC (Post-Dated Cheque)
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[9px] uppercase font-bold px-1.5 py-0.2">
                                Current Cheque
                              </Badge>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveChequeRow(chq.id)}
                            className="p-1 text-muted hover:text-brand-crimson transition-colors cursor-pointer"
                            title="Remove cheque"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                              Cheque Amount (₹) <span className="text-brand-crimson">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted font-bold text-xs">₹</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={chq.amount}
                                onChange={(e) => handleUpdateChequeRow(chq.id, 'amount', e.target.value)}
                                className="w-full h-9 pl-7 pr-2.5 text-xs font-mono font-medium rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                              Cheque Number (6-digit)
                            </label>
                            <input
                              type="text"
                              maxLength="10"
                              placeholder="e.g. 401901"
                              value={chq.chequeNumber}
                              onChange={(e) => handleUpdateChequeRow(chq.id, 'chequeNumber', e.target.value)}
                              className="w-full h-9 px-2.5 text-xs font-mono rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                              Cheque / Bank Name
                            </label>
                            <select
                              value={chq.bankName}
                              onChange={(e) => handleUpdateChequeRow(chq.id, 'bankName', e.target.value)}
                              className="w-full h-9 px-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                            >
                              {COMMON_BANKS.map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                              Clearing Date (Date on Cheque)
                            </label>
                            <input
                              type="date"
                              value={chq.chequeDate}
                              onChange={(e) => handleUpdateChequeRow(chq.id, 'chequeDate', e.target.value)}
                              className="w-full h-9 px-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                            />
                          </div>
                        </div>

                        {chq.bankName === 'Other Bank' && (
                          <div>
                            <input
                              type="text"
                              placeholder="Enter custom bank name..."
                              value={chq.customBankName}
                              onChange={(e) => handleUpdateChequeRow(chq.id, 'customBankName', e.target.value)}
                              className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-surface text-text"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION C: CREDIT TERMS & DUE REMINDER SCHEDULE (PARTIAL & PAY LATER)     */}
          {/* ========================================================================= */}
          {(settlementMode === 'partial' || settlementMode === 'later') && (
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">
                    Remaining Balance & Payment Reminder Schedule
                  </h3>
                  <p className="text-[11px] text-muted">
                    When do you have to give the remaining money to the dealer?
                  </p>
                </div>
              </div>

              {/* Quick Credit Days Pills */}
              <div>
                <label className="block text-xs font-semibold text-text mb-2">
                  Agreed Credit Period (Days to Clear Balance)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { days: 7, label: '7 Days' },
                    { days: 15, label: '15 Days' },
                    { days: 21, label: '21 Days' },
                    { days: 30, label: '30 Days (Standard)' },
                    { days: 45, label: '45 Days' },
                    { days: 60, label: '60 Days' },
                  ].map((item) => (
                    <button
                      key={item.days}
                      type="button"
                      onClick={() => {
                        setCreditDays(item.days);
                        setCustomDueDate('');
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                        creditDays === item.days && !customDueDate
                          ? 'bg-brand-sage text-white shadow-2xs'
                          : 'bg-surface-subtle border border-border text-text hover:bg-surface-subtle/80'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Calculated Due / Reminder Date
                  </label>
                  <input
                    type="date"
                    value={computedDueDate}
                    onChange={(e) => setCustomDueDate(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                  />
                  <span className="text-[11px] text-muted mt-1 block">
                    🔔 Payment reminder alert will trigger on {formatDate(computedDueDate, false)}.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Store Promise / Settlement Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Promised balance via RTGS after showroom weekend sales"
                    value={promiseNotes}
                    onChange={(e) => setPromiseNotes(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-subtle text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION D: VISUAL SETTLEMENT & CLEARING TIMELINE (PROPER WAY)             */}
          {/* ========================================================================= */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-brand-sage" />
                <h3 className="text-sm font-bold text-text">Settlement & Clearing Timeline</h3>
              </div>
              <span className="text-[11px] text-muted font-medium">
                {timelineSchedule.length} scheduled milestones
              </span>
            </div>

            <div className="relative pl-6 space-y-3.5 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {timelineSchedule.map((ev) => {
                const IconComponent = ev.icon;
                return (
                  <div key={ev.id} className="relative flex items-start gap-3">
                    <div
                      className={cn(
                        'absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-2xs',
                        ev.color
                      )}
                    >
                      <IconComponent size={11} />
                    </div>

                    <div className="w-full p-3 rounded-xl border border-border bg-surface-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-text">{ev.title}</span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-surface border border-border text-muted">
                            {ev.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">{ev.subtitle}</p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <div className="font-mono font-bold text-text text-sm">
                          {formatCurrency(ev.amount)}
                        </div>
                        <div className="text-[10px] text-muted font-medium flex items-center gap-1 sm:justify-end">
                          <Calendar size={11} />
                          <span>{formatDate(ev.date, false)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION E: RECONCILIATION SUMMARY & SUBMISSION                             */}
          {/* ========================================================================= */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              Settlement & Reconciliation Overview
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-subtle border border-border">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Total Bill Cost</span>
                <span className="font-bold text-base font-mono text-text">
                  {formatCurrency(totalBillAmount)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Paid / Committed</span>
                <span className="font-bold text-base font-mono text-emerald-700">
                  {formatCurrency(totalCommittedPaid)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Remaining to Give</span>
                <span className={cn(
                  'font-bold text-base font-mono',
                  remainingBalance > 0 ? 'text-brand-crimson' : 'text-emerald-700'
                )}>
                  {formatCurrency(remainingBalance)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Payment Status</span>
                <Badge
                  variant={
                    remainingBalance === 0
                      ? 'success'
                      : totalCommittedPaid > 0
                      ? 'amber'
                      : 'danger'
                  }
                  className="text-[10px] uppercase font-bold px-2 py-0.5 mt-1"
                >
                  {remainingBalance === 0
                    ? 'Fully Settled'
                    : totalCommittedPaid > 0
                    ? 'Partially Paid'
                    : 'Unpaid on Credit'}
                </Badge>
              </div>
            </div>

            {/* Final Submission Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="gap-1.5 text-xs w-full sm:w-auto cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Step 1</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={handleSavePurchase}
                disabled={isSubmitting}
                className="gap-2 text-xs font-bold px-6 py-3 w-full sm:w-auto shadow-2xs cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Recording Purchase & Schedule...</span>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Record Purchase & Save Payments</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Dealer Modal */}
      <AddDealerModal
        isOpen={isAddDealerModalOpen}
        onClose={() => setIsAddDealerModalOpen(false)}
        storeId={storeId}
        onSuccess={(newDealer) => {
          if (newDealer?.id) {
            handleSelectDealer(newDealer.id, newDealer);
          }
          setIsAddDealerModalOpen(false);
        }}
      />
    </div>
  );
}
