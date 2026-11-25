import { useState } from 'react';
import { 
  Calculator, 
  CreditCard, 
  CheckCircle2, 
  MessageCircle, 
  FileCheck, 
  Clock
} from 'lucide-react';
import { Container, Card } from '@/shared/ui';
import { motion } from '@/shared/motion';
import { formatCurrency } from '@/shared/lib/format';
import { SITE } from '@/shared/lib/site';

const PURCHASE_PRESETS = [15000, 30000, 50000, 75000, 100000];
const TENURES = [3, 6, 9, 12];

export function StoreEmiCalculatorSection({ initialAmount = null }) {
  const defaultAmount =
    initialAmount && Number(initialAmount) > 0
      ? Math.min(150000, Math.max(5000, Math.round(Number(initialAmount) / 500) * 500))
      : 35000;
  const [amount, setAmount] = useState(defaultAmount);
  const [tenure, setTenure] = useState(6);

  const monthlyInstallment = Math.round(amount / tenure);
  const totalPayable = amount; // 0% interest

  const inquiryUrl = `https://wa.me/${SITE.whatsappPhone}?text=${encodeURIComponent(
    `Hello Star Enterprises! I used your website EMI calculator. I am interested in purchasing products worth ${formatCurrency(amount)} with a ${tenure}-month 0% EMI plan. Please verify my finance eligibility with Bajaj Finserv / TVS Credit.`
  )}`;

  return (
    <section id="emi-calculator-section" className="py-10 sm:py-16 lg:py-20 border-b border-border bg-surface min-w-0 scroll-mt-14 sm:scroll-mt-16">
      <Container size="xl" className="space-y-5 sm:space-y-8">

        {/* Consistent Section Header */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-gold">
            FINANCE PARTNER
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-text">
            0% Paperless EMI
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-xl leading-relaxed">
            In-store finance with Bajaj Finserv, TVS Credit &amp; HDB. Aadhaar &amp; PAN only — 10-minute approval.
          </p>
        </div>

        {/* 2-Column Calculator & Step-by-Step Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start min-w-0">

          {/* Left: Interactive Calculator */}
          <div className="lg:col-span-7 min-w-0">
            <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 bg-bg border border-border rounded-xl sm:rounded-2xl shadow-2xs min-w-0">

              {/* Amount Slider */}
              <div className="space-y-2.5 sm:space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text uppercase tracking-wide">
                    Purchase Value
                  </span>
                  <span className="font-mono font-bold text-base sm:text-lg text-text">
                    {formatCurrency(amount)}
                  </span>
                </div>

                <input
                  type="range"
                  min="5000"
                  max="150000"
                  step="2500"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-2 bg-surface-subtle border border-border rounded-lg appearance-none cursor-pointer accent-brand-sage"
                  aria-label="Purchase Value Range"
                />

                {/* Quick Presets — horizontal strip on mobile */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pt-1 text-xs">
                  <span className="hidden sm:inline text-muted text-[11px] font-medium mr-1">Presets:</span>
                  {PURCHASE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`shrink-0 px-2.5 py-1 rounded-md border text-[11px] sm:text-xs font-mono font-medium transition-colors cursor-pointer ${
                        amount === preset
                          ? 'bg-text text-accent-fg border-text'
                          : 'bg-surface text-muted border-border hover:text-text'
                      }`}
                    >
                      {formatCurrency(preset)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenure Selection — single row 4-col on mobile */}
              <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-border">
                <div className="text-[11px] sm:text-xs font-semibold text-text uppercase tracking-wide">
                  Tenure (0% Interest)
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {TENURES.map((months) => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => setTenure(months)}
                      className={`py-2 px-1.5 sm:px-3 rounded-lg border text-center font-medium text-xs transition-all cursor-pointer ${
                        tenure === months
                          ? 'bg-brand-gold-subtle border-brand-gold-border text-brand-gold-text font-bold'
                          : 'bg-surface border-border text-muted hover:text-text hover:bg-surface-hover'
                      }`}
                    >
                      <div className="font-bold sm:hidden">{months}M</div>
                      <div className="font-bold hidden sm:block">{months} Months</div>
                      <div className="text-[10px] opacity-75 hidden sm:block">0% Interest</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Result Box — compact horizontal layout */}
              <div className="p-3.5 sm:p-5 rounded-xl bg-brand-gold-subtle border border-brand-gold-border flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] sm:text-xs text-brand-gold-text font-medium flex items-center gap-1.5">
                    <Calculator size={13} className="text-brand-gold shrink-0" />
                    <span>Monthly Installment</span>
                  </div>
                  <div className="text-xl sm:text-3xl font-extrabold font-mono text-text tracking-tight truncate">
                    {formatCurrency(monthlyInstallment)}
                    <span className="text-[11px] sm:text-xs font-normal text-muted font-sans ml-1">/ mo</span>
                  </div>
                </div>

                <div className="text-right text-[11px] sm:text-xs space-y-0.5 border-l border-brand-gold-border pl-3 sm:pl-4 shrink-0">
                  <div className="text-muted">Total ({tenure}M)</div>
                  <div className="font-mono font-bold text-text">{formatCurrency(totalPayable)}</div>
                  <div className="text-[10px] sm:text-[11px] text-brand-sage font-medium">₹0 Extra</div>
                </div>
              </div>

              {/* Compact 3-Step Strip on Mobile */}
              <div className="grid grid-cols-3 gap-1.5 sm:hidden text-center text-[10px] text-muted">
                <div className="p-2 rounded-lg bg-surface border border-border">
                  <div className="font-bold text-text">1. Select Item</div>
                  <div>₹5,000+ purchase</div>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border">
                  <div className="font-bold text-text">2. ID Docs</div>
                  <div>Aadhaar + PAN</div>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border">
                  <div className="font-bold text-brand-sage">3. Instant OK</div>
                  <div>10-min setup</div>
                </div>
              </div>

              {/* WhatsApp CTA */}
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <a
                  href={inquiryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-lg bg-text text-accent-fg hover:bg-accent text-xs sm:text-sm font-bold transition-colors text-center"
                >
                  <MessageCircle size={15} className="shrink-0" />
                  <span>Check 0% EMI on WhatsApp</span>
                </a>
              </motion.div>
            </div>
          </div>

          {/* Right: Full Step-by-Step Process (sm+ viewports) */}
          <div className="hidden sm:block lg:col-span-5 space-y-4 sm:space-y-5 min-w-0">
            <Card className="p-5 sm:p-6 space-y-5 bg-bg border border-border rounded-2xl shadow-2xs min-w-0">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-xs font-bold text-text uppercase tracking-wider">
                  How 0% In-Store Financing Works
                </span>
                <span className="text-[11px] font-semibold text-brand-sage bg-brand-sage-subtle px-2 py-0.5 rounded border border-brand-sage-border shrink-0">
                  10-Min Approval
                </span>
              </div>

              {/* 3 Steps */}
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-crimson-subtle border border-brand-crimson-border text-brand-crimson font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-0.5 text-xs min-w-0">
                    <div className="font-bold text-text">Choose Your Products</div>
                    <div className="text-muted leading-relaxed">
                      Pick any sofa, AC, refrigerator, or phone above ₹5,000 at our showroom.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-gold-subtle border border-brand-gold-border text-brand-gold font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-0.5 text-xs min-w-0">
                    <div className="font-bold text-text">Present Aadhaar &amp; PAN</div>
                    <div className="text-muted leading-relaxed">
                      No paper forms or bank statements needed. Instant OTP verification with Bajaj or TVS.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-sage-subtle border border-brand-sage-border text-brand-sage font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-0.5 text-xs min-w-0">
                    <div className="font-bold text-text">Same-Day Delivery &amp; Setup</div>
                    <div className="text-muted leading-relaxed">
                      Sign digitally and get free delivery and technician assembly across Bhusawal.
                    </div>
                  </div>
                </div>
              </div>

              {/* Required Docs */}
              <div className="p-3 rounded-lg bg-surface-subtle border border-border space-y-1.5 text-xs">
                <div className="font-semibold text-text flex items-center gap-1.5">
                  <FileCheck size={14} className="text-brand-sage shrink-0" />
                  <span>Required for Instant Approval</span>
                </div>
                <div className="text-muted text-[11px] leading-relaxed">
                  Active Indian PAN Card • Aadhaar linked with mobile number • Net banking / Debit card for auto-debit setup.
                </div>
              </div>

              {/* Partners */}
              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <div className="flex items-center gap-1.5 font-medium text-text">
                  <CreditCard size={14} className="text-brand-gold shrink-0" />
                  <span>Bajaj Finserv • TVS Credit • HDB</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <Clock size={12} className="shrink-0" />
                  <span>10:00 AM – 10:00 PM</span>
                </div>
              </div>
            </Card>

            {/* Trust guarantee */}
            <div className="p-4 rounded-2xl border border-border bg-bg flex items-center gap-3 text-xs shadow-2xs">
              <CheckCircle2 size={18} className="text-brand-sage shrink-0" />
              <div className="text-muted leading-relaxed">
                <strong className="text-text font-semibold">100% Transparent:</strong> No upfront security deposits. All EMI terms and cashback benefits are printed on your official GST invoice.
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
