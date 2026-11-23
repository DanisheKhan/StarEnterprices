import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import {
  Barcode,
  Check,
  Copy,
  ExternalLink,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

export function ProductSerialCard({
  product,
  unusedUnits = [],
  usedUnits = [],
  storeCode = '',
  onAddSerials,
  onDeleteUnit,
}) {
  const [activeTab, setActiveTab] = useState('unused');
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedSerial, setCopiedSerial] = useState('');

  const unusedCount = unusedUnits.length;
  const usedCount = usedUnits.length;
  const isOutOfStock = unusedCount === 0;
  const isLowStock = !isOutOfStock && unusedCount <= (product.reorder_level || 2);

  async function handleCopy(serial) {
    try {
      await navigator.clipboard.writeText(serial);
      setCopiedSerial(serial);
      setTimeout(() => setCopiedSerial(''), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-2xs overflow-hidden transition-colors">
      {/* Product Card Header */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border bg-surface">
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Thumbnail */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-border bg-bg/40 flex items-center justify-center shrink-0 overflow-hidden">
            {product?.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted">
                <Package size={24} />
                <span className="text-[9px] font-mono">{product?.sku || 'SKU'}</span>
              </div>
            )}
          </div>

          {/* Product Meta */}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-subtle border border-border text-muted uppercase tracking-wider">
                {product?.categories?.name || 'General'}
              </span>
              {product?.brands?.name && product.brands.name !== '-' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-subtle border border-border text-muted uppercase tracking-wider">
                  {product.brands.name}
                </span>
              )}
            </div>

            <h3 className="font-bold text-sm sm:text-base text-text truncate leading-snug" title={product?.name}>
              {product?.name || 'Unknown Product'}
            </h3>

            <div className="flex items-center gap-2.5 text-xs text-muted flex-wrap">
              {product?.sku && <span className="font-mono text-[11px]">SKU: {product.sku}</span>}
              {product?.selling_price > 0 && (
                <>
                  <span>•</span>
                  <span className="font-semibold font-mono text-text">
                    {formatCurrency(product.selling_price)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stock Badges & Card Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
          {/* Stock Health status */}
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/10 border border-danger/30 text-danger">
              <AlertCircle size={12} className="shrink-0" />
              <span>Out of Stock</span>
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-600">
              <AlertCircle size={12} className="shrink-0" />
              <span>Low Stock ({unusedCount})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-sage-subtle border border-brand-sage-border text-brand-sage-text">
              <PackageCheck size={12} className="shrink-0 text-brand-sage" />
              <span>{unusedCount} In Stock</span>
            </span>
          )}

          {/* Quick Add Serials specifically for this product */}
          <button
            type="button"
            onClick={() => onAddSerials?.(product?.id)}
            className="inline-flex items-center gap-1.5 bg-accent text-accent-fg hover:opacity-95 active:scale-[0.99] font-semibold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-2xs"
          >
            <Plus size={13} className="stroke-[2.5]" />
            <span>Add Serials</span>
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-subtle text-muted hover:text-text cursor-pointer transition-colors"
            title={isExpanded ? 'Collapse serial units tray' : 'Expand serial units tray'}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expandable Tray */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-surface-subtle/40">
          {/* Sub-tabs: Available Units vs Sold History */}
          <div className="flex items-center justify-between border-b border-border pb-2.5 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('unused')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5',
                  activeTab === 'unused'
                    ? 'bg-surface text-text border border-border shadow-2xs'
                    : 'text-muted hover:text-text hover:bg-surface/50 border border-transparent'
                )}
              >
                <PackageCheck size={13} className={activeTab === 'unused' ? 'text-brand-sage' : 'text-muted'} />
                <span>Available Units</span>
                <span className={cn(
                  'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                  activeTab === 'unused' ? 'bg-brand-sage-subtle text-brand-sage-text' : 'bg-surface text-muted'
                )}>
                  {unusedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('used')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5',
                  activeTab === 'used'
                    ? 'bg-surface text-text border border-border shadow-2xs'
                    : 'text-muted hover:text-text hover:bg-surface/50 border border-transparent'
                )}
              >
                <ReceiptText size={13} className={activeTab === 'used' ? 'text-text' : 'text-muted'} />
                <span>Sold History</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface text-muted">
                  {usedCount}
                </span>
              </button>
            </div>

            <span className="text-[11px] text-muted hidden sm:inline-block">
              {activeTab === 'unused'
                ? 'Ready to bill on any invoice'
                : 'Billed units linked to sales receipts'}
            </span>
          </div>

          {/* Available Units Panel */}
          {activeTab === 'unused' && (
            <div>
              {unusedUnits.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-border bg-surface text-xs text-muted space-y-2">
                  <Package size={24} className="mx-auto text-muted/60" />
                  <p className="font-medium text-text">No available serial numbers</p>
                  <p className="text-[11px] text-muted max-w-xs mx-auto">
                    Add new serial numbers to enable barcode scanning and billing for this product.
                  </p>
                  <button
                    type="button"
                    onClick={() => onAddSerials?.(product?.id)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-fg hover:opacity-95 shadow-2xs cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Create Serials Now</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {unusedUnits.map((u) => {
                    const isCopied = copiedSerial === u.serial_number;
                    return (
                      <div
                        key={u.id}
                        className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between gap-2 shadow-2xs hover:border-border-strong transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-xs text-text truncate">
                            <Barcode size={14} className="text-brand-sage shrink-0" />
                            <span className="truncate">{u.serial_number}</span>
                          </div>
                          <div className="text-[10px] text-muted flex items-center gap-1.5">
                            <span className="uppercase font-semibold text-text">{u.condition_grade || 'NEW'}</span>
                            <span>•</span>
                            <span>{u.warranty_months ? `${u.warranty_months}M warranty` : 'No warranty'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Copy Serial Button */}
                          <button
                            type="button"
                            onClick={() => handleCopy(u.serial_number)}
                            className={cn(
                              'p-1.5 rounded-md border text-xs transition-colors cursor-pointer',
                              isCopied
                                ? 'bg-brand-sage-subtle border-brand-sage-border text-brand-sage-text'
                                : 'border-border bg-surface-subtle hover:bg-surface text-muted hover:text-text'
                            )}
                            title={isCopied ? 'Copied to clipboard' : 'Copy serial number'}
                            aria-label="Copy serial"
                          >
                            {isCopied ? <Check size={13} className="text-brand-sage" /> : <Copy size={13} />}
                          </button>

                          {/* Delete Serial Button */}
                          <button
                            type="button"
                            onClick={() => onDeleteUnit?.(u)}
                            className="p-1.5 rounded-md border border-border bg-surface-subtle hover:bg-danger/10 hover:border-danger/30 text-muted hover:text-danger text-xs transition-colors cursor-pointer"
                            title="Remove / Void this serial number"
                            aria-label="Remove serial"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sold History Panel */}
          {activeTab === 'used' && (
            <div>
              {usedUnits.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-border bg-surface text-xs text-muted space-y-1">
                  <ReceiptText size={24} className="mx-auto text-muted/60" />
                  <p className="font-medium text-text">No sold units recorded yet</p>
                  <p className="text-[11px] text-muted">Units billed at POS will appear here with customer invoice details.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {usedUnits.map((u) => {
                    const isCopied = copiedSerial === u.serial_number;
                    const invoiceNum = u.invoice?.invoice_number;
                    const customer = u.invoice?.customer_name;
                    const soldDate = u.invoice?.created_at || u.updated_at;

                    return (
                      <div
                        key={u.id}
                        className="rounded-lg border border-border bg-surface p-3 flex flex-col justify-between gap-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-xs text-text truncate">
                            <Barcode size={14} className="text-muted shrink-0" />
                            <span className="truncate">{u.serial_number}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy(u.serial_number)}
                            className={cn(
                              'p-1.5 rounded-md border text-xs transition-colors cursor-pointer shrink-0',
                              isCopied
                                ? 'bg-brand-sage-subtle border-brand-sage-border text-brand-sage-text'
                                : 'border-border bg-surface-subtle hover:bg-surface text-muted hover:text-text'
                            )}
                            title={isCopied ? 'Copied' : 'Copy serial'}
                            aria-label="Copy serial"
                          >
                            {isCopied ? <Check size={13} className="text-brand-sage" /> : <Copy size={13} />}
                          </button>
                        </div>

                        <div className="pt-2 border-t border-border/70 flex items-center justify-between text-[11px] text-muted gap-2">
                          {invoiceNum ? (
                            <Link
                              to={`/admin/${storeCode}/invoices`}
                              className="font-mono font-semibold text-text underline-offset-2 hover:underline inline-flex items-center gap-1"
                              title="View in Invoices console"
                            >
                              <span>{invoiceNum}</span>
                              <ExternalLink size={10} className="text-muted" />
                            </Link>
                          ) : (
                            <span className="italic text-muted">Unlinked bill</span>
                          )}

                          <span className="truncate max-w-28 text-right" title={customer || 'Counter Sale'}>
                            {customer || 'Counter Sale'}
                          </span>
                        </div>

                        {soldDate && (
                          <div className="text-[10px] text-muted text-right">
                            Sold: {formatDate(soldDate)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
