import { Star, ShieldCheck } from 'lucide-react';
import { Container } from '@/shared/ui';

const REVIEWS = [
  {
    id: 1,
    name: 'Farhan Ansari',
    location: 'Khadka Road, Bhusawal',
    product: '7-Seater Hall L-Shape Sofa & Haier Double Door Fridge',
    rating: 5,
    date: '2 weeks ago',
    comment:
      'Furnished our new flat completely from Star Enterprises. Saved almost ₹14,000 compared to other stores in Jalgaon, and their team delivered and assembled everything the very same evening. Top notch fabric quality!',
  },
  {
    id: 2,
    name: 'Siddharth Patil',
    location: 'Jamner Road, Bhusawal',
    product: 'Apple iPhone 15 & 20W Fast Charger',
    rating: 5,
    date: '1 month ago',
    comment:
      'Got 0% paperless EMI with Bajaj Finserv right at the counter. The staff did the paperwork in under 10 minutes with just my Aadhaar OTP. 100% genuine sealed box with Apple India warranty.',
  },
  {
    id: 3,
    name: 'Aamir Momin',
    location: 'Station Road, Bhusawal',
    product: 'Lloyd 1.5 Ton 5-Star Inverter AC',
    rating: 5,
    date: '3 weeks ago',
    comment:
      'Being right next to Reliance Smart Bazar makes visiting very convenient. Tested the cooling in person at the showroom. Delivery and installation technician arrived next morning with official GST bill.',
  },
];

export function StoreReviewsSection() {
  return (
    <section id="reviews-section" className="py-10 sm:py-16 lg:py-20 border-b border-border bg-surface min-w-0 scroll-mt-14 sm:scroll-mt-16">
      <Container size="xl" className="space-y-5 sm:space-y-8">

        {/* Consistent Section Header with Rating Badge */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-6 min-w-0">
          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-sage">
              VERIFIED REVIEWS
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-text">
              Trusted by Bhusawal Families
            </h2>
            <p className="hidden sm:block text-sm text-muted max-w-xl leading-relaxed">
              Real experiences from real customers who visited our Khadka Road showroom.
            </p>
          </div>

          {/* Aggregate Rating Badge */}
          <div className="inline-flex self-start items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-bg border border-border shadow-2xs shrink-0">
            <div className="flex items-center gap-0.5 text-brand-gold">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={13} className="fill-brand-gold" />
              ))}
            </div>
            <span className="text-xs sm:text-sm font-bold text-text">4.9 / 5.0</span>
            <span className="text-[11px] sm:text-xs text-muted border-l border-border pl-2 sm:pl-3">
              500+ Deliveries
            </span>
          </div>
        </div>

        {/* Horizontal Snap Strip on Mobile, 3-Col Grid on Desktop */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-1 -mx-4 px-4 no-scrollbar md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible min-w-0">
          {REVIEWS.map((review) => (
            <div
              key={review.id}
              className="w-72 sm:w-80 md:w-auto shrink-0 snap-start p-4 sm:p-6 flex flex-col justify-between space-y-3 sm:space-y-4 bg-bg border border-border rounded-xl sm:rounded-2xl shadow-2xs min-w-0"
            >
              <div className="space-y-2.5 sm:space-y-3 min-w-0">
                <div className="hidden sm:block text-4xl font-black text-brand-gold/30 leading-none select-none">"</div>

                {/* Stars & Verified */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 text-brand-gold">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} size={12} className="fill-brand-gold text-brand-gold" />
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-sage bg-brand-sage-subtle px-2 py-0.5 rounded border border-brand-sage-border">
                    <ShieldCheck size={10} /> Verified
                  </span>
                </div>

                {/* Review Text */}
                <p className="text-xs text-muted leading-relaxed line-clamp-4 sm:line-clamp-none">
                  {review.comment}
                </p>
              </div>

              {/* Reviewer Details */}
              <div className="pt-2.5 sm:pt-3 border-t border-border space-y-0.5">
                <div className="flex items-center justify-between text-xs font-bold text-text">
                  <span>{review.name}</span>
                  <span className="text-[10px] font-normal text-muted">{review.date}</span>
                </div>
                <div className="text-[11px] text-muted truncate">
                  {review.location}
                </div>
                <div className="text-[10px] text-brand-sage font-medium truncate pt-0.5">
                  {review.product}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
