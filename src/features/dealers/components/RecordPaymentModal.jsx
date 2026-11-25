import { useState, useMemo } from 'react';
import { Modal } from '@/shared/ui';
import { useRecordDealerPayment, useDealerBills } from '../hooks/useDealers';
import { formatCurrency, formatDate, formatPhone } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import {
  CreditCard,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Coins,
  Banknote,
  QrCode,
  Landmark,
} from 'lucide-react';

export function RecordPaymentModal(props) {
  if (!props.isOpen) return null;
  const modalKey = `${props.preselectedBill?.id || 'none'}-${props.preselectedDealer?.id || 'none'}`;
  return <RecordPaymentModalContent key={modalKey} {...props} />;
}

function RecordPaymentModalContent({
  isOpen,
  onClose,
  dealers = [],
  preselectedDealer = null,
  preselectedBill = null,
  storeId,
}) {
  const recordPaymentMutation = useRecordDealerPayment();

  const isSpecificBill = Boolean(preselectedBill);

  const [dealerId, setDealerId] = useState(
    () => preselectedBill?.dealer_id || preselectedBill?.dealer?.id || preselectedDealer?.id || dealers[0]?.id || ''
  );
  const [billId, setBillId] = useState(() => preselectedBill?.id || '');

  // Settlement Type: 'full' | 'partial'
  const [settlementType, setSettlementType] = useState('full');
  const [paymentAmount, setPaymentAmount] = useState(() => {
    const bal = Number(preselectedBill?.balance_amount || 0);
    return bal > 0 ? String(bal) : '';
  });

  // Payment Instrument: 'cheque' | 'cash' | 'upi' | 'bank_transfer'
  const [paymentMode, setPaymentMode] = useState(
    () => (preselectedBill?.bill_type === 'kaccha' ? 'cash' : 'cheque')
  );
  const [paymentChannel, setPaymentChannel] = useState(
    () => (preselectedBill?.bill_type === 'kaccha' ? 'secondary_cash' : 'official_bank')
  );

  // Instrument Details
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [chequeBank, setChequeBank] = useState('');
  const [transactionRef, setTransactionRef] = useState('');

  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch active pending bills for selected dealer (for general payments)
  const { data: bills = [] } = useDealerBills({
    dealerId: dealerId || undefined,
  });

  const unpaidBills = useMemo(() => {
    return bills.filter((b) => b.status !== 'paid' && Number(b.balance_amount) > 0);
  }, [bills]);

  const brandDirectDealers = useMemo(() => {
    return dealers.filter((d) => d.dealer_type === 'brand_direct');
  }, [dealers]);

  const otherDealers = useMemo(() => {
    return dealers.filter((d) => d.dealer_type !== 'brand_direct');
  }, [dealers]);

  const selectedBill = useMemo(() => {
    if (preselectedBill && (!billId || billId === preselectedBill.id)) {
      return preselectedBill;
    }
    return bills.find((b) => b.id === billId) || preselectedBill;
  }, [bills, billId, preselectedBill]);

  // Live Auto-Balance Calculation Preview
  const balancePreview = useMemo(() => {
    if (!selectedBill) return null;

    const totalBill = Number(selectedBill.total_amount || 0);
    const previouslyPaid = Number(selectedBill.paid_amount || 0);
    const currentOutstanding = Number(selectedBill.balance_amount || 0);

    const enteredPayment = parseFloat(paymentAmount || '0');
    const validPayment = isNaN(enteredPayment) ? 0 : enteredPayment;

    const newBalance = Math.max(0, currentOutstanding - validPayment);
    const newPaid = previouslyPaid + validPayment;

    let newStatus = 'unpaid';
    if (newPaid >= totalBill && totalBill > 0) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partially_paid';
    }

    return {
      totalBill,
      previouslyPaid,
      currentOutstanding,
      payment: validPayment,
      newBalance,
      newPaid,
      newStatus,
      isOverpaying: validPayment > currentOutstanding + 0.01,
    };
  }, [selectedBill, paymentAmount]);

  function handleSelectSettlementType(type) {
    setSettlementType(type);
    if (!selectedBill) return;

    const outstanding = Number(selectedBill.balance_amount || 0);
    if (type === 'full') {
      setPaymentAmount(outstanding > 0 ? String(outstanding) : '');
    } else {
      const half = Math.round(outstanding / 2);
      setPaymentAmount(half > 0 ? String(half) : '');
    }
  }

  function handleCloseModal() {
    setPaymentAmount('');
    setTransactionRef('');
    setChequeNumber('');
    setChequeBank('');
    setNotes('');
    setErrorMsg('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!dealerId) {
      setErrorMsg('Please select a dealer.');
      return;
    }

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (paymentMode === 'cheque') {
      if (!chequeNumber.trim()) {
        setErrorMsg('Cheque / Check Number is mandatory for cheque payment.');
        return;
      }
      if (!chequeDate) {
        setErrorMsg('Cheque Date is mandatory.');
        return;
      }
    }

    const effectiveRef =
      paymentMode === 'cheque'
        ? chequeNumber.trim()
        : transactionRef.trim() || null;

    let combinedNotes = notes.trim() || null;
    if (paymentMode === 'cheque' && chequeBank.trim()) {
      combinedNotes = combinedNotes
        ? `${combinedNotes} · Bank: ${chequeBank.trim()}`
        : `Bank: ${chequeBank.trim()}`;
    }

    try {
      await recordPaymentMutation.mutateAsync({
        dealer_id: dealerId,
        bill_id: billId || null,
        store_id: storeId || null,
        amount: amountNum,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        payment_channel: paymentChannel,
        transaction_ref: effectiveRef,
        cheque_date: paymentMode === 'cheque' ? chequeDate : null,
        notes: combinedNotes,
      });

      handleCloseModal();
    } catch (err) {
      console.error('Failed to record payment:', err);
      setErrorMsg(err.message || 'Error recording payment. Please check details.');
    }
  }

  const modalTitle = isSpecificBill && selectedBill
    ? `Pay Bill — #${selectedBill.bill_number}`
    : 'Record Supplier Payment';

  const enteredAmountNum = parseFloat(paymentAmount) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title={modalTitle}
      size="lg"
      className="max-h-[90vh] flex flex-col overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        {/* Scrollable Form Body */}
        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-brand-crimson-subtle border border-brand-crimson-border text-xs text-brand-crimson font-medium">
              {errorMsg}
            </div>
          )}

          {/* 1. Target Bill Overview Card (if paying specific bill) */}
          {isSpecificBill && selectedBill ? (
            <div className="p-3.5 rounded-xl border border-border bg-surface-subtle text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={15} className="text-brand-sage shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-text text-sm">
                      {selectedBill.dealer?.name ||
                        selectedBill.dealer?.brand_name ||
                        preselectedDealer?.name ||
                        preselectedDealer?.brand_name}
                    </span>
                    {(selectedBill.dealer?.phone || preselectedDealer?.phone) && (
                      <span className="text-muted text-xs ml-1.5 font-mono">
                        ({formatPhone(selectedBill.dealer?.phone || preselectedDealer?.phone)})
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0',
                    selectedBill.bill_type === 'gst'
                      ? 'bg-brand-sage-subtle text-brand-sage border-brand-sage-border'
                      : 'bg-brand-gold-subtle text-brand-gold-text border-brand-gold-border'
                  )}
                >
                  {selectedBill.bill_type === 'gst' ? 'GST Invoice' : 'Kaccha Slip'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/70 text-center">
                <div className="p-2 rounded-lg bg-surface border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted block mb-0.5">
                    Bill Total
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-bold text-text">
                    {formatCurrency(balancePreview?.totalBill || selectedBill.total_amount || 0)}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-surface border border-brand-sage-border/60">
                  <span className="text-[10px] uppercase font-bold text-brand-sage block mb-0.5">
                    Paid So Far
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-bold text-brand-sage">
                    {formatCurrency(balancePreview?.previouslyPaid || selectedBill.paid_amount || 0)}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-surface border border-brand-gold-border">
                  <span className="text-[10px] uppercase font-bold text-brand-gold-text block mb-0.5">
                    Outstanding Due
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-bold text-brand-crimson">
                    {formatCurrency(balancePreview?.currentOutstanding || selectedBill.balance_amount || 0)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* 2. Generic payment: choose supplier & bill */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Supplier / Brand Dealer <span className="text-brand-crimson">*</span>
                </label>
                <select
                  value={dealerId}
                  onChange={(e) => {
                    setDealerId(e.target.value);
                    setBillId('');
                    setPaymentAmount('');
                  }}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text font-medium focus:outline-none focus:ring-1 focus:ring-brand-sage"
                >
                  <option value="">-- Choose Brand / Dealer --</option>
                  {brandDirectDealers.length > 0 && (
                    <optgroup label="Direct OEM Brands">
                      {brandDirectDealers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || d.brand_name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherDealers.length > 0 && (
                    <optgroup label="Distributors & Wholesalers">
                      {otherDealers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || d.brand_name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {brandDirectDealers.length === 0 && otherDealers.length === 0 && dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.brand_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Purchase Bill Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-text flex items-center gap-1.5">
                    <FileText size={14} className="text-brand-sage" />
                    <span>Select Bill to Settle</span>
                  </label>
                  <span className="text-[11px] text-muted font-medium">
                    {unpaidBills.length} open {unpaidBills.length === 1 ? 'bill' : 'bills'}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-2xs">
                  {/* General On-Account Option */}
                  <div
                    onClick={() => setBillId('')}
                    className={cn(
                      'px-3.5 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between border-b border-border',
                      billId === ''
                        ? 'bg-brand-sage-subtle text-text font-medium'
                        : 'bg-surface hover:bg-surface-subtle text-muted hover:text-text'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all',
                          billId === ''
                            ? 'border-brand-sage bg-brand-sage text-white'
                            : 'border-border bg-surface'
                        )}
                      >
                        {billId === '' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-text">
                          General Lump-Sum / On-Account Payment
                        </div>
                        <div className="text-[11px] text-muted">
                          Unallocated payment credited to supplier khata ledger
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded border border-border bg-surface-subtle text-muted shrink-0">
                      On-Account
                    </span>
                  </div>

                  {/* Open Bills Scrollable List */}
                  {unpaidBills.length > 0 && (
                    <div className="divide-y divide-border/60 max-h-36 overflow-y-auto">
                      {unpaidBills.map((b) => {
                        const isSelected = billId === b.id;
                        return (
                          <div
                            key={b.id}
                            onClick={() => {
                              setBillId(b.id);
                              setPaymentAmount(String(b.balance_amount || ''));
                              setSettlementType('full');
                              setPaymentChannel(b.bill_type === 'kaccha' ? 'secondary_cash' : 'official_bank');
                            }}
                            className={cn(
                              'px-3.5 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between',
                              isSelected
                                ? 'bg-brand-sage-subtle text-text font-medium'
                                : 'bg-surface hover:bg-surface-subtle text-text'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div
                                className={cn(
                                  'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all',
                                  isSelected
                                    ? 'border-brand-sage bg-brand-sage text-white'
                                    : 'border-border bg-surface'
                                )}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>

                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-xs text-text">
                                    #{b.bill_number}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0',
                                      b.bill_type === 'gst'
                                        ? 'bg-brand-sage-subtle text-brand-sage border-brand-sage-border'
                                        : 'bg-brand-gold-subtle text-brand-gold-text border-brand-gold-border'
                                    )}
                                  >
                                    {b.bill_type === 'gst' ? 'GST' : 'Kaccha'}
                                  </span>
                                  {b.bill_date && (
                                    <span className="text-[11px] text-muted">
                                      • {formatDate(b.bill_date, false)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 pl-2">
                              <div className="font-mono font-bold text-xs text-brand-crimson">
                                Due: {formatCurrency(b.balance_amount)}
                              </div>
                              <div className="text-[10px] font-mono text-muted">
                                Total: {formatCurrency(b.total_amount)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. Settlement Type Options (Full vs Partial) */}
          {selectedBill && Number(selectedBill.balance_amount || 0) > 0 ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Settlement Option <span className="text-brand-crimson">*</span>
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Full Payment */}
                  <button
                    type="button"
                    onClick={() => handleSelectSettlementType('full')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                      settlementType === 'full'
                        ? 'border-brand-sage bg-brand-sage-subtle ring-1 ring-brand-sage text-text'
                        : 'border-border bg-surface text-muted hover:bg-surface-subtle'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text">
                        <CheckCircle2 size={15} className="text-brand-sage" />
                        <span>Full Payment</span>
                      </div>
                      {settlementType === 'full' && (
                        <span className="text-[10px] font-bold text-brand-sage uppercase bg-brand-sage-border/40 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted leading-tight">
                      Clear 100% outstanding balance ({formatCurrency(selectedBill.balance_amount)}).
                    </div>
                  </button>

                  {/* Partial Payment */}
                  <button
                    type="button"
                    onClick={() => handleSelectSettlementType('partial')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                      settlementType === 'partial'
                        ? 'border-brand-sage bg-brand-sage-subtle ring-1 ring-brand-sage text-text'
                        : 'border-border bg-surface text-muted hover:bg-surface-subtle'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text">
                        <Coins size={15} className="text-brand-sage" />
                        <span>Partial Payment</span>
                      </div>
                      {settlementType === 'partial' && (
                        <span className="text-[10px] font-bold text-brand-sage uppercase bg-brand-sage-border/40 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted leading-tight">
                      Pay custom amount now; remaining balance stays on credit.
                    </div>
                  </button>
                </div>
              </div>

              {/* Settlement Content based on selected mode */}
              {settlementType === 'full' ? (
                /* Sleek compact full settlement banner (no redundant bloated inputs) */
                <div className="px-3.5 py-2.5 rounded-xl border border-brand-sage-border bg-brand-sage-subtle/70 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-brand-sage shrink-0" />
                    <div>
                      <span className="text-text font-medium">
                        Settling full balance of{' '}
                        <strong className="font-mono font-bold text-text">
                          {formatCurrency(selectedBill.balance_amount)}
                        </strong>
                      </span>
                      <span className="text-[11px] text-brand-sage block font-medium">
                        Bill will be marked Fully Paid upon recording.
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-brand-sage shrink-0 bg-surface px-2.5 py-1 rounded-md border border-brand-sage-border">
                    New Balance: ₹0
                  </span>
                </div>
              ) : (
                /* Partial payment input with live remainder preview */
                <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-text">
                      Partial Amount to Pay (₹) <span className="text-brand-crimson">*</span>
                    </label>
                    <span className="text-[11px] text-muted">
                      Total Due: <strong className="font-mono text-text">{formatCurrency(selectedBill.balance_amount)}</strong>
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={selectedBill.balance_amount}
                      required
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-base font-bold font-mono rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                    />
                  </div>

                  {/* Quick percentage shortcuts */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted uppercase font-bold mr-1">Quick:</span>
                    {[0.25, 0.5, 0.75].map((pct) => {
                      const amt = Math.round(Number(selectedBill.balance_amount || 0) * pct);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPaymentAmount(String(amt))}
                          className="px-2 py-0.5 text-[11px] font-mono rounded border border-border bg-surface-subtle hover:bg-surface text-muted hover:text-text cursor-pointer transition-colors"
                        >
                          {pct * 100}% ({formatCurrency(amt)})
                        </button>
                      );
                    })}
                  </div>

                  {/* Live balance calculation preview */}
                  {balancePreview && (
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                      <span className="text-muted">Remaining Balance After Payment:</span>
                      <span
                        className={cn(
                          'font-mono font-bold',
                          balancePreview.newBalance === 0 ? 'text-brand-sage' : 'text-brand-crimson'
                        )}
                      >
                        {formatCurrency(balancePreview.newBalance)}
                      </span>
                    </div>
                  )}

                  {balancePreview?.isOverpaying && (
                    <div className="text-[11px] text-brand-crimson font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      Amount exceeds outstanding bill balance.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Standalone amount input for on-account payments */
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Payment Amount (₹) <span className="text-brand-crimson">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-base font-bold font-mono rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                />
              </div>
            </div>
          )}

          {/* 3. Payment Method / Instrument Card */}
          <div className="space-y-3 p-3.5 rounded-xl border border-border bg-surface shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                <CreditCard size={15} className="text-brand-sage" />
                <span>Payment Instrument / Method</span>
              </label>

              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-surface-subtle border border-border text-muted">
                Channel: {paymentChannel === 'official_bank' ? 'Official Bank' : 'Secondary Cash'}
              </span>
            </div>

            {/* 4 Clean Instrument Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'cheque', label: 'Cheque', icon: Building2 },
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'upi', label: 'UPI / QR', icon: QrCode },
                { id: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMode(m.id)}
                    className={cn(
                      'p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2',
                      isSelected
                        ? 'border-brand-sage bg-brand-sage-subtle text-text ring-1 ring-brand-sage font-bold'
                        : 'border-border bg-surface text-muted hover:bg-surface-subtle font-medium'
                    )}
                  >
                    <Icon size={15} className={isSelected ? 'text-brand-sage' : 'text-muted'} />
                    <span className="text-xs">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Conditional Instrument Details */}
            {paymentMode === 'cheque' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 border-t border-border/70">
                <div>
                  <label className="block text-[11px] font-semibold text-text mb-1">
                    Cheque / Check No. <span className="text-brand-crimson">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 049281"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text mb-1">
                    Cheque Date <span className="text-brand-crimson">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text mb-1">
                    Bank Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC / SBI"
                    value={chequeBank}
                    onChange={(e) => setChequeBank(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                  />
                </div>
              </div>
            )}

            {paymentMode === 'cash' && (
              <div className="pt-2.5 border-t border-border/70">
                <label className="block text-[11px] font-semibold text-text mb-1">
                  Cash Receipt / Voucher Memo (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash Memo No. 0981 or Counter Cash Voucher"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                />
              </div>
            )}

            {(paymentMode === 'upi' || paymentMode === 'bank_transfer') && (
              <div className="pt-2.5 border-t border-border/70">
                <label className="block text-[11px] font-semibold text-text mb-1">
                  {paymentMode === 'upi' ? 'UPI Reference / UTR Number' : 'Bank UTR / Transaction Ref'}
                </label>
                <input
                  type="text"
                  placeholder={
                    paymentMode === 'upi'
                      ? 'e.g. UPI/629103810291'
                      : 'e.g. UTR / NEFT Reference Number'
                  }
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                />
              </div>
            )}
          </div>

          {/* 4. Payout Channel Isolation & Payment Date in 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Payout Channel (Two-Book Separation)
              </label>
              <select
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
              >
                <option value="official_bank">Official Bank Account (GST Compliant)</option>
                <option value="secondary_cash">Cash / Secondary Account (Kaccha Khata)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Payment Date <span className="text-brand-crimson">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
              />
            </div>
          </div>

          {/* 5. Payment Notes */}
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Payment Notes / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Tranche settlement, cleared by Danish"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
            />
          </div>
        </div>

        {/* Pinned Sticky Footer - Always Visible */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-border bg-surface shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-muted truncate hidden sm:block">
            {enteredAmountNum > 0 ? (
              <span>
                Recording <strong className="font-mono text-text font-bold">{formatCurrency(enteredAmountNum)}</strong> via{' '}
                <span className="capitalize">{paymentMode.replace('_', ' ')}</span>
              </span>
            ) : (
              <span>Enter payment details above</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-text hover:bg-surface-subtle transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPaymentMutation.isPending || enteredAmountNum <= 0}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-accent-fg hover:bg-accent/90 active:scale-[0.99] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {recordPaymentMutation.isPending
                ? 'Recording Payment...'
                : enteredAmountNum > 0
                ? `Confirm Payment (${formatCurrency(enteredAmountNum)})`
                : 'Record Payment'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
