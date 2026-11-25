import {
  CreditCard,
  ShieldCheck,
  Truck,
  MapPin,
  MessageCircle,
  Calculator,
  Store,
  ArrowUpRight,
} from 'lucide-react';
import { Container, Button } from '@/shared/ui';
import { motion } from '@/shared/motion';
import { SITE } from '@/shared/lib/site';
import { FlipWords } from '@/components/ui/flip-words';

const HERO_WORDS = ['Enterprises', 'Furniture', 'Electronics', 'Smartphones'];

/**
 * @param {Object} props
 * @param {() => void} props.onExploreCatalog
 * @param {() => void} [props.onOpenCalculator]
 */
export function StoreHeroShowcase({ onExploreCatalog, onOpenCalculator }) {
  const whatsappUrl = `https://wa.me/${SITE.whatsappPhone}?text=${encodeURIComponent(
    'Hello Star Enterprises! I am visiting your store website and would like to inquire about product availability and 0% EMI financing.'
  )}`;

  return (
    <section className="lg:min-h-[calc(100dvh-4rem)] lg:flex lg:flex-col lg:justify-center border-b border-border bg-bg min-w-0">

      {/* ── Main hero body ── */}
      <div className="pt-5 pb-8 sm:py-14 lg:py-20">
        <Container size="xl" className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-center min-w-0">

            {/* ── Left: Minimal Typography & Core CTA column ── */}
            <div className="flex flex-col gap-4 sm:gap-6 min-w-0">

              {/* Eyebrow — city + store type */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="w-4 sm:w-6 h-px bg-brand-crimson shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-brand-crimson">
                  Bhusawal · Est. 2013
                </span>
              </div>

              {/* Master headline */}
              <div className="space-y-1 min-w-0">
                <h1 className="text-[clamp(2.25rem,8vw,5.5rem)] font-black tracking-tight leading-[0.95] text-brand-crimson">
                  STAR
                </h1>
                <div className="text-[clamp(1.5rem,5vw,3.2rem)] font-black tracking-tight leading-tight text-text overflow-x-clip max-w-full">
                  <FlipWords
                    words={HERO_WORDS}
                    className="px-0 text-text font-black tracking-tight"
                  />
                </div>
                {/* Gold rule with tagline */}
                <div className="flex items-center gap-2 sm:gap-3 pt-1.5 sm:pt-3 min-w-0">
                  <span className="h-px flex-1 bg-brand-gold/40 min-w-4" />
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.18em] text-brand-gold text-center">
                    Furniture · Electronics · Mobiles
                  </span>
                  <span className="h-px flex-1 bg-brand-gold/40 min-w-4" />
                </div>
              </div>

              {/* Description — crisp concise summary */}
              <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-md">
                Showroom near Reliance Smart Bazar, Khadka Road. Sofas, ACs, fridges &amp; certified smartphones with official GST warranty and 0% paperless EMI.
              </p>

              {/* Action buttons — compact 2-col row on mobile, inline flex on sm+ */}
              <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                <Button
                  variant="solid"
                  size="md"
                  onClick={onExploreCatalog}
                  className="cursor-pointer font-bold px-4 sm:px-7 py-2.5 sm:py-3 bg-text text-accent-fg hover:bg-accent text-xs sm:text-sm rounded-lg justify-center"
                >
                  Browse Catalog
                </Button>

                {onOpenCalculator && (
                  <button
                    type="button"
                    onClick={onOpenCalculator}
                    className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-border bg-surface text-text hover:border-brand-gold hover:text-brand-gold text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <Calculator size={14} className="text-brand-gold shrink-0" />
                    <span className="sm:hidden">0% EMI</span>
                    <span className="hidden sm:inline">0% EMI Calculator</span>
                  </button>
                )}

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand-sage transition-colors font-medium px-1"
                >
                  <MessageCircle size={14} className="text-brand-sage" />
                  <span>WhatsApp Inquiry</span>
                </a>
              </div>

              {/* ── Trust stats — clean 2x2 grid across all viewports ── */}
              <div className="pt-3 border-t border-border grid grid-cols-2 gap-x-3 sm:gap-x-6 gap-y-2 sm:gap-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-text min-w-0">
                  <CreditCard size={14} className="text-brand-gold shrink-0" />
                  <span className="truncate">0% Bajaj &amp; TVS EMI</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-text min-w-0">
                  <ShieldCheck size={14} className="text-brand-crimson shrink-0" />
                  <span className="truncate">Brand Warranty</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-text min-w-0">
                  <Truck size={14} className="text-brand-sage shrink-0" />
                  <span className="truncate">Free Doorstep Setup</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-text min-w-0">
                  <MapPin size={14} className="text-brand-crimson shrink-0" />
                  <span className="truncate">Near Reliance Smart</span>
                </div>
              </div>
            </div>

            {/* ── Right: Flagship Showroom Hero Visual ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl sm:rounded-2xl overflow-hidden border border-border bg-surface shadow-2xs min-w-0"
            >
              <div className="relative aspect-[16/10] sm:aspect-video w-full bg-surface-subtle">
                <img
                  src="/images/storePic.jpeg"
                  alt="Star Enterprises Flagship Showroom — Khadka Road, Bhusawal"
                  className="w-full h-full object-cover block"
                  loading="eager"
                />

                {/* Top status overlay (desktop) */}
                <div className="hidden sm:flex absolute top-3 inset-x-3 items-center justify-between gap-2 pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/95 border border-border text-xs font-semibold text-text shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-brand-sage shrink-0" />
                    <span>Open 7 Days · 10 AM – 10 PM</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/95 border border-border text-xs font-semibold text-brand-crimson shadow-xs">
                    <Store size={13} className="shrink-0" />
                    <span>Flagship Showroom</span>
                  </div>
                </div>

                {/* Bottom location & direction strip overlay (desktop) */}
                <div className="hidden sm:flex absolute bottom-3 inset-x-3 items-center justify-between gap-2 pointer-events-auto">
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface/95 border border-border text-xs font-medium text-text shadow-xs truncate">
                    <MapPin size={13} className="text-brand-crimson shrink-0" />
                    <span className="truncate">Near Reliance Smart Bazar, Khadka Road</span>
                  </div>

                  <a
                    href="https://maps.google.com/?q=Reliance+Smart+Bazar+Khadka+Road+Bhusawal+425201"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-text text-accent-fg hover:bg-accent text-xs font-semibold transition-colors shadow-xs shrink-0"
                  >
                    <span>Directions</span>
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>

              {/* Clean docked bar below photo on mobile so image signage stays uncluttered */}
              <div className="sm:hidden px-3 py-2.5 bg-surface border-t border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-sage shrink-0" />
                    <span>Open Daily · 10 AM – 10 PM</span>
                  </div>
                  <div className="text-[11px] text-muted truncate mt-0.5">
                    Khadka Road, Near Reliance Smart Bazar
                  </div>
                </div>

                <a
                  href="https://maps.google.com/?q=Reliance+Smart+Bazar+Khadka+Road+Bhusawal+425201"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-text text-accent-fg text-[11px] font-semibold shrink-0"
                >
                  <span>Directions</span>
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </motion.div>
          </div>
        </Container>
      </div>
    </section>
  );
}
