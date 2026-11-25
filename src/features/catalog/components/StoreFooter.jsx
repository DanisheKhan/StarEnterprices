import { Link } from 'react-router-dom';
import { MapPin, Phone, ShieldCheck, Shield, MessageCircle } from 'lucide-react';
import { Container } from '@/shared/ui';
import { SITE } from '@/shared/lib/site';

/**
 * @param {Object} props
 * @param {(categorySlug: string, storeCode: string) => void} [props.onSelectCategory]
 */
export function StoreFooter({ onSelectCategory }) {
  return (
    <footer className="bg-accent text-accent-fg min-w-0">
      <Container size="xl" className="py-10 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 min-w-0">

          {/* Column 1: Brand + Address */}
          <div className="space-y-3.5 sm:space-y-4">
            {/* Logo on dark bg */}
            <div>
              <div className="flex items-center gap-0 font-black tracking-tight text-base leading-none">
                <span className="text-brand-crimson font-black">STAR</span>
                <span className="text-white font-black ml-1">ENTERPRISES</span>
              </div>
              <div className="text-xs text-white/50 font-medium mt-1">
                Flagship Retail Showroom • Bhusawal
              </div>
            </div>

            <p className="hidden sm:block text-xs text-white/60 leading-relaxed">
              Hallmark living furniture, inverter appliances, and certified smartphones with direct showroom pricing and instant 0% EMI financing.
            </p>

            <div className="space-y-2 text-xs text-white/60">
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-brand-sage shrink-0 mt-0.5" />
                <span>{SITE.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-brand-sage shrink-0" />
                <span className="font-mono">{SITE.displayPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={13} className="text-brand-sage shrink-0" />
                <span className="font-mono">GSTIN: {SITE.gstin}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Departments */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/80">
              Departments
            </h4>
            <ul className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-2 text-xs text-white/55">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('living-room-furniture', 'furniture-electronics')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Hall Furniture
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('refrigerators', 'furniture-electronics')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Refrigerators
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('', 'furniture-electronics')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Home Electronics
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('washing-machines', 'furniture-electronics')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Washing Machines
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('smartphones', 'mobiles')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Smartphones
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Services (sm+) */}
          <div className="hidden sm:block space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/80">
              Services
            </h4>
            <ul className="space-y-2.5 text-xs text-white/55">
              <li>0% EMI with Bajaj &amp; TVS</li>
              <li>Free Doorstep Assembly</li>
              <li>Official GST Input Invoicing</li>
              <li>Manufacturer Brand Warranty</li>
              <li>Certified Pre-Owned Guarantee</li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/80">
              Showroom Support
            </h4>
            <p className="text-xs text-white/55 leading-relaxed">
              Open 7 days: 10:00 AM – 10:00 PM. Message us directly on WhatsApp for stock or 0% EMI help.
            </p>
            <div>
              <a
                href={`https://wa.me/${SITE.whatsappPhone}?text=${encodeURIComponent('Hello Star Enterprises, I would like to inquire about current store offers.')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 text-xs font-semibold transition-colors"
              >
                <MessageCircle size={14} /> WhatsApp Store Chat
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 mt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
          <span>Bajaj Finserv • TVS Credit • HDB Financial</span>

          <div className="flex items-center gap-4 sm:gap-5">
            <span>© {new Date().getFullYear()} Star Enterprises</span>
            <Link
              to="/login"
              className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
              title="Authorized Personnel Console"
            >
              <Shield size={12} />
              <span>Owner Portal</span>
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
