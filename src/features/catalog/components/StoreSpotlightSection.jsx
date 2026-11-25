import { 
  MapPin, 
  Clock, 
  Phone, 
  CreditCard, 
  CheckCircle2, 
  MessageCircle, 
  ExternalLink 
} from 'lucide-react';
import { Container } from '@/shared/ui';
import { SITE } from '@/shared/lib/site';

export function StoreSpotlightSection() {
  const mapsUrl = 'https://maps.google.com/?q=Reliance+Smart+Bazar+Khadka+Road+Bhusawal+425201';
  const whatsappUrl = `https://wa.me/${SITE.whatsappPhone}?text=${encodeURIComponent(
    'Hello Star Enterprises! I would like to check my 0% EMI finance eligibility with Bajaj Finserv / TVS Credit.'
  )}`;

  return (
    <section id="showroom-section" className="py-10 sm:py-16 lg:py-20 border-b border-border bg-bg min-w-0 scroll-mt-14 sm:scroll-mt-16">
      <Container size="xl" className="space-y-5 sm:space-y-8">

        {/* Consistent Section Header */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-sage">
            SHOWROOM &amp; SERVICES
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-text">
            Visit Us in Bhusawal
          </h2>
          <p className="hidden sm:block text-sm text-muted max-w-xl leading-relaxed">
            Test furniture comfort and live appliance displays in person, or get instant paperless financing on any purchase above ₹5,000.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6 min-w-0">

          {/* Showroom Visit Panel */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-surface border border-border rounded-xl sm:rounded-2xl flex flex-col justify-between shadow-2xs min-w-0">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-border">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
                  Flagship Showroom
                </span>
                <span className="text-[11px] font-medium text-text bg-bg px-2 py-0.5 rounded border border-border">
                  Open 7 Days
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-text">Near Reliance Smart Bazar, Bhusawal</h3>
                <p className="hidden sm:block text-xs text-muted mt-1 leading-relaxed">
                  Khadka Road, near Reliance Smart Bazar, Bhusawal, Maharashtra 425201. Over 2,500 sq.ft showroom featuring hall sofas, dining sets, refrigerators, split ACs, and certified smartphones.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-muted">
                  <Clock size={14} className="text-brand-sage shrink-0" />
                  <span>Timings: <strong className="text-text font-medium">10:00 AM – 10:00 PM</strong> (Daily)</span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <MapPin size={14} className="text-brand-sage shrink-0" />
                  <span>Khadka Road, <strong className="text-text font-medium">next to Reliance Smart Bazar</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Phone size={14} className="text-brand-sage shrink-0" />
                  <span>Helpline: <strong className="text-text font-mono font-medium">{SITE.displayPhone}</strong></span>
                </div>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-border grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-text text-accent-fg hover:bg-accent text-xs font-semibold transition-colors"
              >
                <ExternalLink size={13} /> Google Maps
              </a>

              <a
                href={`tel:${SITE.supportPhone}`}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-surface border border-border text-text hover:bg-surface-subtle text-xs font-medium transition-colors"
              >
                <Phone size={13} /> Call Store
              </a>
            </div>
          </div>

          {/* 0% EMI Finance Panel */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-surface border border-border rounded-xl sm:rounded-2xl flex flex-col justify-between shadow-2xs min-w-0">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-border">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
                  All Finance Available
                </span>
                <span className="text-[11px] font-medium text-brand-gold-text bg-brand-gold-subtle px-2 py-0.5 rounded border border-brand-gold-border">
                  0% Interest
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-text">Instant 10-Minute Paperless Approvals</h3>
                <p className="hidden sm:block text-xs text-muted mt-1 leading-relaxed">
                  Official in-store financing with Bajaj Finserv, TVS Credit, and HDB Financial Services. Zero down payment options with tenures from 3 to 12 months.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-muted">
                  <CheckCircle2 size={14} className="text-brand-sage shrink-0" />
                  <span><strong className="text-text font-medium">Bajaj Finserv • TVS Credit • HDB</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <CheckCircle2 size={14} className="text-brand-sage shrink-0" />
                  <span>Docs: <strong className="text-text font-medium">Aadhaar + PAN Card Only</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <CreditCard size={14} className="text-brand-sage shrink-0" />
                  <span>Orders from <strong className="text-text font-medium">₹5,000 to ₹1,50,000</strong></span>
                </div>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-border">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-border bg-bg text-text hover:bg-surface-subtle text-xs font-semibold transition-colors"
              >
                <MessageCircle size={14} className="text-brand-sage" /> Check EMI Eligibility on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
