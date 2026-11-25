import { useEffect } from 'react';
import { useCart } from '../hooks/useCatalog';
import { formatCurrency } from '@/shared/lib/format';
import { lockBodyScroll, unlockBodyScroll } from '@/shared/lib/scrollLock';
import { Button, Badge } from '@/shared/ui';
import { SITE } from '@/shared/lib/site';
import { X, Trash2, Plus, Minus, MessageSquare, ShoppingBag, ArrowRight } from 'lucide-react';

export function CartDrawer() {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalCount,
  } = useCart();

  useEffect(() => {
    if (!isCartOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsCartOpen(false);
    }
    lockBodyScroll();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCartOpen, setIsCartOpen]);

  if (!isCartOpen) return null;

  function handleWhatsAppCheckout() {
    if (items.length === 0) return;

    let baseSubtotal = 0;
    let totalGst = 0;
    let totalWithGst = 0;
    const storeNames = new Set();

    let message = `*Order Inquiry - Star Enterprises*\n\n`;
    message += `Hello Star Enterprises, I would like to order the following items:\n\n`;

    items.forEach((item, index) => {
      const p = item.product;
      const base = Number(p.selling_price || 0);
      const gstRate = !isNaN(parseFloat(p.gst_rate)) ? parseFloat(p.gst_rate) : 18;
      const lineBase = base * item.quantity;
      const lineGst = Math.round(lineBase * (gstRate / 100));
      const lineTotal = lineBase + lineGst;

      baseSubtotal += lineBase;
      totalGst += lineGst;
      totalWithGst += lineTotal;
      if (p.stores?.name) storeNames.add(p.stores.name);

      message += `${index + 1}. *${p.name}* (${p.stores?.name || 'Star'})\n`;
      message += `   Qty: ${item.quantity} × ${formatCurrency(base)} + ${gstRate}% GST = ${formatCurrency(lineTotal)}\n`;
      if (p.specs?.color) message += `   Color: ${p.specs.color}\n`;
      if (p.specs?.storage) message += `   Storage: ${p.specs.storage}\n`;
      message += `\n`;
    });

    message += `*Taxable Subtotal:* ${formatCurrency(baseSubtotal)}\n`;
    message += `*Estimated GST:* ${formatCurrency(totalGst)}\n`;
    message += `*Total Payable (Incl. GST):* ${formatCurrency(totalWithGst)}\n\n`;
    if (storeNames.size > 1) {
      message += `_Note: Items span multiple departments (${Array.from(storeNames).join(' & ')}). Separate department GST bills may be issued at Khadka Road showroom._\n\n`;
    }
    message += `Please confirm stock availability and showroom pickup / delivery options.`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${SITE.whatsappPhone}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const cartTotals = items.reduce(
    (acc, { product, quantity }) => {
      const base = Number(product.selling_price || 0);
      const gstRate = !isNaN(parseFloat(product.gst_rate)) ? parseFloat(product.gst_rate) : 18;
      const lineBase = base * quantity;
      const lineGst = Math.round(lineBase * (gstRate / 100));
      acc.base += lineBase;
      acc.gst += lineGst;
      acc.grand += lineBase + lineGst;
      return acc;
    },
    { base: 0, gst: 0, grand: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-text/20 transition-opacity"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-surface border-l border-border flex flex-col h-dvh z-10 min-w-0 overscroll-contain">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-text" />
            <h2 className="font-bold text-text text-base sm:text-lg">Your Cart</h2>
            <Badge variant="accent">{totalCount} items</Badge>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 rounded-full text-muted hover:text-text hover:bg-bg cursor-pointer transition-colors"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-w-0">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingBag size={36} className="mx-auto text-muted" />
              <p className="text-sm font-medium text-text">Your cart is currently empty</p>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Browse our Mobiles and Furniture collections to add genuine products with warranty.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCartOpen(false)}
                className="mt-2 text-xs"
              >
                Browse Products
              </Button>
            </div>
          ) : (
            items.map(({ product, quantity }) => {
              const basePrice = Number(product.selling_price || 0);
              const gstRate = !isNaN(parseFloat(product.gst_rate)) ? parseFloat(product.gst_rate) : 18;
              const lineBase = basePrice * quantity;
              const lineGst = Math.round(lineBase * (gstRate / 100));
              const lineFinal = lineBase + lineGst;
              const rawStock = product.inventory?.[0]?.quantity_on_hand;
              const maxStock = typeof rawStock === 'number' ? rawStock : null;
              const atMaxStock = maxStock !== null && quantity >= maxStock;

              return (
              <div
                key={product.id}
                className="p-3.5 border border-border rounded-2xl bg-bg flex gap-3 items-start min-w-0"
              >
                {product.image_url && (
                  <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-border bg-surface">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover block"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="default" className="text-[10px] py-0 px-1.5">
                      {product.stores?.name || 'Star Store'}
                    </Badge>
                    {product.specs?.warranty && (
                      <span className="text-[10px] text-muted">{product.specs.warranty}</span>
                    )}
                  </div>
                  <h3 className="text-xs font-semibold text-text truncate">{product.name}</h3>
                  <div className="text-xs font-semibold text-text">
                    {formatCurrency(basePrice + Math.round(basePrice * (gstRate / 100)))}
                    <span className="text-[10px] font-normal text-muted ml-1.5">
                      ({formatCurrency(basePrice)} + {gstRate}% GST)
                    </span>
                  </div>

                  {/* Quantity Controls */}
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    <div className="flex items-center border border-border rounded-full bg-surface">
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="p-1 px-2 text-muted hover:text-text cursor-pointer transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="px-2 text-xs font-semibold text-text min-w-4 text-center">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        disabled={atMaxStock}
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="p-1 px-2 text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {atMaxStock && (
                      <span className="text-[10px] text-brand-gold-text font-medium">
                        Max stock ({maxStock})
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => removeFromCart(product.id)}
                      className="text-muted hover:text-danger p-1 cursor-pointer transition-colors text-xs"
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="text-right text-xs font-semibold text-text whitespace-nowrap">
                  {formatCurrency(lineFinal)}
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Footer / Checkout */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-border bg-surface space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted">
                <span>Taxable Subtotal ({totalCount} items):</span>
                <span className="font-mono">{formatCurrency(cartTotals.base)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Estimated GST (CGST + SGST):</span>
                <span className="font-mono">+{formatCurrency(cartTotals.gst)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-text pt-2 border-t border-border">
                <span>Total Payable (Incl. GST):</span>
                <span className="font-mono">{formatCurrency(cartTotals.grand)}</span>
              </div>
            </div>

            <Button
              variant="solid"
              className="w-full gap-2 justify-center py-2.5 text-xs font-medium cursor-pointer"
              onClick={handleWhatsAppCheckout}
            >
              <MessageSquare size={16} /> Order Directly on WhatsApp <ArrowRight size={14} />
            </Button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] text-muted hover:text-danger cursor-pointer transition-colors underline"
              >
                Clear Cart
              </button>
              <span className="text-[11px] text-muted">Doorstep Delivery or Store Pickup</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
