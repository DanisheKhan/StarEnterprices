import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Container } from '@/shared/ui';

const FAQS = [
  {
    q: 'How does 0% EMI work with Bajaj Finserv, TVS Credit, and HDB?',
    a: 'We offer zero-interest financing on all purchases above ₹5,000. Simply bring your Aadhaar Card, PAN Card, and bank details to our showroom desk. Approval is completed biometrically in under 10 minutes with flexible 3, 6, 9, or 12-month tenures and zero down payment options.',
  },
  {
    q: 'Do you provide home delivery and furniture assembly in Bhusawal and surrounding areas?',
    a: 'Yes! We provide same-day or scheduled doorstep delivery across Bhusawal, Jalgaon, Varangaon, and surrounding regions. In-house technicians assemble all beds, sofas, and dining sets at your home without extra charges.',
  },
  {
    q: 'Are all electronics and appliances covered by official brand warranty?',
    a: 'Yes, 100%. Every air conditioner, refrigerator, television, and washing machine sold at Star Enterprises is backed by official manufacturer on-site warranties (e.g. 10-year compressor warranties on LG/Haier refrigerators and 2-year on Sony/Samsung TVs).',
  },
  {
    q: 'Can I get a GST invoice with Input Tax Credit (ITC) for my business or office?',
    a: 'Yes. Star Enterprises is registered under GSTIN 27AATPQ6775F1ZV. We provide official tax invoices with your business GSTIN and HSN codes, allowing full Input Tax Credit claims.',
  },
];

export function StoreFaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  function toggle(idx) {
    setOpenIndex(openIndex === idx ? -1 : idx);
  }

  return (
    <section className="py-10 sm:py-16 lg:py-20 border-b border-border bg-bg min-w-0">
      <Container size="xl">
        <div className="max-w-3xl mx-auto space-y-5 sm:space-y-8">

          {/* Consistent Section Header — centered */}
          <div className="text-center space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-crimson">
              FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-text">
              Frequently Asked Questions
            </h2>
            <p className="hidden sm:block text-sm text-muted">
              Everything you need to know before visiting our showroom.
            </p>
          </div>

          {/* Accordion Cards */}
          <div className="space-y-2.5 sm:space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={faq.q}
                  className="overflow-hidden border border-border bg-surface rounded-xl sm:rounded-2xl transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 cursor-pointer focus:outline-none"
                  >
                    <span className="text-xs sm:text-sm font-semibold text-text leading-snug">
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-muted shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-brand-sage' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-muted leading-relaxed border-t border-border">
                      <p className="pt-3">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
