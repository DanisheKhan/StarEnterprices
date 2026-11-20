import { useState, useMemo, useRef, useEffect } from 'react';
import { useOutletContext, useNavigate, useParams, Link } from 'react-router-dom';
import {
  Button,
  Badge,
  Card,
} from '@/shared/ui';
import { useProducts } from '@/features/inventory';
import {
  useDealers,
  useCreateDealerBill,
} from '../hooks/useDealers';
import { AddDealerModal } from '../components/AddDealerModal';
import { formatCurrency, formatDate, formatPhone } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import {
  Package,
  Building2,
  Banknote,
  Check,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Barcode,
  FileText,
  Layers,
  Sparkles,
  Clock,
  CheckCircle2,
  Coins,
  CreditCard,
  QrCode,
  Landmark,
  RotateCcw,
  AlertCircle,
  Building,
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Products & Intake', shortLabel: 'Products', icon: Package },
  { id: 2, label: 'Supplier & Invoice', shortLabel: 'Supplier', icon: Building2 },
  { id: 3, label: 'Payment & Settlement', shortLabel: 'Settlement', icon: Banknote },
];

function ProductThumbnail({ imageUrl, sku, name }) {
  const [error, setError] = useState(false);

  if (imageUrl && !error) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className="w-full h-full object-contain p-0.5 group-hover:opacity-90 transition-opacity duration-200"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className="flex items-center justify-center text-muted w-full h-full">
      <Package size={18} className="text-muted/60 stroke-[1.5]" />
    </div>
  );
}

const createCustomItem = () => ({
  id: Date.now() + Math.random(),
  name: '',
  quantity: 1,
  gstRate: 18,
  unitPrice: '',
  isCustom: true,
});

export function PurchaseBillingPage() {
  const { store, storeCode: outletStoreCode } = useOutletContext() || {};
  const { storeCode: paramStoreCode } = useParams();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const effectiveStoreCode = paramStoreCode || outletStoreCode || store?.code || 'furniture-electronics';
  const storeId = store?.id || null;

  // Stepper state: 1: Products & Intake, 2: Supplier & Invoice, 3: Payment & Settlement
  const [currentStep, setCurrentStep] = useState(1);

  // Data queries
  const { data: storeProducts = [], isLoading: isProductsLoading } = useProducts(storeId, {});
  const { data: dealers = [], isLoading: isDealersLoading } = useDealers({ storeId });
  const createBillMutation = useCreateDealerBill();

  // Search & Catalog Filter State (Step 1)
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Active Bill Items Cart
  const [cart, setCart] = useState([createCustomItem()]);
  const [taxJurisdiction, setTaxJurisdiction] = useState('intra'); // 'intra' (CGST+SGST) | 'inter' (IGST)

  // Step 2: Supplier & Invoice State
  const [billType, setBillType] = useState('gst'); // 'gst' | 'kaccha'
  const [dealerId, setDealerId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditDays, setCreditDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [isAddDealerOpen, setIsAddDealerOpen] = useState(false);

  // Step 3: Payment Tender State: 'fully_paid' | 'partially_paid' | 'unpaid'
  const [settlementType, setSettlementType] = useState('fully_paid');
  const [partialPaidAmount, setPartialPaidAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('cheque'); // 'cash' | 'cheque' | 'bank_transfer' | 'upi'

  // Instrument details
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [chequeBank, setChequeBank] = useState('');
  const [transactionRef, setTransactionRef] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  // Extract categories for filter tabs
  const categories = useMemo(() => {
    const map = new Map();
    storeProducts.forEach((p) => {
      if (p.categories?.name) {
        const catId = p.categories.id || p.categories.name;
        const existing = map.get(catId);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(catId, { id: catId, name: p.categories.name, count: 1 });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [storeProducts]);

  // Catalog filtered products
  const displayItems = useMemo(() => {
    return storeProducts.filter((p) => {
      if (selectedCategory !== 'all') {
        const matchCat =
          p.categories?.id === selectedCategory || p.categories?.name === selectedCategory;
        if (!matchCat) return false;
      }
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.brands?.name?.toLowerCase().includes(q) ||
        p.categories?.name?.toLowerCase().includes(q)
      );
    });
  }, [storeProducts, search, selectedCategory]);

  // Selected Dealer Object
  const selectedDealer = useMemo(() => {
    return dealers.find((d) => d.id === dealerId) || null;
  }, [dealers, dealerId]);

  // Auto-fill default dealer if available and not selected
  useEffect(() => {
    if (dealers.length > 0 && !dealerId) {
      const defaultD = dealers[0];
      setDealerId(defaultD.id);
      if (defaultD.default_credit_days) {
        setCreditDays(defaultD.default_credit_days);
      }
      if (defaultD.billing_mode === 'kaccha') {
        setBillType('kaccha');
      }
    }
  }, [dealers, dealerId]);

  // Auto-generate Bill / Parchi Number
  function generateSmartBillNumber(targetType = billType, targetDealerId = dealerId) {
    const year = new Date(billDate || new Date()).getFullYear();
    const randSuffix = Math.floor(100 + Math.random() * 900);

    if (targetType === 'kaccha') {
      return `EST-${year}-${randSuffix}`;
    }

    const d = dealers.find((item) => item.id === targetDealerId);
    let brandPrefix = 'INV';
    if (d) {
      const rawBrand = (d.brand_name || d.name || '')
        .split(' ')[0]
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
      if (rawBrand.length >= 2) {
        brandPrefix = rawBrand.slice(0, 8);
      }
    }

    return `${brandPrefix}/${year}/${randSuffix}`;
  }

  // Generate initial bill number once dealer is known
  useEffect(() => {
    if (!billNumber && dealerId) {
      setBillNumber(generateSmartBillNumber(billType, dealerId));
    }
  }, [dealerId, billType]);

  function handleAutoGenerateNumber() {
    setBillNumber(generateSmartBillNumber());
  }

  function handleSelectBillType(type) {
    setBillType(type);
    if (!billNumber || billNumber.startsWith('EST-') || billNumber.includes('/')) {
      setBillNumber(generateSmartBillNumber(type, dealerId));
    }
  }

  // Dynamic Due Date computation
  const computedDueDate = useMemo(() => {
    if (!billDate) return '';
    const d = new Date(billDate);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Number(creditDays || 0));
    return d.toISOString().split('T')[0];
  }, [billDate, creditDays]);

  // Cart operations
  function handleAddCatalogProduct(prod) {
    setCart((prev) => {
      const hasOnlyEmptyRow =
        prev.length === 1 && !prev[0].name.trim() && !prev[0].unitPrice;
      const newItem = {
        id: Date.now() + Math.random(),
        product_id: prod.id,
        name: prod.name,
        sku: prod.sku,
        category: prod.categories?.name,
        quantity: 1,
        gstRate: prod.gst_rate != null ? Number(prod.gst_rate) : 18,
        unitPrice: String(prod.cost_price || prod.selling_price || ''),
        isCustom: false,
      };

      if (hasOnlyEmptyRow) {
        return [newItem];
      }
      return [...prev, newItem];
    });
    setSearch('');
  }

  function handleAddCustomRow() {
    setCart((prev) => [...prev, createCustomItem()]);
  }

  function handleRemoveItem(id) {
    setCart((prev) => {
      const filtered = prev.filter((it) => it.id !== id);
      return filtered.length === 0 ? [createCustomItem()] : filtered;
    });
  }

  function handleItemChange(id, field, value) {
    setCart((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return { ...it, [field]: value };
      })
    );
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = search.trim().toLowerCase();
      if (!q) return;

      const exact = storeProducts.find(
        (p) => p.sku?.toLowerCase() === q || p.name?.toLowerCase() === q
      );
      const target = exact || (displayItems.length === 1 ? displayItems[0] : null);

      if (target) {
        handleAddCatalogProduct(target);
      } else {
        setCart((prev) => [
          ...prev.filter((it) => it.name.trim() || it.unitPrice),
          {
            id: Date.now() + Math.random(),
            name: search.trim(),
            quantity: 1,
            gstRate: 18,
            unitPrice: '',
            isCustom: true,
          },
        ]);
        setSearch('');
      }
    }
  }

  // -------------------------------------------------------------
  // FINANCIAL TOTALS & TAX ENGINE
  // -------------------------------------------------------------
  const itemsSubtotal = useMemo(() => {
    return cart.reduce((sum, it) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const p = Math.max(0, Number(it.unitPrice) || 0);
      return sum + q * p;
    }, 0);
  }, [cart]);

  const itemsTaxTotal = useMemo(() => {
    if (billType === 'kaccha') return 0;
    return cart.reduce((sum, it) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const p = Math.max(0, Number(it.unitPrice) || 0);
      const rate = Number(it.gstRate ?? 18) || 0;
      return sum + q * p * (rate / 100);
    }, 0);
  }, [cart, billType]);

  const grandTotal = useMemo(() => {
    return Math.round(itemsSubtotal + itemsTaxTotal);
  }, [itemsSubtotal, itemsTaxTotal]);

  const validCartItems = useMemo(() => {
    return cart.filter((it) => it.name && it.name.trim());
  }, [cart]);

  const totalUnits = useMemo(() => {
    return validCartItems.reduce((sum, it) => sum + Math.max(0, Number(it.quantity) || 0), 0);
  }, [validCartItems]);

  // Tax Breakdown
  const taxBreakdown = useMemo(() => {
    if (billType === 'kaccha' || itemsTaxTotal === 0) {
      return {
        taxable: itemsSubtotal,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
      };
    }

    if (taxJurisdiction === 'inter') {
      return {
        taxable: Math.round(itemsSubtotal * 100) / 100,
        cgst: 0,
        sgst: 0,
        igst: Math.round(itemsTaxTotal),
        totalTax: Math.round(itemsTaxTotal),
      };
    }

    const half = Math.round(itemsTaxTotal / 2);
    return {
      taxable: Math.round(itemsSubtotal * 100) / 100,
      cgst: half,
      sgst: half,
      igst: 0,
      totalTax: Math.round(itemsTaxTotal),
    };
  }, [itemsSubtotal, itemsTaxTotal, billType, taxJurisdiction]);

  // -------------------------------------------------------------
  // PARTIAL PAYMENT MATHEMATICAL & LOGICAL INTEGRITY
  // -------------------------------------------------------------
  useEffect(() => {
    if (grandTotal <= 0) {
      if (settlementType !== 'unpaid') setSettlementType('unpaid');
      if (partialPaidAmount) setPartialPaidAmount('');
    } else if (settlementType === 'partially_paid') {
      const p = parseFloat(partialPaidAmount);
      if (!isNaN(p) && p > grandTotal) {
        setPartialPaidAmount(String(grandTotal));
      }
    }
  }, [grandTotal, settlementType, partialPaidAmount]);

  const immediatePaidAmount = useMemo(() => {
    if (grandTotal <= 0 || settlementType === 'unpaid') return 0;
    if (settlementType === 'fully_paid') return grandTotal;
    const p = parseFloat(partialPaidAmount);
    return isNaN(p) ? 0 : Math.min(grandTotal, Math.max(0, Math.round(p)));
  }, [settlementType, grandTotal, partialPaidAmount]);

  const remainingBalanceOnCredit = Math.max(0, grandTotal - immediatePaidAmount);

  // Clear / Reset Bill
  function handleResetBill() {
    if (
      validCartItems.length > 0 &&
      !window.confirm('Clear all purchase intake items and reset?')
    ) {
      return;
    }
    setCart([createCustomItem()]);
    setCurrentStep(1);
    setSearch('');
    setSettlementType('fully_paid');
    setPartialPaidAmount('');
    setPaymentMode('cheque');
    setChequeNumber('');
    setChequeBank('');
    setTransactionRef('');
    setNotes('');
    setErrorMessage('');
  }

  // Step Validations
  function validateStep1() {
    if (validCartItems.length === 0) {
      setErrorMessage('Please add at least one product or item to the purchase bill.');
      return false;
    }
    if (itemsSubtotal <= 0) {
      setErrorMessage('Please provide a valid price (greater than ₹0) for your bill items.');
      return false;
    }
    setErrorMessage('');
    return true;
  }

  function validateStep2() {
    if (!dealerId) {
      setErrorMessage('Please choose a supplier / brand dealer.');
      return false;
    }
    if (!billNumber.trim()) {
      setErrorMessage('Invoice / Parchi Number is mandatory.');
      return false;
    }
    if (!billDate) {
      setErrorMessage('Please select a valid bill date.');
      return false;
    }
    setErrorMessage('');
    return true;
  }

  function validateStep3() {
    if (settlementType === 'partially_paid') {
      const p = parseFloat(partialPaidAmount);
      if (isNaN(p) || p <= 0) {
        setErrorMessage('Please enter an advance amount greater than ₹0.');
        return false;
      }
      if (p >= grandTotal) {
        setErrorMessage(
          `Advance amount equals total bill (${formatCurrency(grandTotal)}). Please select "Full Payment".`
        );
        return false;
      }
    }

    if (settlementType !== 'unpaid' && paymentMode === 'cheque') {
      if (!chequeNumber.trim()) {
        setErrorMessage('Cheque / Check Number is mandatory for cheque payment.');
        return false;
      }
      if (!chequeDate) {
        setErrorMessage('Cheque Date is mandatory.');
        return false;
      }
    }
    setErrorMessage('');
    return true;
  }

  function handleTimelineStepClick(targetStepId) {
    if (targetStepId === currentStep) return;
    if (targetStepId === 1) {
      setErrorMessage('');
      setCurrentStep(1);
      return;
    }
    if (targetStepId === 2) {
      if (validateStep1()) {
        setErrorMessage('');
        setCurrentStep(2);
      }
      return;
    }
    if (targetStepId === 3) {
      if (validateStep1() && validateStep2()) {
        setErrorMessage('');
        setCurrentStep(3);
      }
      return;
    }
  }

  // Submission
  async function handleSubmitPurchaseBill() {
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    const validItems = validCartItems.map((it) => ({
      name: it.name.trim(),
      quantity: Math.max(1, Number(it.quantity) || 1),
      gst_rate: Number(it.gstRate ?? 18),
      unit_price: Math.max(0, Number(it.unitPrice) || 0),
      total:
        Math.max(1, Number(it.quantity) || 1) *
        Math.max(0, Number(it.unitPrice) || 0),
    }));

    let initialPaymentPayload = null;
    const paymentChannel = billType === 'kaccha' ? 'secondary_cash' : 'official_bank';

    if (settlementType !== 'unpaid' && immediatePaidAmount > 0) {
      const refString =
        paymentMode === 'cheque'
          ? chequeNumber.trim()
          : transactionRef.trim() || null;

      initialPaymentPayload = {
        amount: immediatePaidAmount,
        payment_mode: paymentMode,
        payment_channel: paymentChannel,
        transaction_ref: refString,
        cheque_date: paymentMode === 'cheque' ? chequeDate : null,
        cheque_bank: paymentMode === 'cheque' ? chequeBank.trim() : null,
        notes:
          settlementType === 'fully_paid'
            ? `Full spot settlement via ${paymentMode === 'cheque' ? 'Cheque' : paymentMode === 'cash' ? 'Cash' : paymentMode === 'upi' ? 'UPI' : 'Bank Transfer'}`
            : `Advance payment of ${formatCurrency(immediatePaidAmount)} via ${paymentMode === 'cheque' ? 'Cheque' : paymentMode === 'cash' ? 'Cash' : paymentMode === 'upi' ? 'UPI' : 'Bank Transfer'}`,
      };
    }

    try {
      const result = await createBillMutation.mutateAsync({
        dealer_id: dealerId,
        store_id: storeId || null,
        bill_type: billType,
        bill_number: billNumber.trim(),
        bill_date: billDate,
        credit_days: Number(creditDays),
        total_amount: grandTotal,
        taxable_amount: taxBreakdown.taxable,
        cgst_amount: taxBreakdown.cgst,
        sgst_amount: taxBreakdown.sgst,
        igst_amount: taxBreakdown.igst,
        items: validItems,
        notes: notes.trim() || null,
        initial_payment: initialPaymentPayload,
      });

      // Clear & redirect with print preview ready
      const redirectPath = `/admin/${effectiveStoreCode}/dealers`;
      navigate(`${redirectPath}?print=${result.id}`);
    } catch (err) {
      console.error('Failed to record purchase bill:', err);
      setErrorMessage(err.message || 'Error recording purchase bill in database.');
    }
  }

  // Active step subtitle for timeline
  const step3Subtitle = useMemo(() => {
    if (grandTotal <= 0) return 'Terms & payment';
    if (settlementType === 'fully_paid') return `Full Payment (${formatCurrency(grandTotal)})`;
    if (settlementType === 'partially_paid') {
      return immediatePaidAmount > 0
        ? `Advance ${formatCurrency(immediatePaidAmount)}`
        : 'Partial Advance';
    }
    return `Full Credit (${formatCurrency(grandTotal)})`;
  }, [grandTotal, settlementType, immediatePaidAmount]);

  return (
    <div className="space-y-6 min-w-0 pb-12 animate-in fade-in duration-150">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/admin/${effectiveStoreCode}/dealers`}
              className="text-[11px] font-bold uppercase tracking-wider text-muted hover:text-accent flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Dealer Section</span>
            </Link>
            <span className="text-xs text-muted">•</span>
            <span className="text-xs text-brand-sage font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-sage animate-pulse" />
              Purchase Billing
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            {store?.name || 'Star Furniture & Electronics'} Purchase Entry
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
            Guided 3-step procurement workflow: catalog intake, supplier invoice details, and multi-mode payment settlement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {validCartItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetBill}
              className="text-xs gap-1.5 text-muted hover:text-danger hover:border-danger/30 rounded-lg font-medium cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset Bill</span>
            </Button>
          )}

          <Link
            to={`/admin/${effectiveStoreCode}/dealers`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-text hover:bg-surface-subtle transition-all cursor-pointer"
          >
            <Building2 size={14} className="text-brand-sage" />
            <span>Back to Dealer Hub</span>
          </Link>
        </div>
      </div>

      {/* 2. Interactive Timeline Stepper */}
      <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {STEPS.map((s, idx) => {
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            const isAccessible =
              s.id <= currentStep ||
              (s.id === 2 && validCartItems.length > 0) ||
              (s.id === 3 && validCartItems.length > 0 && dealerId && billNumber.trim());

            return (
              <div key={s.id} className="flex-1 flex items-center min-w-0 last:flex-initial">
                {/* Timeline Step Node Button */}
                <button
                  type="button"
                  disabled={!isAccessible}
                  onClick={() => handleTimelineStepClick(s.id)}
                  className={cn(
                    'flex items-center gap-2.5 sm:gap-3 text-left focus:outline-none transition-all select-none shrink-0',
                    isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
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
                    <div className="text-[11px] text-muted truncate mt-0.5 hidden xs:block">
                      {s.id === 1 &&
                        (validCartItems.length > 0
                          ? `${validCartItems.length} ${
                              validCartItems.length === 1 ? 'item' : 'items'
                            } • ${formatCurrency(grandTotal)}`
                          : '0 items')}
                      {s.id === 2 &&
                        (selectedDealer
                          ? selectedDealer.brand_name || selectedDealer.name
                          : 'Choose Supplier')}
                      {s.id === 3 && (step3Subtitle || 'Terms & payment')}
                    </div>
                  </div>
                </button>

                {/* Timeline Connecting Line */}
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-4 h-0.5 bg-border relative overflow-hidden">
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
      {errorMessage && (
        <div className="p-3.5 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STEP 1: PRODUCTS, INVENTORY CATALOG & INTAKE ITEMS           */}
      {/* ------------------------------------------------------------- */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Barcode Search & Category Filters */}
          <Card className="p-4 sm:p-5 rounded-xl border border-border bg-surface space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Barcode
                  size={16}
                  className="absolute left-3.5 top-3 text-muted pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan Barcode or Search Store Inventory / Type Product Name (Press Enter to Add)..."
                  className="w-full min-h-10 pl-10 pr-4 py-2 rounded-lg border border-border bg-surface text-xs sm:text-sm text-text placeholder:text-muted focus:outline-brand-sage transition-colors"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors border shadow-2xs',
                    selectedCategory === 'all'
                      ? 'bg-accent text-accent-fg border-accent'
                      : 'bg-surface text-muted hover:text-text border-border'
                  )}
                >
                  All ({storeProducts.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors border shadow-2xs',
                      selectedCategory === cat.id
                        ? 'bg-accent text-accent-fg border-accent'
                        : 'bg-surface text-muted hover:text-text border-border'
                    )}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* STORE PRODUCT CATALOG */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                <Package size={14} className="text-text" />
                <span>Store Product Catalog</span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {displayItems.length} products
                </Badge>
              </span>
              <span className="text-[11px] text-muted hidden sm:inline">
                Click any product below to add directly to purchase intake
              </span>
            </div>

            {displayItems.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-surface text-muted text-xs">
                No matching catalog products found. Type product name in the box above to add as custom item.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {displayItems.map((p) => {
                  const stockQty = p.inventory?.[0]?.quantity_on_hand ?? 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddCatalogProduct(p)}
                      className="group relative p-3 rounded-xl border border-border bg-surface hover:border-brand-sage hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between shadow-2xs"
                    >
                      <div>
                        {/* Compact Product Image Container */}
                        <div className="relative w-full h-24 rounded-lg bg-surface-subtle/70 border border-border/60 overflow-hidden flex items-center justify-center p-2 mb-2.5 group-hover:border-brand-sage/40 transition-colors">
                          <ProductThumbnail
                            imageUrl={p.image_url}
                            sku={p.sku}
                            name={p.name}
                          />

                          {/* Floating Stock Badge */}
                          <span
                            className={cn(
                              'absolute top-1.5 right-1.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shadow-2xs',
                              stockQty > 2
                                ? 'bg-surface text-brand-sage border-brand-sage-border'
                                : stockQty > 0
                                ? 'bg-surface text-brand-gold-text border-brand-gold-border'
                                : 'bg-surface text-brand-crimson border-brand-crimson-border'
                            )}
                          >
                            Stock: {stockQty}
                          </span>
                        </div>

                        {/* Product Identification */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-muted uppercase tracking-wider truncate">
                            {p.sku}
                          </div>
                          <div
                            className="text-xs font-semibold text-text line-clamp-1 leading-snug group-hover:text-brand-sage transition-colors"
                            title={p.name}
                          >
                            {p.name}
                          </div>
                        </div>
                      </div>

                      {/* Pricing & Add Row */}
                      <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between">
                        <div>
                          <div className="font-bold font-mono text-xs sm:text-sm text-text">
                            {formatCurrency(p.cost_price || p.selling_price || 0)}
                          </div>
                          <div className="text-[10px] text-muted leading-tight">
                            cost
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-border bg-surface text-text group-hover:bg-accent group-hover:text-accent-fg group-hover:border-accent transition-colors">
                          <Plus size={11} />
                          <span>Add</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Bill Intake Items Card - 100% Consistent with Sales Billing */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-brand-sage" />
                <h2 className="text-base sm:text-lg font-bold text-text">
                  Bill Items
                </h2>
                <Badge variant="default" className="text-xs font-mono">
                  {cart.length} {cart.length === 1 ? 'line' : 'lines'}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {billType === 'gst' && (
                  <div className="flex items-center gap-1 bg-surface-subtle p-0.5 rounded-lg border border-border text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTaxJurisdiction('intra')}
                      className={cn(
                        'px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer text-[10px]',
                        taxJurisdiction === 'intra'
                          ? 'bg-accent text-accent-fg shadow-2xs'
                          : 'text-muted hover:text-text'
                      )}
                      title="Intra-State: CGST (50%) + SGST (50%)"
                    >
                      CGST+SGST
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxJurisdiction('inter')}
                      className={cn(
                        'px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer text-[10px]',
                        taxJurisdiction === 'inter'
                          ? 'bg-accent text-accent-fg shadow-2xs'
                          : 'text-muted hover:text-text'
                      )}
                      title="Inter-State: IGST (100%)"
                    >
                      IGST
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddCustomRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-surface text-text hover:bg-surface-subtle transition-all cursor-pointer"
                >
                  <Plus size={13} className="text-brand-sage" />
                  <span>Add Line Item</span>
                </button>
              </div>
            </div>

            {/* Table */}
            {cart.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border rounded-xl">
                <FileText size={28} className="text-muted mx-auto" />
                <p className="text-xs font-semibold text-text">Your intake list is currently empty</p>
                <p className="text-[11px] text-muted max-w-sm mx-auto">
                  Click on any product catalog card above or click &ldquo;Add Line Item&rdquo; to add purchase intake items.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-border min-w-130">
                    <thead>
                      <tr className="text-[10px] uppercase font-semibold text-muted bg-surface-subtle">
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-right">Cost Rate (₹)</th>
                        <th className="py-2.5 px-3 text-center">Quantity</th>
                        <th className="py-2.5 px-3 text-center">GST %</th>
                        <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                        <th className="py-2.5 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cart.map((it) => {
                        const q = Math.max(1, Number(it.quantity) || 1);
                        const p = Math.max(0, Number(it.unitPrice) || 0);
                        const lineTotal = q * p;

                        return (
                          <tr key={it.id} className="hover:bg-surface-subtle/40 transition-colors">
                            {/* Name / Description */}
                            <td className="py-3 px-3 min-w-48">
                              <input
                                type="text"
                                required
                                placeholder="Item name / model intake"
                                value={it.name}
                                onChange={(e) => handleItemChange(it.id, 'name', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage font-medium"
                              />
                              {(it.sku || it.category) && (
                                <div className="text-[10px] text-muted font-mono mt-1 flex items-center gap-1.5">
                                  {it.sku && <span>SKU: {it.sku}</span>}
                                  {it.sku && it.category && <span>•</span>}
                                  {it.category && <span>{it.category}</span>}
                                </div>
                              )}
                            </td>

                            {/* Cost Rate */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <span className="text-muted text-xs font-mono">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={it.unitPrice}
                                  onChange={(e) => handleItemChange(it.id, 'unitPrice', e.target.value)}
                                  className="w-24 px-2 py-1.5 text-xs text-right font-mono font-semibold rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                                />
                              </div>
                            </td>

                            {/* Quantity with +/- controls */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleItemChange(it.id, 'quantity', Math.max(1, q - 1))
                                  }
                                  className="w-6 h-6 rounded flex items-center justify-center bg-surface-subtle border border-border text-muted hover:text-text cursor-pointer transition-colors"
                                >
                                  <Minus size={11} />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  required
                                  value={it.quantity}
                                  onChange={(e) =>
                                    handleItemChange(it.id, 'quantity', e.target.value)
                                  }
                                  className="w-12 px-1 py-1 text-xs text-center font-mono font-bold rounded border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleItemChange(it.id, 'quantity', q + 1)}
                                  className="w-6 h-6 rounded flex items-center justify-center bg-surface-subtle border border-border text-muted hover:text-text cursor-pointer transition-colors"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>

                            {/* GST Rate */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {billType === 'gst' ? (
                                <select
                                  value={it.gstRate ?? 18}
                                  onChange={(e) =>
                                    handleItemChange(it.id, 'gstRate', Number(e.target.value))
                                  }
                                  className="w-24 px-2 py-1.5 text-xs text-center font-mono font-semibold rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage cursor-pointer"
                                >
                                  <option value={18}>18% GST</option>
                                  <option value={12}>12% GST</option>
                                  <option value={5}>5% GST</option>
                                  <option value={28}>28% GST</option>
                                  <option value={0}>0% (Nil)</option>
                                </select>
                              ) : (
                                <span className="font-mono text-xs text-muted px-2 py-1 bg-surface-subtle border border-border rounded">
                                  0% Kaccha
                                </span>
                              )}
                            </td>

                            {/* Line Total */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-base text-text whitespace-nowrap">
                              {formatCurrency(lineTotal)}
                            </td>

                            {/* Action */}
                            <td className="py-3 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.id)}
                                className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer shrink-0"
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Step 1 Footer Action Bar - Consistent with POS Billing */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border">
                  <div className="space-y-1">
                    <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
                      <span>
                        Total Units: <strong className="font-mono text-text">{totalUnits}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Taxable Base: <strong className="font-mono text-text">{formatCurrency(itemsSubtotal)}</strong>
                      </span>
                      {billType === 'gst' && itemsTaxTotal > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            GST Tax: <strong className="font-mono text-text">{formatCurrency(itemsTaxTotal)}</strong>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-muted">
                      Estimated Total:{' '}
                      <strong className="text-lg sm:text-xl font-extrabold text-text font-mono ml-1">
                        {formatCurrency(grandTotal)}
                      </strong>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    type="button"
                    onClick={() => {
                      if (validateStep1()) setCurrentStep(2);
                    }}
                    className="rounded-lg gap-2 text-xs font-semibold px-6 shadow-2xs cursor-pointer"
                  >
                    <span>Proceed to Supplier Details ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STEP 2: SUPPLIER SELECTION & INVOICE DETAILS                  */}
      {/* ------------------------------------------------------------- */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6 rounded-xl border border-border bg-surface space-y-5 shadow-2xs">
            {/* Header: Title & Two-Book Separation Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  <Building2 size={16} className="text-brand-sage" />
                  <span>Supplier & Invoice Details</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Select verified supplier or wholesaler, billing category, and credit payment terms.
                </p>
              </div>

              {/* Two-Book Separation Switcher */}
              <div className="inline-flex rounded-lg border border-border bg-surface-subtle p-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectBillType('gst')}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-colors text-xs flex items-center gap-1.5',
                    billType === 'gst'
                      ? 'bg-accent text-accent-fg shadow-2xs'
                      : 'text-muted hover:text-text'
                  )}
                >
                  <FileText size={13} />
                  <span>Tax Invoice (GST)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectBillType('kaccha')}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-colors text-xs flex items-center gap-1.5',
                    billType === 'kaccha'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-muted hover:text-text'
                  )}
                >
                  <Layers size={13} />
                  <span>Kaccha (Estimate)</span>
                </button>
              </div>
            </div>

            {/* Supplier / Brand Dealer Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>Select Supplier / Brand Dealer</span>
                  <span className="text-brand-crimson">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddDealerOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-sage hover:underline cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add New Dealer</span>
                </button>
              </div>

              <select
                value={dealerId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setDealerId(newId);
                  const found = dealers.find((d) => d.id === newId);
                  if (found?.default_credit_days) {
                    setCreditDays(found.default_credit_days);
                  }
                  if (billType === 'gst' && (!billNumber || billNumber.includes('/'))) {
                    setBillNumber(generateSmartBillNumber('gst', newId));
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text font-medium focus:outline-none focus:ring-1 focus:ring-brand-sage cursor-pointer"
              >
                <option value="">-- Choose Brand / Dealer --</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.brand_name} {d.phone ? `(${d.phone})` : ''}
                  </option>
                ))}
              </select>

              {/* Verified Supplier Profile Card */}
              {selectedDealer && (
                <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/70">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-text text-sm shadow-2xs uppercase">
                        {(selectedDealer.brand_name || selectedDealer.name || 'D').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-text">
                          {selectedDealer.name || selectedDealer.brand_name}
                        </div>
                        {selectedDealer.brand_name && selectedDealer.name !== selectedDealer.brand_name && (
                          <div className="text-xs text-muted">
                            Brand: <strong className="text-text font-medium">{selectedDealer.brand_name}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize font-medium">
                        {selectedDealer.dealer_type?.replace('_', ' ') || 'Supplier'}
                      </Badge>
                      <Badge
                        variant={billType === 'gst' ? (selectedDealer.gstin ? 'success' : 'amber') : 'default'}
                        className="text-[10px] font-mono"
                      >
                        {billType === 'gst'
                          ? selectedDealer.gstin
                            ? 'GST Verified'
                            : 'Missing GSTIN'
                          : 'Kaccha Ledger'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted block mb-0.5">Contact Phone</span>
                      <span className="font-mono font-semibold text-text">{formatPhone(selectedDealer.phone) || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted block mb-0.5">GSTIN Number</span>
                      <span className="font-mono font-semibold text-text truncate block">{selectedDealer.gstin || 'Unregistered'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted block mb-0.5">Standard Credit</span>
                      <span className="font-mono font-semibold text-text">{selectedDealer.default_credit_days || 30} Days</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted block mb-0.5">Current Khata Balance</span>
                      <span className={cn('font-mono font-bold text-sm', (selectedDealer.metrics?.totalBalance || 0) > 0 ? 'text-brand-crimson' : 'text-text')}>
                        {formatCurrency(selectedDealer.metrics?.totalBalance || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Inputs Grid: Invoice #, Date, Credit Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Invoice Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text">
                    {billType === 'gst' ? 'Invoice Number' : 'Parchi / Slip No'} <span className="text-brand-crimson">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateNumber}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-sage hover:text-brand-sage/80 cursor-pointer"
                  >
                    <Sparkles size={11} />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={billType === 'gst' ? 'e.g. DANISH/2026/198' : 'e.g. EST-2026-402'}
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full pl-3 pr-14 py-2 text-xs font-mono rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                  />
                  <button
                    type="button"
                    onClick={handleAutoGenerateNumber}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-semibold rounded bg-surface-subtle text-muted hover:text-text border border-border cursor-pointer"
                  >
                    Auto
                  </button>
                </div>
              </div>

              {/* Bill Date */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Bill Date <span className="text-brand-crimson">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
                />
              </div>

              {/* Credit Terms (Days) & Computed Due Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text">
                    Credit Terms (Days)
                  </label>
                  <span className="text-[10px] text-muted font-mono">
                    Due: {computedDueDate ? formatDate(computedDueDate, false) : '-'}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={creditDays}
                  onChange={(e) => setCreditDays(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text font-mono focus:outline-none focus:ring-1 focus:ring-brand-sage"
                />
              </div>
            </div>

            {/* Consignment Remarks / Memo */}
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Consignment Remarks / Internal Memo (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 15 ACs, 10 Refrigerators stock intake, verified at warehouse gate"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage"
              />
            </div>

            {/* Mini Procurement Preview Strip */}
            <div className="p-3.5 rounded-xl border border-border bg-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <FileText size={17} className="text-brand-sage shrink-0" />
                <span className="text-muted text-xs sm:text-sm">
                  Procuring <strong className="text-text font-semibold">{validCartItems.length} items ({totalUnits} units)</strong> for{' '}
                  <strong className="text-text font-mono font-bold text-base sm:text-lg">{formatCurrency(grandTotal)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-brand-sage hover:underline font-semibold cursor-pointer"
              >
                Modify Intake Items
              </button>
            </div>

            {/* Step 2 Footer Navigation - Inside Card */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                type="button"
                onClick={() => setCurrentStep(1)}
                className="rounded-lg gap-2 text-xs font-medium cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Products</span>
              </Button>

              <Button
                type="button"
                onClick={() => {
                  if (validateStep2()) setCurrentStep(3);
                }}
                className="rounded-lg gap-2 text-xs font-semibold px-6 shadow-2xs cursor-pointer"
              >
                <span>Proceed to Payment & Settlement</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STEP 3: PAYMENT SETTLEMENT & KHATA IMPACT (CONCISE & MINIMAL) */}
      {/* ------------------------------------------------------------- */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Payment Options & Instrument (Unified Card matching POS) */}
            <div className="lg:col-span-7">
              <Card className="p-5 sm:p-6 rounded-xl border border-border bg-surface space-y-5 shadow-2xs">
                <div className="pb-3 border-b border-border">
                  <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                    <Coins size={16} className="text-brand-sage" />
                    <span>Payment Tender & Settlement</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Select payment settlement status, record advance payments, and configure payment channel.
                  </p>
                </div>

                {/* Settlement Type Selector: FULL PAYMENT -> PARTIAL -> UNPAID */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">
                      Payment Settlement Status <span className="text-brand-crimson">*</span>
                    </label>
                    <Badge
                      variant={settlementType === 'fully_paid' ? 'success' : settlementType === 'partially_paid' ? 'amber' : 'outline'}
                      className="text-[10px] font-mono uppercase"
                    >
                      {settlementType === 'fully_paid'
                        ? 'Full Settlement'
                        : settlementType === 'partially_paid'
                        ? 'Partial Advance'
                        : 'Credit / Khata'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. Full Payment */}
                    <button
                      type="button"
                      onClick={() => {
                        setSettlementType('fully_paid');
                        setPartialPaidAmount('0');
                      }}
                      className={cn(
                        'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                        settlementType === 'fully_paid'
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600 text-text'
                          : 'border-border bg-surface text-muted hover:bg-surface-subtle'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span>Full Payment</span>
                        </div>
                        {settlementType === 'fully_paid' && <CheckCircle2 size={14} className="text-emerald-600" />}
                      </div>
                      <div className="text-[11px] text-muted leading-tight">
                        100% spot settlement ({formatCurrency(grandTotal)}). Cleared on intake.
                      </div>
                    </button>

                    {/* 2. Partial Payment */}
                    <button
                      type="button"
                      onClick={() => {
                        setSettlementType('partially_paid');
                        setPartialPaidAmount('0');
                      }}
                      className={cn(
                        'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                        settlementType === 'partially_paid'
                          ? 'border-brand-sage bg-brand-sage-subtle/60 ring-1 ring-brand-sage text-text'
                          : 'border-border bg-surface text-muted hover:bg-surface-subtle'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-text">
                          <Coins size={16} className="text-brand-sage" />
                          <span>Partial Payment</span>
                        </div>
                        {settlementType === 'partially_paid' && <CheckCircle2 size={14} className="text-brand-sage" />}
                      </div>
                      <div className="text-[11px] text-muted leading-tight">
                        Pay advance now; balance deferred to credit khata.
                      </div>
                    </button>

                    {/* 3. Unpaid */}
                    <button
                      type="button"
                      onClick={() => {
                        setSettlementType('unpaid');
                        setPartialPaidAmount('0');
                      }}
                      className={cn(
                        'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                        settlementType === 'unpaid'
                          ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500 text-text'
                          : 'border-border bg-surface text-muted hover:bg-surface-subtle'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                          <Clock size={16} className="text-amber-600" />
                          <span>Unpaid (Credit)</span>
                        </div>
                        {settlementType === 'unpaid' && <CheckCircle2 size={14} className="text-amber-600" />}
                      </div>
                      <div className="text-[11px] text-muted leading-tight">
                        Full amount deferred to {computedDueDate ? formatDate(computedDueDate, false) : '-'}.
                      </div>
                    </button>
                  </div>

                  {/* Advance Amount (if Partially Paid) - Integrated Inside the Same Card without external box */}
                  {settlementType === 'partially_paid' && (
                    <div className="p-3.5 rounded-xl border border-border bg-surface-subtle space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-text">
                            Advance Paid Amount (₹) <span className="text-brand-crimson">*</span>
                          </label>
                          <span className="text-[11px] text-muted">
                            Initial payment tendered at intake (defaults to 0 for credit)
                          </span>
                        </div>

                        <div className="relative w-44">
                          <span className="absolute left-3 top-2 text-muted font-bold text-xs">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={grandTotal}
                            placeholder="0"
                            value={partialPaidAmount}
                            onChange={(e) => setPartialPaidAmount(e.target.value)}
                            className="w-full pl-7 pr-3 py-1.5 text-sm font-bold font-mono rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-sage text-right"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted">
                        <span>Remaining Balance on Credit:</span>
                        <strong className="font-mono text-amber-900 text-sm">
                          {formatCurrency(remainingBalanceOnCredit)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Instrument (when Full Payment or Partial) */}
                {settlementType !== 'unpaid' && (
                  <div className="space-y-3.5 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                        <CreditCard size={15} className="text-brand-sage" />
                        <span>Payment Method</span>
                      </label>

                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-surface-subtle border border-border text-muted">
                        Channel: {billType === 'gst' ? 'Official Bank' : 'Secondary Cash'}
                      </span>
                    </div>

                    {/* Clean 4-button selector */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'cheque', label: 'Cheque', icon: Building },
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

                    {/* Cheque Fields */}
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

                    {/* UPI / Bank Transfer Reference */}
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
                )}

                {/* Step 3 Footer Navigation - Inside Card */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="rounded-lg gap-2 text-xs font-medium cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Supplier Details</span>
                  </Button>
                </div>
              </Card>
            </div>

            {/* Right: Final Review & Khata Impact Card */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="p-5 rounded-xl border border-brand-sage-border bg-brand-sage-subtle/30 space-y-3.5 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-sage block">
                  Procurement & Khata Impact
                </span>

                <div className="space-y-2.5 text-xs divide-y divide-border/60">
                  <div className="flex items-center justify-between pb-1.5">
                    <span className="text-muted">Supplier / Dealer</span>
                    <span className="font-bold text-text">
                      {selectedDealer?.brand_name || selectedDealer?.name || 'Selected Supplier'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Invoice / Parchi No</span>
                    <span className="font-mono font-bold text-text">{billNumber}</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Intake Items</span>
                    <span className="font-mono font-bold text-text">
                      {validCartItems.length} items ({totalUnits} units)
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Total Bill Payable</span>
                    <span className="font-mono text-base font-bold text-text">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Paid Immediately</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-800 text-sm block">
                        {formatCurrency(immediatePaidAmount)}
                      </span>
                      {settlementType !== 'unpaid' && immediatePaidAmount > 0 && (
                        <span className="text-[11px] font-sans font-medium text-muted block mt-0.5">
                          via {paymentMode === 'cheque' ? 'Cheque' : paymentMode === 'cash' ? 'Cash' : paymentMode === 'upi' ? 'UPI / QR' : 'Bank Transfer'}
                          {paymentMode === 'cheque' && chequeNumber.trim() ? ` (#${chequeNumber.trim()})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Balance on Khata Credit</span>
                    <span className="font-mono font-bold text-amber-900 text-sm">
                      {formatCurrency(remainingBalanceOnCredit)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-muted">Credit Due Date</span>
                    <span className="font-mono font-bold text-text">
                      {computedDueDate ? formatDate(computedDueDate, false) : '-'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-border text-[11px] text-muted flex items-center justify-between">
                  <span>Khata Ledger Status:</span>
                  <Badge variant="outline" className="font-bold capitalize text-text">
                    {settlementType === 'fully_paid'
                      ? 'Fully Settled'
                      : settlementType === 'partially_paid'
                      ? 'Partially Paid'
                      : 'Unpaid on Credit'}
                  </Badge>
                </div>
              </Card>

              {/* Submit Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSubmitPurchaseBill}
                  disabled={createBillMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-accent text-accent-fg hover:bg-accent/90 active:scale-[0.99] shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {createBillMutation.isPending
                      ? 'Recording Bill & Updating Khata...'
                      : settlementType === 'fully_paid'
                      ? `Record Fully Settled Bill (${formatCurrency(grandTotal)})`
                      : settlementType === 'partially_paid'
                      ? `Record Bill (Paid ${formatCurrency(immediatePaidAmount)} • Due ${formatCurrency(remainingBalanceOnCredit)})`
                      : `Record Credit Bill (${formatCurrency(grandTotal)} Due ${computedDueDate ? formatDate(computedDueDate, false) : ''})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full text-center py-2 text-xs font-semibold text-muted hover:text-text cursor-pointer transition-colors"
                >
                  ← Back to Supplier & Invoice Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Dealer Modal */}
      <AddDealerModal
        isOpen={isAddDealerOpen}
        onClose={() => setIsAddDealerOpen(false)}
        storeId={storeId}
      />
    </div>
  );
}
