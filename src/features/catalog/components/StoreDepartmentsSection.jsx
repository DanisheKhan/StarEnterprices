import { 
  Armchair, 
  Wind, 
  Refrigerator, 
  Smartphone, 
  ArrowRight
} from 'lucide-react';
import { Container } from '@/shared/ui';
import { motion } from '@/shared/motion';

/**
 * @param {Object} props
 * @param {(categorySlug: string, storeCode?: string) => void} props.onSelectDepartment
 */
export function StoreDepartmentsSection({ onSelectDepartment }) {
  const departments = [
    {
      id: 'furniture',
      title: 'Hall & Living Furniture',
      subtitle: 'L-shape sofas, 6-seater dining sets, fabric recliners & wooden wardrobes.',
      icon: Armchair,
      storeCode: 'furniture-electronics',
      categorySlug: 'living-room-furniture',
      tag: 'Best Quality & Comfort',
      accentColor: 'text-brand-crimson',
      iconBg: 'bg-brand-crimson-subtle border-brand-crimson-border',
      itemsCount: 'Sofa, Dining & Recliners',
    },
    {
      id: 'cooling',
      title: 'Inverter ACs & Coolers',
      subtitle: 'Lloyd 5-Star split ACs, Symphony 70L heavy-duty desert coolers & fans.',
      icon: Wind,
      storeCode: 'furniture-electronics',
      categorySlug: '',
      tag: 'Free Standard Delivery',
      accentColor: 'text-brand-sage',
      iconBg: 'bg-brand-sage-subtle border-brand-sage-border',
      itemsCount: 'All Top Brands in Stock',
    },
    {
      id: 'appliances',
      title: 'Refrigerators & Washers',
      subtitle: 'Haier floral double-door refrigerators, top-load automatic washing machines.',
      icon: Refrigerator,
      storeCode: 'furniture-electronics',
      categorySlug: 'refrigerators',
      tag: '10-Yr Compressor Warranty',
      accentColor: 'text-brand-sage',
      iconBg: 'bg-brand-sage-subtle border-brand-sage-border',
      itemsCount: 'Kitchen & Home Essentials',
    },
    {
      id: 'mobiles',
      title: 'Smartphones & Mobiles',
      subtitle: 'Apple certified iPhones, OnePlus 5G, Samsung Galaxy, AirPods & chargers.',
      icon: Smartphone,
      storeCode: 'mobiles',
      categorySlug: 'smartphones',
      tag: 'Instant 0% Paperless EMI',
      accentColor: 'text-brand-gold',
      iconBg: 'bg-brand-gold-subtle border-brand-gold-border',
      itemsCount: 'Brand New & Certified',
    },
  ];

  return (
    <section id="departments-section" className="py-10 sm:py-16 lg:py-20 border-b border-border bg-bg min-w-0 scroll-mt-14 sm:scroll-mt-16">
      <Container size="xl" className="space-y-5 sm:space-y-8">

        {/* Consistent Section Header */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-crimson">
            SHOWROOM DEPARTMENTS
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-text">
            Shop by Category
          </h2>
          <p className="hidden sm:block text-sm text-muted max-w-xl leading-relaxed">
            Everything for your home under one roof. Inspect real floor models at our Bhusawal showroom with direct warranty.
          </p>
        </div>

        {/* 2x2 Minimal Grid on Mobile, 4-Col Grid on Desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5 min-w-0">
          {departments.map((dept) => {
            const Icon = dept.icon;
            return (
              <motion.button
                type="button"
                key={dept.id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                onClick={() => onSelectDepartment(dept.categorySlug, dept.storeCode)}
                className="text-left p-3.5 sm:p-5 flex flex-col justify-between h-full bg-surface border border-border rounded-xl sm:rounded-2xl hover:border-border-strong cursor-pointer transition-all shadow-2xs group min-w-0"
              >
                <div className="space-y-2.5 sm:space-y-4 min-w-0">
                  {/* Icon */}
                  <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl border flex items-center justify-center ${dept.iconBg} ${dept.accentColor}`}>
                    <Icon size={18} className="sm:hidden" />
                    <Icon size={22} className="hidden sm:block" />
                  </div>

                  {/* Title & Subtitle */}
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-xs sm:text-base font-bold text-text leading-snug">
                      {dept.title}
                    </h3>
                    <p className="hidden sm:block text-xs text-muted leading-relaxed line-clamp-2">
                      {dept.subtitle}
                    </p>
                  </div>

                  {/* Tag label (desktop) */}
                  <span className="hidden sm:inline-block text-[11px] font-medium text-muted">
                    {dept.tag}
                  </span>
                </div>

                {/* Action bar */}
                <div className="pt-2.5 sm:pt-4 mt-2.5 sm:mt-3 border-t border-border flex items-center justify-between text-xs w-full">
                  <span className="hidden sm:inline text-[11px] font-medium text-muted truncate pr-2">
                    {dept.itemsCount}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-brand-sage group-hover:underline">
                    <span>Explore</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
