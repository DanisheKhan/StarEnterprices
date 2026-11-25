import { useState, useMemo, useDeferredValue } from 'react';
import { Container, Button, Input } from '@/shared/ui';
import { Seo } from '@/shared/seo';
import { motion } from '@/shared/motion';
import { usePublicProducts, useCart } from '../hooks/useCatalog';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { StoreHeroShowcase } from '../components/StoreHeroShowcase';
import { StoreBrandsStrip } from '../components/StoreBrandsStrip';
import { StoreDepartmentsSection } from '../components/StoreDepartmentsSection';
import { StoreEmiCalculatorSection } from '../components/StoreEmiCalculatorSection';
import { StoreSpotlightSection } from '../components/StoreSpotlightSection';
import { StoreFaqSection } from '../components/StoreFaqSection';
import { StoreFooter } from '../components/StoreFooter';
import { formatCurrency } from '@/shared/lib/format';
import { SITE } from '@/shared/lib/site';
import {
  Smartphone,
  Tv,
  Search,
  ShoppingBag,
  Eye,
  Check,
  Layers,
  SlidersHorizontal,
  MessageCircle,
  Phone,
} from 'lucide-react';

export function PublicHomePage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeModalProduct, setActiveModalProduct] = useState(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [emiPresetAmount, setEmiPresetAmount] = useState(null);

  const { addToCart } = useCart();
  const { data: allProducts = [], isLoading } = usePublicProducts();

  // Unique categories derived from current products scoped to selected store
  const availableCategories = useMemo(() => {
    const map = new Map();
    allProducts.forEach((p) => {
      if (selectedStore !== 'all' && p.stores?.code !== selectedStore) {
        return;
      }
      if (p.categories?.slug && p.categories?.name) {
        map.set(p.categories.slug, p.categories.name);
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [allProducts, selectedStore]);

  // Instant local filtering and sorting
  const products = useMemo(() => {
    let list = [...allProducts];

    if (selectedStore && selectedStore !== 'all') {
      list = list.filter((p) => p.stores?.code === selectedStore);
    }
    if (selectedCategory) {
      list = list.filter((p) => p.categories?.slug === selectedCategory);
    }
    if (inStockOnly) {
      list = list.filter((p) => (p.inventory?.[0]?.quantity_on_hand ?? 0) > 0);
    }
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.brands?.name?.toLowerCase().includes(q) ||
          p.categories?.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    // Sort order
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.selling_price - b.selling_price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.selling_price - a.selling_price);
    } else if (sortBy === 'discount') {
      list.sort((a, b) => {
        const discA = (a.mrp || a.selling_price) - a.selling_price;
        const discB = (b.mrp || b.selling_price) - b.selling_price;
        return discB - discA;
      });
    }

    return list;
  }, [allProducts, selectedStore, selectedCategory, deferredSearch, inStockOnly, sortBy]);

  // Display only 6 products initially with a "View All" toggle button
  const visibleProducts = useMemo(() => {
    return showAllProducts ? products : products.slice(0, 6);
  }, [products, showAllProducts]);

  function handleAddToCart(e, product) {
    e.stopPropagation();
    const stockQty = product.inventory?.[0]?.quantity_on_hand ?? 0;
    if (stockQty <= 0) return;
    addToCart(product, 1);
    setRecentlyAddedId(product.id);
    setTimeout(() => setRecentlyAddedId(null), 1800);
  }

  function handleAskAvailability(e, product, finalPrice) {
    e.stopPropagation();
    const text = encodeURIComponent(
      `Hello Star Enterprises, I checked *${product.name}* (SKU: ${product.sku}, Final Showroom Price: ${formatCurrency(finalPrice)} Incl. GST) on your website. When will stock be available?`
    );
    window.open(`https://wa.me/${SITE.whatsappPhone}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function handleSelectCategory(categorySlug, storeCode) {
    if (storeCode) setSelectedStore(storeCode);
    setSelectedCategory(categorySlug || '');
    scrollToCatalog();
  }

  function scrollToCatalog() {
    const el = document.getElementById('catalog-grid-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollToCalculator() {
    const el = document.getElementById('emi-calculator-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="min-w-0 flex flex-col bg-bg text-text pb-20 sm:pb-0">
      <Seo
        title="Star Enterprises — Hall Furniture, Electronics & Mobiles | Bhusawal Flagship"
        description="Bhusawal’s flagship showroom near Reliance Smart Bazar on Khadka Road. Hallmark living furniture, inverter ACs, double-door refrigerators, washing machines, and certified smartphones with 0% EMI financing and GST billing."
        path="/"
      />

      {/* 1. Full-Height Hero Section (Shift other sections beneath the initial fold) */}
      <StoreHeroShowcase
        onExploreCatalog={scrollToCatalog}
        onOpenCalculator={scrollToCalculator}
      />

      {/* 2. Infinite Auto X-Moving Brand Strip */}
      <StoreBrandsStrip />

      {/* 3. Visual Department Explorer */}
      <StoreDepartmentsSection onSelectDepartment={handleSelectCategory} />

      {/* 4. Live Inventory Catalog Grid */}
      <section id="catalog-grid-section" className="py-10 sm:py-16 lg:py-20 border-b border-border bg-surface min-w-0 scroll-mt-14 sm:scroll-mt-16">
        <Container size="xl" className="space-y-5 sm:space-y-8">
          {/* Consistent Section Header & Global Catalog Search */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand-crimson">
                SHOWROOM INVENTORY
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-text">
                Browse Live Products
              </h2>
            </div>

            {/* Catalog Search Bar */}
            <div className="w-full md:w-80 relative flex items-center">
              <Input
                id="catalog-instant-search"
                placeholder="Search sofa, fridge, AC, iPhone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-16 text-sm"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 text-xs text-muted hover:text-text cursor-pointer"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              ) : (
                <Search size={15} className="absolute right-3 text-muted pointer-events-none" />
              )}
            </div>
          </div>

          {/* Department Filter Tabs & Subcategory Controls */}
          <div className="border border-border rounded-xl sm:rounded-2xl bg-bg p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-2xs">
            {/* Primary Department Switcher */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 pb-2.5 sm:pb-3 border-b border-border">
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto pb-0.5 sm:pb-0 no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStore('all');
                    setSelectedCategory('');
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStore === 'all'
                      ? 'bg-text text-accent-fg border-text shadow-2xs font-semibold'
                      : 'bg-surface text-muted border-border hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  <Layers size={13} /> All ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStore('furniture-electronics');
                    setSelectedCategory('');
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStore === 'furniture-electronics'
                      ? 'bg-text text-accent-fg border-text shadow-2xs font-semibold'
                      : 'bg-surface text-muted border-border hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  <Tv size={13} /> Furniture &amp; Home
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStore('mobiles');
                    setSelectedCategory('');
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStore === 'mobiles'
                      ? 'bg-text text-accent-fg border-text shadow-2xs font-semibold'
                      : 'bg-surface text-muted border-border hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  <Smartphone size={13} /> Mobiles
                </button>
              </div>

              {/* Sorting & In-Stock Switch */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-muted hover:text-text select-none">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="rounded border-border text-brand-sage focus:ring-0 cursor-pointer"
                  />
                  <span>In-Stock Only</span>
                </label>

                <div className="flex items-center gap-1 text-muted">
                  <SlidersHorizontal size={13} />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-text cursor-pointer focus:outline-none"
                    aria-label="Sort catalog"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="discount">Biggest Savings</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category Sub-Filters */}
            {availableCategories.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 text-xs no-scrollbar">
                <span className="hidden sm:inline text-muted font-medium shrink-0">Filter:</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`px-2.5 py-1 rounded-md border cursor-pointer transition-all whitespace-nowrap font-medium ${
                    selectedCategory === ''
                      ? 'bg-surface-subtle text-text border-text'
                      : 'bg-surface text-muted border-border hover:text-text'
                  }`}
                >
                  All Types
                </button>
                {availableCategories.map(({ slug, name }) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setSelectedCategory(slug)}
                    className={`px-2.5 py-1 rounded-md border cursor-pointer transition-all whitespace-nowrap font-medium ${
                      selectedCategory === slug
                        ? 'bg-surface-subtle text-text border-text'
                        : 'bg-surface text-muted border-border hover:text-text'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Cards Grid — 2-col minimal mobile cards, 3-col rich desktop cards */}
          {isLoading && allProducts.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-6 h-6 rounded-full border-2 border-brand-sage border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-muted">Loading showroom inventory...</p>
            </div>
          ) : allProducts.length === 0 ? (
            <div className="py-12 px-4 text-center border border-border rounded-xl bg-bg space-y-3">
              <Layers size={26} className="mx-auto text-muted" />
              <h3 className="text-sm font-semibold text-text">Showroom catalog is being updated</h3>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                Visit our Khadka Road, Bhusawal showroom or message us on WhatsApp for live stock availability, pricing, and 0% EMI options.
              </p>
              <a
                href={`https://wa.me/${SITE.whatsappPhone}?text=${encodeURIComponent(
                  'Hello Star Enterprises Bhusawal! Please share current product availability and showroom offers.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-text text-accent-fg hover:bg-accent text-xs font-semibold transition-colors mt-1"
              >
                <MessageCircle size={14} /> Enquire on WhatsApp
              </a>
            </div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center border border-border rounded-xl bg-bg space-y-3">
              <Search size={26} className="mx-auto text-muted" />
              <h3 className="text-sm font-semibold text-text">No products found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Try searching for another keyword or clearing the filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedStore('all');
                  setSelectedCategory('');
                  setInStockOnly(false);
                  setSortBy('featured');
                }}
                className="text-xs mt-1"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-5 min-w-0">
                {visibleProducts.map((product) => {
                  const isMobiles = product.stores?.code === 'mobiles';
                  const isRecentlyAdded = recentlyAddedId === product.id;
                  const stockQty = product.inventory?.[0]?.quantity_on_hand ?? 0;
                  const isInStock = stockQty > 0;
                  const basePrice = Number(product.selling_price || 0);
                  const gstRate = !isNaN(parseFloat(product.gst_rate)) ? parseFloat(product.gst_rate) : 18;
                  const finalPrice = basePrice + Math.round(basePrice * (gstRate / 100));
                  const specs = product.specs || {};

                return (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                    className="min-w-0"
                  >
                    <div
                      onClick={() => setActiveModalProduct(product)}
                      className="group p-2.5 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3 hover:border-border-strong transition-colors bg-surface border border-border rounded-xl sm:rounded-2xl shadow-2xs h-full min-w-0 cursor-pointer"
                    >
                      <div className="space-y-2 sm:space-y-2.5 min-w-0">
                        {/* 4:3 Image Container */}
                        <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-subtle border border-border flex items-center justify-center transition-opacity group-hover:opacity-95">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover block"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-muted gap-1 py-4">
                              {isMobiles ? <Smartphone size={20} className="opacity-30" /> : <Tv size={20} className="opacity-30" />}
                              <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">{product.sku}</span>
                            </div>
                          )}

                          <span
                            className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full border ${
                              !isInStock
                                ? 'bg-surface border-brand-crimson-border text-brand-crimson-text'
                                : stockQty <= 2
                                ? 'bg-surface border-brand-gold-border text-brand-gold-text'
                                : 'bg-surface border-brand-sage-border text-brand-sage-text'
                            }`}
                          >
                            {!isInStock ? 'Out' : stockQty <= 2 ? `${stockQty} left` : 'In Stock'}
                          </span>
                        </div>

                        {/* Product Brand & Name */}
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold truncate">
                            {product.brands?.name || (isMobiles ? 'Star Mobiles' : 'Star Enterprises')}
                          </div>
                          <h3 className="text-xs sm:text-sm font-bold text-text line-clamp-2 min-h-8 sm:min-h-10 mt-0.5 leading-snug">
                            {product.name}
                          </h3>
                        </div>

                        {/* Spec Highlights Snippet (desktop/tablet) */}
                        <div className="hidden sm:flex flex-wrap gap-1.5 min-h-6 items-start">
                          {specs.storage && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-border bg-bg text-muted">
                              {specs.storage}
                            </span>
                          )}
                          {specs.battery_health && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-brand-sage-border bg-brand-sage-subtle text-brand-sage-text font-medium">
                              {specs.battery_health}% Battery
                            </span>
                          )}
                          {specs.screen_size && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-border bg-bg text-muted">
                              {specs.screen_size}
                            </span>
                          )}
                          {specs.capacity && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-border bg-bg text-muted">
                              {specs.capacity}
                            </span>
                          )}
                          {specs.tonnage && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-border bg-bg text-muted">
                              {specs.tonnage}
                            </span>
                          )}
                          {specs.star_rating && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-brand-gold-border bg-brand-gold-subtle text-brand-gold-text font-medium">
                              {specs.star_rating}
                            </span>
                          )}
                          {specs.seating && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-border bg-bg text-muted">
                              {specs.seating}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Transparent GST-Inclusive Price & Action Footer */}
                      <div className="pt-2 border-t border-border space-y-2">
                        <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-sm sm:text-lg font-bold font-mono text-text tracking-tight">
                              {formatCurrency(finalPrice)}
                            </div>
                            <div className="sm:hidden text-[10px] text-muted">Incl. GST</div>
                            <div className="hidden sm:block text-[10px] text-muted font-mono">
                              Base {formatCurrency(basePrice)} + {gstRate}% GST
                            </div>
                          </div>
                          {product.mrp && product.mrp > finalPrice && (
                            <div className="text-[10px] sm:text-xs text-muted line-through font-mono">
                              {formatCurrency(product.mrp)}
                            </div>
                          )}
                        </div>

                        {/* Mobile: single crisp primary button (tap card for View modal) | sm+: View + Add */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModalProduct(product);
                            }}
                            className="hidden sm:inline-flex text-xs justify-center gap-1.5 cursor-pointer font-medium py-1.5"
                          >
                            <Eye size={13} /> View
                          </Button>
                          {isInStock ? (
                            <Button
                              variant="solid"
                              size="sm"
                              onClick={(e) => handleAddToCart(e, product)}
                              className="text-[11px] sm:text-xs justify-center gap-1 sm:gap-1.5 cursor-pointer font-semibold py-1.5"
                            >
                              {isRecentlyAdded ? (
                                <>
                                  <Check size={13} /> Added
                                </>
                              ) : (
                                <>
                                  <ShoppingBag size={13} /> Add to Cart
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleAskAvailability(e, product, finalPrice)}
                              className="text-[11px] sm:text-xs justify-center gap-1 sm:gap-1.5 cursor-pointer font-semibold py-1.5"
                            >
                              <MessageCircle size={13} /> Ask Store
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Toggle Show All / Show Less Button */}
            {products.length > 6 && (
              <div className="pt-2 sm:pt-4 text-center">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowAllProducts((prev) => !prev)}
                  className="px-5 py-2 rounded-xl border-border bg-surface text-text hover:border-brand-sage hover:text-brand-sage font-bold text-xs sm:text-sm cursor-pointer shadow-2xs gap-2 inline-flex items-center"
                >
                  {showAllProducts ? (
                    <>Show Less (6 Products)</>
                  ) : (
                    <>View All Products ({products.length})</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
        </Container>
      </section>

      {/* 5. Interactive 0% Paperless EMI Calculator */}
      <StoreEmiCalculatorSection key={emiPresetAmount ?? 'default'} initialAmount={emiPresetAmount} />

      {/* 6. Showroom Visit & In-Person Experience */}
      <StoreSpotlightSection />

      {/* 7. Frequently Asked Questions */}
      <StoreFaqSection />

      {/* 9. Minimal Enterprise Footer */}
      <StoreFooter onSelectCategory={handleSelectCategory} />

      {/* 10. Product Detail Modal */}
      {activeModalProduct && (
        <ProductDetailModal
          product={activeModalProduct}
          isOpen={Boolean(activeModalProduct)}
          onClose={() => setActiveModalProduct(null)}
          onCalculateEmi={(amount) => {
            setEmiPresetAmount(amount);
            setActiveModalProduct(null);
            scrollToCalculator();
          }}
        />
      )}

      {/* Mobile Sticky Quick Action Bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center gap-2 shadow-2xs">
        <button
          type="button"
          onClick={scrollToCatalog}
          className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-text bg-bg border border-border cursor-pointer"
        >
          <Layers size={14} /> Catalog
        </button>
        <a
          href={`tel:${SITE.supportPhone.replace(/\s+/g, '')}`}
          className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-text bg-bg border border-border"
        >
          <Phone size={14} /> Call
        </a>
        <a
          href={`https://wa.me/${SITE.whatsappPhone}?text=${encodeURIComponent(
            'Hello Star Enterprises Bhusawal! I would like to enquire about products and showroom offers.'
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-fg"
        >
          <MessageCircle size={14} /> WhatsApp
        </a>
      </div>
    </div>
  );
}
