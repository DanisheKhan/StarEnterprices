import { Suspense, useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart, CartDrawer } from '@/features/catalog';
import { Button } from '@/shared/ui';
import { SITE } from '@/shared/lib/site';
import { ShoppingBag, Phone, Shield, Menu, X } from 'lucide-react';

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalCount, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);

  // Auto-close mobile navigation when navigating to a different route
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setIsMobileMenuOpen(false);
  }

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  const isPublicPage = location.pathname === '/';

  const navLinks = [
    { href: '#catalog-grid-section', label: 'Catalog' },
    { href: '#departments-section', label: 'Departments' },
    { href: '#emi-calculator-section', label: '0% EMI' },
    { href: '#showroom-section', label: 'Showroom' },
    { href: '#reviews-section', label: 'Reviews' },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans overflow-x-hidden">
      {/* Fixed Minimal Header — h-14 mobile, h-16 desktop */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface border-b border-border h-14 sm:h-16">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">

          {/* Left: Hamburger (mobile public only) + Logotype */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {isPublicPage && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:bg-surface-subtle cursor-pointer transition-colors"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}

            <Link
              to={isPublicPage ? '/' : '/admin'}
              className="flex items-center gap-0 font-black tracking-tight text-sm sm:text-base leading-none"
            >
              <span className="text-brand-crimson font-black tracking-tight">STAR</span>
              <span className="text-text font-black tracking-tight ml-1">ENTERPRISES</span>
            </Link>
          </div>

          {/* Center: Classic text nav links (public desktop) */}
          {isPublicPage && (
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="hover:text-text transition-colors border-b-2 border-transparent hover:border-brand-crimson pb-0.5"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* Right: Minimal Actions (Cart always visible; Owner Portal kept inside menu on mobile for clean header) */}
          {isPublicPage ? (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <a
                href={`tel:${SITE.supportPhone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
              >
                <Phone size={13} className="text-brand-crimson" />
                <span className="font-mono font-semibold">{SITE.displayPhone}</span>
              </a>

              {/* Cart Trigger */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCartOpen(true)}
                className="h-9 text-xs px-3 gap-1.5 cursor-pointer relative font-semibold border-border rounded-lg"
                aria-label="View shopping cart"
              >
                <ShoppingBag size={14} />
                <span>Cart</span>
                {totalCount > 0 && (
                  <span className="bg-brand-crimson text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {totalCount}
                  </span>
                )}
              </Button>

              {/* Owner Portal — shown in top bar on sm+ and inside mobile menu on mobile */}
              <Link
                to="/login"
                className="hidden sm:flex text-xs h-9 px-3 rounded-lg border border-border text-muted hover:text-text hover:bg-surface-hover transition-colors items-center gap-1.5 font-medium"
              >
                <Shield size={13} />
                <span>Owner Portal</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
                className="text-xs px-3 rounded-lg"
                title="View Public Storefront"
              >
                <span className="hidden sm:inline">Storefront</span>
                <span className="sm:hidden">Store</span>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Dropdown Sheet for Public Storefront */}
        {isPublicPage && isMobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-surface shadow-sm py-3 px-4">
            <div className="grid grid-cols-2 gap-1.5">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-xs font-semibold text-text bg-bg border border-border rounded-lg hover:bg-surface-hover transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-xs">
              <a
                href={`tel:${SITE.supportPhone}`}
                className="flex items-center gap-1.5 text-muted hover:text-text font-medium"
              >
                <Phone size={13} className="text-brand-crimson" />
                <span>Call {SITE.displayPhone}</span>
              </a>

              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-text font-semibold"
              >
                <Shield size={13} className="text-muted" />
                <span>Owner Login</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content — matches h-14 (mobile) / h-16 (sm+) fixed header */}
      <main className="flex-1 min-w-0 pt-14 sm:pt-16">
        <Suspense fallback={<div className="py-20 text-center text-muted">Loading page...</div>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Cart Slider Drawer */}
      <CartDrawer />
    </div>
  );
}
