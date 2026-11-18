import { useState, useMemo, useRef, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Badge,
  Card,
  Modal,
} from '@/shared/ui';
import { useProducts, useProductUnits } from '@/features/inventory';
import { usePlaceSale, useInvoiceDetail } from '../hooks/useBilling';
import { InvoicePrintModal } from '../components/InvoicePrintModal';
import { formatCurrency } from '@/shared/lib/format';
import { isValidIndianPhone, isValidGstin, cleanPhone } from '@/shared/lib/validation';
import { getErrorMessage } from '@/shared/lib/errors';
import { cn } from '@/shared/lib/cn';
import {
  Barcode,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Banknote,
  QrCode,
  CreditCard,
  RotateCcw,
  User,
  Building,
  Package,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Tag,
  Coins,
  Receipt,
  FileCheck2,
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Cart Items', icon: ShoppingBag },
  { id: 2, label: 'Customer Details', icon: User },
  { id: 3, label: 'Payment & Settlement', icon: Banknote },
];

export function POSPage() {
  const { store } = useOutletContext();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // Stepper state (1: Cart Items, 2: Customer, 3: Payment & Settlement)
  const [currentStep, setCurrentStep] = useState(1);

  // Bill Items Cart State
  const [cart, setCart] = useState([]);

  // Bill-Level Discount State
  const [billDiscountType, setBillDiscountType] = useState('flat'); // 'flat' (₹) | 'percent' (%)
  const [billDiscountValue, setBillDiscountValue] = useState('');

  // Customer State (Step 2)
  const [customerType, setCustomerType] = useState('walkin'); // 'walkin' | 'registered'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Payment Tender State (Step 3)
  const [settlementType, setSettlementType] = useState('full'); // 'full' | 'partial' | 'pending'
  const [partialCollectedAmount, setPartialCollectedAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'upi' | 'card' | 'emi'
  const [cashTendered, setCashTendered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Barcode / Catalog Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Receipt Modal State
  const [completedInvoiceId, setCompletedInvoiceId] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Serial Unit Selector Modal State
  const [isUnitSelectorOpen, setIsUnitSelectorOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);

  // Data Queries
  const { data: products = [] } = useProducts(store?.id);
  const { data: productUnits = [], isLoading: unitsLoading } = useProductUnits(
    store?.id,
    pendingProduct?.id,
    null,
    {
      enabled: Boolean(store?.id && pendingProduct?.id && isUnitSelectorOpen),
    }
  );
  const unusedUnits = productUnits.filter((u) => u.status === 'in_stock');
  const usedUnits = productUnits.filter((u) => u.status === 'sold');
  const hasUsedSerial = cart.some((item) => item.is_used_serial);
  const { data: invoiceDetail } = useInvoiceDetail(completedInvoiceId);
  const placeSaleMutation = usePlaceSale();

  // Keyboard shortcut: Press F2 or / to focus search
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.key === 'F2' || e.key === '/') && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        if (currentStep === 1) {
          searchInputRef.current?.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  // Extract categories for filter tabs
  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
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
  }, [products]);

  // Matching items to display in the Available Items section & search
  const displayItems = useMemo(() => {
    return products.filter((p) => {
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
  }, [products, search, selectedCategory]);

  // Add Product to Cart Handler (a serial number is required for every billed item)
  function handleAddProduct(product) {
    setPendingProduct(product);
    setIsUnitSelectorOpen(true);
  }

  // Handle barcode scanner Enter key
  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = search.trim().toLowerCase();
      if (!q) return;

      const exact = products.find(
        (p) => p.sku?.toLowerCase() === q || p.name?.toLowerCase() === q
      );
      const target = exact || (displayItems.length === 1 ? displayItems[0] : null);

      if (target) {
        handleAddProduct(target);
        setSearch('');
      }
    }
  }

  // Select Unit for Serialized Item
  function handleSelectUnit(unit) {
    if (!pendingProduct) return;

    if (cart.some((item) => item.unit_id === unit.id)) {
      alert('This unit is already added to the bill.');
      return;
    }

    const isUsedSerial = unit.status === 'sold';
    if (isUsedSerial) {
      setSettlementType('full');
      setPartialCollectedAmount('');
      setPaymentMode('cash');
      setPaymentReference('');
    }

    setCart((prev) => [
      ...prev,
      {
        product_id: pendingProduct.id,
        unit_id: unit.id,
        name: pendingProduct.name,
        sku: pendingProduct.sku,
        hsn_code: pendingProduct.hsn_code || (store?.code === 'mobiles' ? '8517' : '9401'),
        selling_price: parseFloat(pendingProduct.selling_price) || 0,
        gst_rate: !isNaN(parseFloat(pendingProduct.gst_rate)) ? parseFloat(pendingProduct.gst_rate) : 18,
        is_serialized: true,
        serial_number: unit.serial_number,
        is_used_serial: isUsedSerial,
        condition_grade: unit.condition_grade,
        quantity: 1,
      },
    ]);

    setIsUnitSelectorOpen(false);
    setPendingProduct(null);
    searchInputRef.current?.focus();
  }

  // Remove single line item
  function handleRemoveItem(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  // Clear entire bill
  function handleClearBill() {
    if (cart.length > 0 && !window.confirm('Clear all items and reset this bill?')) {
      return;
    }
    setCart([]);
    setCurrentStep(1);
    setBillDiscountValue('');
    setCustomerType('walkin');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerGstin('');
    setCustomerAddress('');
    setSettlementType('full');
    setPartialCollectedAmount('');
    setCashTendered('');
    setPaymentReference('');
    setErrorMessage('');
  }

  // -------------------------------------------------------------
  // DYNAMIC FINANCIAL & DISCOUNT ENGINE
  // -------------------------------------------------------------
  const grossTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.selling_price || 0) * (item.quantity || 1), 0);
  }, [cart]);

  // Bill-Level Overall Discount (Settled in Step 3)
  const billDiscountAmount = useMemo(() => {
    const val = parseFloat(billDiscountValue);
    if (isNaN(val) || val <= 0) return 0;
    if (billDiscountType === 'percent') {
      return (grossTotal * Math.min(val, 100)) / 100;
    }
    return Math.min(val, grossTotal);
  }, [billDiscountType, billDiscountValue, grossTotal]);

  const netTaxableSubtotal = Math.max(grossTotal - billDiscountAmount, 0);

  // Dynamic GST Calculation
  const totalTax = useMemo(() => {
    if (grossTotal === 0 || netTaxableSubtotal === 0) return 0;
    const ratio = grossTotal > 0 ? netTaxableSubtotal / grossTotal : 1;
    return cart.reduce((acc, item) => {
      const itemTaxable = (item.selling_price || 0) * (item.quantity || 1) * ratio;
      const rate = item.gst_rate ?? 18;
      return acc + itemTaxable * (rate / 100);
    }, 0);
  }, [cart, grossTotal, netTaxableSubtotal]);

  const cgstAmount = Math.round(totalTax / 2);
  const sgstAmount = Math.round(totalTax / 2);
  const grandTotal = Math.round(netTaxableSubtotal + cgstAmount + sgstAmount);
  const roundOff = 0;

  // Effective Collected Amount and Balance Due (Step 3 - rounded)
  const effectiveCollectedAmount = useMemo(() => {
    if (settlementType === 'full') return grandTotal;
    if (settlementType === 'pending') return 0;
    const p = parseFloat(partialCollectedAmount);
    return isNaN(p) ? 0 : Math.round(Math.min(Math.max(p, 0), grandTotal));
  }, [settlementType, grandTotal, partialCollectedAmount]);

  const balanceDueAmount = Math.round(Math.max(grandTotal - effectiveCollectedAmount, 0));

  // Cash Change Calculation
  const targetCashAmount = settlementType === 'full' ? grandTotal : effectiveCollectedAmount;
  const cashReceivedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(cashReceivedNum - targetCashAmount, 0);

  // Complete Sale & Generate Invoice (Step 3 Final Submission)
  async function handleCompleteSale() {
    if (cart.length === 0) {
      setErrorMessage('Please add at least one product to the invoice.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Customer Name is mandatory. Please provide the customer name in Step 2.');
      setCurrentStep(2);
      return;
    }

    if (!isValidIndianPhone(customerPhone)) {
      setErrorMessage('A valid 10-digit mobile number is mandatory (starts with 6-9).');
      setCurrentStep(2);
      return;
    }

    if (!customerAddress.trim()) {
      setErrorMessage('Customer Address is mandatory. Please provide the address in Step 2.');
      setCurrentStep(2);
      return;
    }

    if (customerType === 'registered' && !customerGstin.trim()) {
      setErrorMessage('Customer GSTIN is mandatory for B2B tax invoices.');
      setCurrentStep(2);
      return;
    }

    if (customerGstin.trim() && !isValidGstin(customerGstin)) {
      setErrorMessage('Please enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).');
      setCurrentStep(2);
      return;
    }

    if (cart.some((item) => !item.unit_id)) {
      setErrorMessage('Serial number is required for every item. Remove items without a serial and add them again.');
      setCurrentStep(1);
      return;
    }

    if (hasUsedSerial && (settlementType !== 'full' || paymentMode !== 'cash')) {
      setErrorMessage('This bill has a used serial number, so it must be a cash bill: full payment in Cash.');
      return;
    }

    if (settlementType === 'partial' && effectiveCollectedAmount <= 0) {
      setErrorMessage('Please enter an amount collected now, or choose "Pay Later (Credit)".');
      return;
    }

    if (settlementType !== 'pending' && paymentMode !== 'cash' && !paymentReference.trim()) {
      setErrorMessage(
        `Please provide a transaction or reference number for ${
          paymentMode === 'upi' ? 'UPI' : paymentMode === 'card' ? 'Card' : 'Financing'
        } payment.`
      );
      return;
    }

    setErrorMessage('');

    try {
      const resolvedCustomerName = customerName.trim();
      const resolvedCustomerPhone = cleanPhone(customerPhone);

      const paymentsPayload =
        effectiveCollectedAmount > 0
          ? [
              {
                payment_method: paymentMode,
                amount: Math.round(effectiveCollectedAmount),
                reference_number:
                  paymentReference.trim() ||
                  (paymentMode === 'cash' && cashReceivedNum > 0
                    ? `Cash: ₹${Math.round(cashReceivedNum)}, Change: ₹${Math.round(changeDue)}`
                    : null),
              },
            ]
          : [];

      const payload = {
        storeId: store?.id,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerGstin: customerGstin.trim().toUpperCase() || null,
        notes: customerAddress.trim() || null,
        items: cart.map((item) => {
          const itemGross = (item.selling_price || 0) * (item.quantity || 1);
          const itemShareDiscount = grossTotal > 0 ? (billDiscountAmount * itemGross) / grossTotal : 0;
          const unitDiscount = item.quantity > 0 ? itemShareDiscount / item.quantity : 0;
          return {
            product_id: item.product_id,
            unit_id: item.unit_id,
            quantity: item.quantity,
            unit_price: Math.round(item.selling_price || 0),
            discount: Math.round(unitDiscount),
          };
        }),
        payments: paymentsPayload,
      };

      const result = await placeSaleMutation.mutateAsync(payload);
      setCompletedInvoiceId(result.invoice_id);
      setCart([]);
      setCurrentStep(1);
      setSettlementType('full');
      setPartialCollectedAmount('');
      setBillDiscountValue('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerAddress('');
      setCashTendered('');
      setPaymentReference('');

      // Redirect immediately to the Bills page with print preview ready
      const storeCode = store?.code;
      const redirectPath = storeCode ? `/admin/${storeCode}/invoices` : '/admin/invoices';
      navigate(`${redirectPath}?print=${result.invoice_id}`);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 min-w-0 pb-12">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              POINT OF SALE
            </span>
            <span className="text-xs text-muted">•</span>
            <span className="text-xs text-brand-sage font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-sage animate-pulse" />
              Counter Billing Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            {store?.name} Billing
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
            Guided 3-step checkout with catalog search, customer invoicing, and counter discount settlement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearBill}
              className="text-xs gap-1.5 text-muted hover:text-danger hover:border-danger/30 rounded-lg font-medium cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset Bill</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Interactive Timeline Stepper */}
      <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {STEPS.map((s, idx) => {
            const isCurrent = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            const isClickable =
              s.id < currentStep ||
              (s.id === 2 && cart.length > 0) ||
              (s.id === 3 && cart.length > 0);

            return (
              <div key={s.id} className="flex-1 flex items-center min-w-0 last:flex-initial">
                {/* Timeline Step Node Button */}
                <button
                  type="button"
                  disabled={!isClickable && !isCurrent}
                  onClick={() => {
                    if (s.id === 2 && cart.length === 0) return;
                    if (s.id === 3) {
                      if (cart.length === 0) return;
                      if (!customerName.trim()) {
                        setErrorMessage('Customer Name is mandatory before proceeding to payment.');
                        setCurrentStep(2);
                        return;
                      }
                      if (!isValidIndianPhone(customerPhone)) {
                        setErrorMessage('A valid 10-digit customer mobile number is mandatory (starts with 6-9).');
                        setCurrentStep(2);
                        return;
                      }
                      if (customerType === 'registered' && !customerGstin.trim()) {
                        setErrorMessage('Customer GSTIN is mandatory for B2B billing.');
                        setCurrentStep(2);
                        return;
                      }
                      if (customerGstin.trim() && !isValidGstin(customerGstin)) {
                        setErrorMessage('Please enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).');
                        setCurrentStep(2);
                        return;
                      }
                      if (!customerAddress.trim()) {
                        setErrorMessage('Customer Address is mandatory before proceeding to payment.');
                        setCurrentStep(2);
                        return;
                      }
                    }
                    setCurrentStep(s.id);
                    setErrorMessage('');
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
                    <div className="text-[11px] text-muted truncate mt-0.5 hidden xs:block">
                      {s.id === 1 && `${cart.length} ${cart.length === 1 ? 'item' : 'items'}`}
                      {s.id === 2 && (customerType === 'walkin' ? 'Walk-in B2C' : 'Registered B2B')}
                      {s.id === 3 && formatCurrency(grandTotal)}
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
      {/* STEP 1: CART, PRODUCT CATALOG & LINE-ITEM DISCOUNTS           */}
      {/* ------------------------------------------------------------- */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Barcode Search & Category Filters */}
          <Card className="p-4 sm:p-5 rounded-xl border border-border bg-surface space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Barcode size={16} className="absolute left-3.5 top-3 text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan Barcode or Type Product Name / SKU (Press Enter to Add)... [F2]"
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
                  All ({products.length})
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

          {/* Available Items Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                <Package size={14} className="text-text" />
                <span>Available Store Items</span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {displayItems.length} products
                </Badge>
              </span>
              <span className="text-[11px] text-muted hidden sm:inline">
                Click any item to add directly to the bill
              </span>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {displayItems.map((p) => {
                const stockQty = p.inventory?.[0]?.quantity_on_hand ?? 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddProduct(p)}
                    className="p-3 rounded-xl border border-border bg-surface hover:border-text/40 hover:bg-surface-subtle transition-all cursor-pointer flex flex-col justify-between shadow-2xs group"
                  >
                    <div>
                      {/* Product Image */}
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border/60 bg-surface-subtle flex items-center justify-center p-2 mb-2 group-hover:border-border transition-colors">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            loading="lazy"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted">
                            <Package size={28} />
                            <span className="text-[9px] font-mono">{p.sku}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-[10px] font-mono text-muted uppercase tracking-wider truncate">
                            {p.sku}
                          </span>
                          <span className="text-xs text-muted font-mono font-medium">
                            Stock: {stockQty}
                          </span>
                        </div>
                        <div className="font-semibold text-sm text-text line-clamp-2 leading-snug group-hover:text-accent">
                          {p.name}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-border/60 mt-2">
                      <div>
                        <div className="font-bold font-mono text-base text-text">
                          {formatCurrency(p.selling_price)}
                        </div>
                        <div className="text-xs text-muted">
                          +{p.gst_rate ?? 18}% GST
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 px-2.5 text-xs rounded-md gap-1 font-semibold pointer-events-none"
                      >
                        <Plus size={12} /> Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Bill Cart */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-brand-sage" />
                <h2 className="text-base sm:text-lg font-bold text-text">
                  Bill Items
                </h2>
                <Badge variant="default" className="text-xs font-mono">
                  {cart.length} {cart.length === 1 ? 'line' : 'lines'}
                </Badge>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border rounded-xl">
                <ShoppingBag size={28} className="text-muted mx-auto" />
                <p className="text-xs font-semibold text-text">Your bill is currently empty</p>
                <p className="text-[11px] text-muted max-w-sm mx-auto">
                  Scan a barcode above or click on any available product to add it to this bill.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-border min-w-130">
                    <thead>
                      <tr className="text-[10px] uppercase font-semibold text-muted bg-surface-subtle">
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                        <th className="py-2.5 px-3 text-center">Quantity</th>
                        <th className="py-2.5 px-3 text-center">GST %</th>
                        <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                        <th className="py-2.5 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cart.map((item, idx) => {
                        const lineTaxable = (item.selling_price || 0) * (item.quantity || 1);
                        const lineTotal = Math.round(lineTaxable * (1 + (item.gst_rate / 100)));

                        return (
                          <tr key={item.unit_id || `${item.product_id}-${idx}`} className="hover:bg-surface-subtle/40 transition-colors">
                            <td className="py-3 px-3 min-w-48">
                              <div className="font-bold text-text text-sm">{item.name}</div>
                              <div className="text-xs text-muted font-mono flex items-center gap-1.5 mt-0.5">
                                <span>SKU: {item.sku}</span>
                                {item.serial_number && (
                                  <>
                                    <span>•</span>
                                    <span className={cn('font-semibold', item.is_used_serial ? 'text-amber-700' : 'text-brand-sage')}>
                                      S/N: {item.serial_number}
                                    </span>
                                  </>
                                )}
                                {item.is_used_serial && (
                                  <Badge variant="warning" className="text-[9px] px-1.5 py-0 uppercase">
                                    Used • Cash bill only
                                  </Badge>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-semibold text-sm text-text whitespace-nowrap">
                              {formatCurrency(item.selling_price)}
                            </td>

                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="font-mono font-semibold px-2 py-0.5 bg-surface-subtle border border-border rounded text-xs">
                                1
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center font-mono text-muted text-xs whitespace-nowrap">
                              {item.gst_rate}%
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-base text-text whitespace-nowrap">
                              {formatCurrency(lineTotal)}
                            </td>

                            <td className="py-3 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-muted hover:text-danger rounded hover:bg-danger/10 cursor-pointer transition-colors"
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

                {/* Step 1 Footer Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border">
                  <div className="space-y-1">
                    <div className="text-xs text-muted">
                      Gross Subtotal: <strong className="font-mono text-text text-sm">{formatCurrency(grossTotal)}</strong>
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
                      if (cart.length === 0) {
                        setErrorMessage('Please add at least one item to proceed.');
                        return;
                      }
                      setErrorMessage('');
                      setCurrentStep(2);
                    }}
                    className="rounded-lg gap-2 text-xs font-semibold px-6 shadow-2xs cursor-pointer"
                  >
                    <span>Proceed to Customer Details ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STEP 2: CUSTOMER & DELIVERY INVOICE DETAILS                   */}
      {/* ------------------------------------------------------------- */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6 rounded-xl border border-border bg-surface space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  <User size={16} className="text-brand-sage" />
                  <span>Customer & GST Invoice Details</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Select Walk-in B2C for instantaneous counter sales or fill GSTIN for registered tax invoicing.
                </p>
              </div>

              {/* Quick Customer Type Selector */}
              <div className="inline-flex rounded-lg border border-border bg-surface-subtle p-1 text-xs overflow-x-auto max-w-full no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerType('walkin');
                    setCustomerName('Walk-in Customer');
                    setCustomerGstin('');
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-colors text-xs flex items-center gap-1.5',
                    customerType === 'walkin'
                      ? 'bg-accent text-accent-fg shadow-2xs'
                      : 'text-muted hover:text-text'
                  )}
                >
                  <User size={13} />
                  <span>Quick Walk-in (B2C)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerType('registered');
                    if (customerName === 'Walk-in Customer') setCustomerName('');
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-colors text-xs flex items-center gap-1.5',
                    customerType === 'registered'
                      ? 'bg-accent text-accent-fg shadow-2xs'
                      : 'text-muted hover:text-text'
                  )}
                >
                  <Building size={13} />
                  <span>Business / GSTIN (B2B)</span>
                </button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                id="pos-customer-name"
                label="Customer Name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. Rahul Sharma"
                required
              />

              <Input
                id="pos-customer-phone"
                label="Mobile Number"
                type="tel"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. 9370011653"
                maxLength={10}
                required
              />

              <Input
                id="pos-customer-gstin"
                label={customerType === 'registered' ? 'Customer GSTIN (Required B2B)' : 'Customer GSTIN (Optional B2B)'}
                value={customerGstin}
                onChange={(e) => {
                  setCustomerGstin(e.target.value.toUpperCase());
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. 27ABCDE1234F1Z5"
                maxLength={15}
                required={customerType === 'registered'}
                className="font-mono uppercase"
              />
            </div>

            {/* Customer Address */}
            <div>
              <Input
                id="pos-customer-address"
                label="Address"
                value={customerAddress}
                onChange={(e) => {
                  setCustomerAddress(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. Flat 402, Royal Palms, MG Road, Mumbai"
                required
              />
            </div>

            {/* Mini Bill Preview Strip */}
            <div className="p-3.5 rounded-xl border border-border bg-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Receipt size={17} className="text-brand-sage shrink-0" />
                <span className="text-muted">
                  Billing <strong className="text-text font-semibold">{cart.length} items</strong> for{' '}
                  <strong className="text-text font-mono font-bold text-base sm:text-lg">{formatCurrency(grandTotal)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-brand-sage hover:underline font-semibold cursor-pointer"
              >
                Modify Cart Items
              </button>
            </div>

            {/* Step 2 Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                type="button"
                onClick={() => setCurrentStep(1)}
                className="rounded-lg gap-2 text-xs font-medium cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Cart</span>
              </Button>

              <Button
                type="button"
                onClick={() => {
                  if (!customerName.trim()) {
                    setErrorMessage('Customer Name is mandatory. Please enter Customer Name.');
                    return;
                  }
                  if (!isValidIndianPhone(customerPhone)) {
                    setErrorMessage('A valid 10-digit mobile number is mandatory (starts with 6-9).');
                    return;
                  }
                  if (customerType === 'registered' && !customerGstin.trim()) {
                    setErrorMessage('Customer GSTIN is mandatory for B2B billing.');
                    return;
                  }
                  if (customerGstin.trim() && !isValidGstin(customerGstin)) {
                    setErrorMessage('Please enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).');
                    return;
                  }
                  if (!customerAddress.trim()) {
                    setErrorMessage('Customer Address is mandatory. Please enter the address.');
                    return;
                  }
                  setErrorMessage('');
                  setCurrentStep(3);
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
      {/* STEP 3: TENDER SELECTION, CHANGE CALCULATOR & PRINT INVOICE  */}
      {/* ------------------------------------------------------------- */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (col-span-7): Tender & Payment Selection */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="p-5 sm:p-6 rounded-xl border border-border bg-surface space-y-5 shadow-2xs">
              <div className="pb-3 border-b border-border">
                <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  <Coins size={16} className="text-brand-sage" />
                  <span>Payment Tender & Collection</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Select payment instrument, manage partial/pending terms, and calculate change return.
                </p>
              </div>

              {hasUsedSerial && (
                <div className="p-3 rounded-lg border border-pastel-amber-border bg-pastel-amber text-pastel-amber-text text-xs flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-px" />
                  <span>
                    This bill has a used serial number, so it can only be a <strong>cash bill</strong>: full payment in
                    Cash. The used serial is removed once this bill is saved. Remove it from the cart to bill by UPI,
                    card, EMI, partial or credit.
                  </span>
                </div>
              )}

              {/* Settlement Terms Selector: Full vs Partial vs Pay Later */}
              <div className="p-3.5 rounded-xl border border-border bg-surface-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">Payment Settlement Term</span>
                  <Badge
                    variant={settlementType === 'full' ? 'success' : settlementType === 'partial' ? 'amber' : 'outline'}
                    className="text-[10px] font-mono uppercase"
                  >
                    {settlementType === 'full'
                      ? 'Full Payment'
                      : settlementType === 'partial'
                      ? 'Partial / Token'
                      : 'Credit / Udhaar'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementType('full');
                      setPartialCollectedAmount('');
                    }}
                    className={cn(
                      'p-2 rounded-lg border text-xs font-semibold transition-all text-center cursor-pointer',
                      settlementType === 'full'
                        ? 'bg-accent text-accent-fg border-accent font-bold shadow-2xs'
                        : 'border-border bg-surface text-muted hover:text-text'
                    )}
                  >
                    Full Payment
                  </button>

                  <button
                    type="button"
                    disabled={hasUsedSerial}
                    onClick={() => {
                      setSettlementType('partial');
                      if (!partialCollectedAmount) {
                        setPartialCollectedAmount(Math.round(grandTotal / 2).toString());
                      }
                    }}
                    className={cn(
                      'p-2 rounded-lg border text-xs font-semibold transition-all text-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                      settlementType === 'partial'
                        ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-2xs'
                        : 'border-border bg-surface text-muted hover:text-text'
                    )}
                  >
                    Partial / Token
                  </button>

                  <button
                    type="button"
                    disabled={hasUsedSerial}
                    onClick={() => {
                      setSettlementType('pending');
                      setPartialCollectedAmount('0');
                    }}
                    className={cn(
                      'p-2 rounded-lg border text-xs font-semibold transition-all text-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                      settlementType === 'pending'
                        ? 'bg-brand-crimson text-white border-brand-crimson font-bold shadow-2xs'
                        : 'border-border bg-surface text-muted hover:text-text'
                    )}
                  >
                    Pay Later (Credit)
                  </button>
                </div>

                {settlementType === 'partial' && (
                  <div className="pt-2 border-t border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="partial-collected" className="text-xs font-medium text-text">
                        Amount Collected Now (Advance / Token)
                      </label>
                      <span className="text-[11px] font-mono text-muted">
                        Bill: {formatCurrency(grandTotal)}
                      </span>
                    </div>
                    <Input
                      id="partial-collected"
                      type="number"
                      min="1"
                      max={grandTotal}
                      value={partialCollectedAmount}
                      onChange={(e) => setPartialCollectedAmount(e.target.value)}
                      placeholder="e.g. 10000"
                      className="font-mono text-sm font-bold"
                    />
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted">Balance Due (Credit):</span>
                      <span className="font-mono font-bold text-danger">
                        {formatCurrency(balanceDueAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {settlementType === 'pending' && (
                  <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>100% Pending / Credit (Udhaar) Bill</span>
                    </div>
                    <p className="text-[11px]">
                      No payment will be collected now. Full amount of <strong>{formatCurrency(grandTotal)}</strong> will remain outstanding on the customer account ledger.
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Mode Selector Tabs (Hidden if 100% pending) */}
              {settlementType !== 'pending' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('cash')}
                      className={cn(
                        'p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all',
                        paymentMode === 'cash'
                          ? 'border-accent bg-accent text-accent-fg shadow-2xs'
                          : 'border-border bg-surface text-muted hover:text-text hover:bg-surface-subtle'
                      )}
                    >
                      <Banknote size={18} />
                      <span>Cash Register</span>
                    </button>

                    <button
                      type="button"
                      disabled={hasUsedSerial}
                      onClick={() => setPaymentMode('upi')}
                      className={cn(
                        'p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                        paymentMode === 'upi'
                          ? 'border-accent bg-accent text-accent-fg shadow-2xs'
                          : 'border-border bg-surface text-muted hover:text-text hover:bg-surface-subtle'
                      )}
                    >
                      <QrCode size={18} />
                      <span>UPI / QR Scan</span>
                    </button>

                    <button
                      type="button"
                      disabled={hasUsedSerial}
                      onClick={() => setPaymentMode('card')}
                      className={cn(
                        'p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                        paymentMode === 'card'
                          ? 'border-accent bg-accent text-accent-fg shadow-2xs'
                          : 'border-border bg-surface text-muted hover:text-text hover:bg-surface-subtle'
                      )}
                    >
                      <CreditCard size={18} />
                      <span>Card / POS Swipe</span>
                    </button>

                    <button
                      type="button"
                      disabled={hasUsedSerial}
                      onClick={() => setPaymentMode('emi')}
                      className={cn(
                        'p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                        paymentMode === 'emi'
                          ? 'border-accent bg-accent text-accent-fg shadow-2xs'
                          : 'border-border bg-surface text-muted hover:text-text hover:bg-surface-subtle'
                      )}
                    >
                      <FileCheck2 size={18} />
                      <span>Consumer EMI</span>
                    </button>
                  </div>

                  {/* Mode-Specific Payment Inputs */}
                  {paymentMode === 'cash' && (
                    <div className="p-4 rounded-xl border border-border bg-surface-subtle space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text uppercase tracking-wider">
                          Cash Tender Calculator
                        </span>
                        <span className="text-[11px] text-muted font-mono">
                          Collect: {formatCurrency(targetCashAmount)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div>
                          <Input
                            id="pos-cash-tendered"
                            label="Cash Received From Customer (₹)"
                            type="number"
                            min="0"
                            value={cashTendered}
                            onChange={(e) => setCashTendered(e.target.value)}
                            placeholder={`e.g. ${targetCashAmount}`}
                            className="text-base font-mono font-bold"
                          />

                          {/* Quick Denomination Pills */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-xs">
                            <button
                              type="button"
                              onClick={() => setCashTendered(String(targetCashAmount))}
                              className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono hover:bg-surface-hover cursor-pointer"
                            >
                              Exact (₹{targetCashAmount})
                            </button>
                            {targetCashAmount < 500 && (
                              <button
                                type="button"
                                onClick={() => setCashTendered('500')}
                                className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono hover:bg-surface-hover cursor-pointer"
                              >
                                ₹500
                              </button>
                            )}
                            {targetCashAmount < 2000 && (
                              <button
                                type="button"
                                onClick={() => setCashTendered('2000')}
                                className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono hover:bg-surface-hover cursor-pointer"
                              >
                                ₹2,000
                              </button>
                            )}
                            {targetCashAmount < 5000 && (
                              <button
                                type="button"
                                onClick={() => setCashTendered(String(Math.ceil(targetCashAmount / 500) * 500))}
                                className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono hover:bg-surface-hover cursor-pointer"
                              >
                                Round Up
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Change Return Result Box */}
                        <div className="p-3.5 rounded-lg border border-border bg-surface text-center space-y-1">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted block">
                            Change Return to Customer
                          </span>
                          <div
                            className={cn(
                              'text-2xl font-bold font-mono',
                              changeDue > 0 ? 'text-brand-sage' : 'text-text'
                            )}
                          >
                            {formatCurrency(changeDue)}
                          </div>
                          <span className="text-[10px] text-muted block">
                            {cashReceivedNum >= targetCashAmount
                              ? 'Collect cash & return change'
                              : 'Awaiting cash receipt'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMode === 'upi' && (
                    <div className="p-4 rounded-xl border border-border bg-surface-subtle space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-text">
                        <QrCode size={15} className="text-brand-sage" />
                        <span>Instant UPI / QR Code Settlement</span>
                      </div>
                      <Input
                        id="pos-upi-ref"
                        label="UPI UTR / Bank Reference Number"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. 428901928374 (12-digit UTR)"
                        required
                      />
                      <p className="text-[11px] text-muted">
                        Ask customer to scan store QR for <strong>{formatCurrency(targetCashAmount)}</strong> and enter the 12-digit UTR.
                      </p>
                    </div>
                  )}

                  {paymentMode === 'card' && (
                    <div className="p-4 rounded-xl border border-border bg-surface-subtle space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-text">
                        <CreditCard size={15} className="text-purple-600" />
                        <span>Card POS Swipe Terminal</span>
                      </div>
                      <Input
                        id="pos-card-ref"
                        label="POS Authorization / Slip Number"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. TXN-948291 / AUTH-0482"
                        required
                      />
                      <p className="text-[11px] text-muted">
                        Swipe or tap customer card on EDC terminal for <strong>{formatCurrency(targetCashAmount)}</strong>.
                      </p>
                    </div>
                  )}

                  {paymentMode === 'emi' && (
                    <div className="p-4 rounded-xl border border-border bg-surface-subtle space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-text">
                        <FileCheck2 size={15} className="text-blue-600" />
                        <span>Financier Consumer Loan / EMI</span>
                      </div>
                      <Input
                        id="pos-emi-ref"
                        label="Financier Loan Approval / File ID"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. BAJAJ-DO-948291 / HDFC-F-0482"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              {/* Customer Delivery Confirmation */}
              <div className="p-3.5 rounded-xl border border-border bg-surface-subtle text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">Invoiced To:</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-brand-sage hover:underline cursor-pointer"
                  >
                    Edit Customer Info
                  </button>
                </div>
                <div className="text-text font-medium">
                  {customerName.trim() || 'Walk-in Customer (B2C)'}
                  {customerPhone && ` • ${customerPhone}`}
                </div>
                {customerAddress && (
                  <div className="text-[11px] text-muted">
                    <span className="font-semibold text-text">Address:</span> {customerAddress}
                  </div>
                )}
                {customerGstin && (
                  <div className="text-[11px] font-mono text-muted">
                    GSTIN: {customerGstin.toUpperCase()}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column (col-span-5): Final Financial Ledger Summary */}
          <div className="lg:col-span-5 space-y-5">
            <Card className="p-5 sm:p-6 rounded-xl border border-border bg-surface space-y-4 shadow-2xs">
              <div className="pb-3 border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                  ORDER SUMMARY
                </span>
                <h3 className="text-base font-semibold text-text mt-0.5">
                  Tax Invoice Settlement
                </h3>
              </div>

              {/* Item Lines Summary */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cart.map((it, idx) => {
                  const lineTotal = Math.round((it.selling_price || 0) * (it.quantity || 1) * (1 + (it.gst_rate || 0) / 100));

                  return (
                    <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-text text-sm truncate">{it.name}</div>
                        <div className="text-xs text-muted">
                          Qty: {it.quantity} × {formatCurrency(it.selling_price)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-sm sm:text-base text-text shrink-0">
                        {formatCurrency(lineTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Special Discount / Concession in Step 3 */}
              <div className="p-3.5 rounded-xl border border-border bg-surface-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
                    <Tag size={13} className="text-brand-sage shrink-0" />
                    <span>Special Discount / Concession</span>
                  </div>
                  {billDiscountAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setBillDiscountValue('')}
                      className="text-[10px] text-muted hover:text-danger cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setBillDiscountType('flat')}
                      className={cn(
                        'px-2.5 py-1 rounded-md cursor-pointer font-semibold transition-colors text-xs',
                        billDiscountType === 'flat' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-text'
                      )}
                    >
                      Flat ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillDiscountType('percent')}
                      className={cn(
                        'px-2.5 py-1 rounded-md cursor-pointer font-semibold transition-colors text-xs',
                        billDiscountType === 'percent' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-text'
                      )}
                    >
                      %
                    </button>
                  </div>

                  <input
                    type="number"
                    min="0"
                    placeholder={billDiscountType === 'flat' ? 'e.g. 500' : 'e.g. 5'}
                    value={billDiscountValue}
                    onChange={(e) => setBillDiscountValue(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text focus:outline-brand-sage text-right"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted">Quick:</span>
                  {(billDiscountType === 'flat' ? [100, 250, 500, 1000] : [2, 5, 10, 15]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBillDiscountValue(val.toString())}
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded border border-border hover:bg-surface transition-colors cursor-pointer font-mono font-medium',
                        billDiscountValue === val.toString()
                          ? 'bg-accent text-accent-fg font-bold border-accent'
                          : 'bg-surface text-muted hover:text-text'
                      )}
                    >
                      {billDiscountType === 'flat' ? `₹${val}` : `${val}%`}
                    </button>
                  ))}
                </div>

                {billDiscountAmount > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-brand-sage font-medium pt-1 border-t border-border/40">
                    <span>Discount Applied:</span>
                    <span className="font-mono">-{formatCurrency(billDiscountAmount)}</span>
                  </div>
                )}
              </div>

              {/* Ledger Breakdown */}
              <div className="space-y-2 pt-2 border-t border-border text-xs">
                <div className="flex items-center justify-between text-muted">
                  <span>Gross Total (MRP):</span>
                  <span className="font-mono text-text">{formatCurrency(grossTotal)}</span>
                </div>

                {billDiscountAmount > 0 && (
                  <div className="flex items-center justify-between text-brand-sage font-medium">
                    <span>Discount Savings:</span>
                    <span className="font-mono">-{formatCurrency(billDiscountAmount)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-muted">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono text-text">{formatCurrency(netTaxableSubtotal)}</span>
                </div>

                <div className="flex items-center justify-between text-muted">
                  <span>CGST (Central Tax):</span>
                  <span className="font-mono text-text">{formatCurrency(cgstAmount)}</span>
                </div>

                <div className="flex items-center justify-between text-muted">
                  <span>SGST (State Tax):</span>
                  <span className="font-mono text-text">{formatCurrency(sgstAmount)}</span>
                </div>

                {roundOff !== 0 && (
                  <div className="flex items-center justify-between text-muted text-[11px]">
                    <span>Round-off:</span>
                    <span className="font-mono">{roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}</span>
                  </div>
                )}

                {settlementType !== 'full' && (
                  <div className="pt-2 border-t border-border/50 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Collected Now:</span>
                      <span className="font-mono font-semibold text-brand-sage">
                        {formatCurrency(effectiveCollectedAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-danger font-semibold">Balance Due (Credit):</span>
                      <span className="font-mono font-bold text-danger">
                        {formatCurrency(balanceDueAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Total Payable Headline */}
              <div className="p-4 rounded-xl border border-border bg-surface-subtle text-center space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                  TOTAL AMOUNT PAYABLE
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-text tracking-tight">
                  {formatCurrency(grandTotal)}
                </div>
                <span className="text-xs text-muted block">
                  {settlementType === 'full' && 'Includes CGST + SGST (GST Invoice Ready)'}
                  {settlementType === 'partial' && `Token of ${formatCurrency(effectiveCollectedAmount)} collected now`}
                  {settlementType === 'pending' && '100% Credit / Unpaid — Account Receivable'}
                </span>
              </div>

              {/* Final Complete Sale & Print Action Button */}
              <div className="space-y-2 pt-2">
                <Button
                  size="lg"
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={cart.length === 0 || placeSaleMutation.isPending}
                  pending={placeSaleMutation.isPending}
                  className="w-full justify-center py-3.5 text-xs sm:text-sm font-semibold rounded-xl gap-2 shadow-2xs cursor-pointer"
                >
                  <Receipt size={16} />
                  <span>
                    {settlementType === 'full' && `Complete Sale & Print Bill (${formatCurrency(grandTotal)})`}
                    {settlementType === 'partial' && `Complete Sale (Collected ${formatCurrency(effectiveCollectedAmount)} • Due ${formatCurrency(balanceDueAmount)})`}
                    {settlementType === 'pending' && `Generate Credit Bill (${formatCurrency(grandTotal)} Due)`}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full justify-center text-xs font-medium rounded-lg gap-2 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Customer Details</span>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Serialized Unit Selector Modal */}
      {isUnitSelectorOpen && (
        <Modal
          isOpen={isUnitSelectorOpen}
          onClose={() => {
            setIsUnitSelectorOpen(false);
            setPendingProduct(null);
          }}
          title={
            pendingProduct ? (
              <div className="flex items-center gap-2">
                <Package size={16} className="text-brand-sage" />
                <span>Select Serial Number for {pendingProduct.name}</span>
              </div>
            ) : (
              'Select Product Unit'
            )
          }
          size="lg"
        >
          {unitsLoading ? (
            <div className="py-12 text-center text-xs text-muted">
              Scanning serial inventory database...
            </div>
          ) : unusedUnits.length === 0 && usedUnits.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <AlertCircle size={24} className="text-danger mx-auto" />
              <p className="text-xs font-semibold text-text">No serial numbers for this product</p>
              <p className="text-[11px] text-muted max-w-sm mx-auto">
                A serial number is required to bill an item. Create serial numbers for this product first.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/admin/${store?.code}/serials`)}
                className="text-xs font-medium rounded-md gap-1"
              >
                <Barcode size={12} />
                <span>Go to Serial Number</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-muted">
                A serial number is required. Choose the exact serial number scanned at the counter:
              </p>

              <UnitPickerGroup
                title="Unused Serial Numbers"
                caption="Any bill. Moves to used after this sale."
                units={unusedUnits}
                emptyText="No unused serial numbers left for this product."
                onSelect={handleSelectUnit}
              />

              <UnitPickerGroup
                title="Used Serial Numbers"
                caption="Cash bill only. Removed after this use."
                units={usedUnits}
                emptyText="No used serial numbers for this product."
                onSelect={handleSelectUnit}
                isUsed
              />
            </div>
          )}
        </Modal>
      )}

      {/* GST Tax Invoice Print Modal */}
      {completedInvoiceId && (
        <InvoicePrintModal
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            setCompletedInvoiceId(null);
          }}
          invoiceDetail={invoiceDetail}
        />
      )}
    </div>
  );
}

function UnitPickerGroup({ title, caption, units, emptyText, onSelect, isUsed = false }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
          {title}
          <Badge variant={isUsed ? 'warning' : 'success'} className="text-[10px] font-mono">
            {units.length}
          </Badge>
        </span>
        <span className="text-[11px] text-muted">{caption}</span>
      </div>

      {units.length === 0 ? (
        <div className="p-3 rounded-lg border border-dashed border-border text-[11px] text-muted text-center">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="p-3 flex items-center justify-between hover:bg-surface-subtle transition-colors text-xs"
            >
              <div>
                <div className={cn('font-mono font-semibold', isUsed ? 'text-muted' : 'text-text')}>
                  {unit.serial_number}
                </div>
                {unit.condition_grade && (
                  <div className="text-[10px] text-muted uppercase">Grade: {unit.condition_grade}</div>
                )}
              </div>

              <Button
                size="sm"
                variant={isUsed ? 'outline' : 'solid'}
                onClick={() => onSelect(unit)}
                className="text-xs font-medium rounded-md gap-1"
              >
                <Check size={12} />
                <span>{isUsed ? 'Use on Cash Bill' : 'Select Unit'}</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
