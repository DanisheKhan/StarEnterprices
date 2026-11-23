import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Badge,
  Input,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  TableSkeleton,
} from '@/shared/ui';
import { useProducts, useStoreSerials } from '../hooks/useInventory';
import { resolveStoreUuid } from '../api/inventory.api';
import { CreateSerialsModal } from '../components/CreateSerialsModal';
import { DeleteSerialModal } from '../components/DeleteSerialModal';
import { ProductSerialCard } from '../components/ProductSerialCard';
import { formatDate } from '@/shared/lib/format';
import { getErrorMessage } from '@/shared/lib/errors';
import { cn } from '@/shared/lib/cn';
import {
  AlertCircle,
  Barcode,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  LayoutGrid,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';

/**
 * Picks the most recent invoice a unit was billed on (a returned unit can be sold again).
 */
function latestInvoice(unit) {
  const invoices = (unit.order_items || []).map((oi) => oi.invoices).filter(Boolean);
  if (invoices.length === 0) return null;
  return invoices.reduce((latest, inv) =>
    new Date(inv.created_at) > new Date(latest.created_at) ? inv : latest
  );
}

export function SerialNumbersPage() {
  const outletCtx = useOutletContext();
  const currentStore = outletCtx?.store;
  const storeCode = outletCtx?.storeCode || currentStore?.code || '';
  const storeId = currentStore?.id || resolveStoreUuid(storeCode) || '';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_stock' | 'sold'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState('');
  const [unitToDelete, setUnitToDelete] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedSerial, setCopiedSerial] = useState('');

  const { data: serials = [], isLoading: isSerialsLoading, error } = useStoreSerials(storeId);
  const { data: products = [], isLoading: isProdsLoading } = useProducts(storeId);

  const activeProducts = useMemo(() => products.filter((p) => p.is_active !== false), [products]);

  // Handle serial copy
  async function handleCopy(serial) {
    try {
      await navigator.clipboard.writeText(serial);
      setCopiedSerial(serial);
      setTimeout(() => setCopiedSerial(''), 2000);
    } catch {
      // Fallback
    }
  }

  // Pre-process and enrich serials with invoice details
  const enrichedSerials = useMemo(() => {
    return serials.map((u) => ({
      ...u,
      invoice: latestInvoice(u),
    }));
  }, [serials]);

  // Dynamic category pills
  const categories = useMemo(() => {
    const categoryCounts = new Map();
    // Count from products and serials
    enrichedSerials.forEach((u) => {
      const catName = u.products?.categories?.name || 'General';
      categoryCounts.set(catName, (categoryCounts.get(catName) || 0) + 1);
    });

    return Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enrichedSerials]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    let inStock = 0;
    let sold = 0;
    const distinctProdIds = new Set();

    enrichedSerials.forEach((u) => {
      if (u.status === 'in_stock') inStock += 1;
      if (u.status === 'sold') sold += 1;
      if (u.product_id) distinctProdIds.add(u.product_id);
    });

    return {
      total: enrichedSerials.length,
      inStock,
      sold,
      productsCount: distinctProdIds.size,
    };
  }, [enrichedSerials]);

  // Grouped products data structure for Card View
  const groupedProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();

    // 1. Seed with active serialized products from store catalog
    activeProducts.forEach((p) => {
      if (p.is_serialized) {
        map.set(p.id, {
          product: p,
          unused: [],
          used: [],
        });
      }
    });

    // 2. Distribute serial units to corresponding products
    enrichedSerials.forEach((u) => {
      const pId = u.product_id || u.products?.id;
      if (!pId) return;

      if (!map.has(pId)) {
        map.set(pId, {
          product: u.products || { id: pId, name: 'Unknown Product', sku: '' },
          unused: [],
          used: [],
        });
      }

      const entry = map.get(pId);
      // Ensure product details are hydrated
      if (!entry.product.categories && u.products?.categories) {
        entry.product = { ...entry.product, ...u.products };
      }

      if (u.status === 'in_stock') {
        entry.unused.push(u);
      } else if (u.status === 'sold') {
        entry.used.push(u);
      }
    });

    // 3. Filter entries by category, search query, and stock status
    const result = [];
    for (const entry of map.values()) {
      const prod = entry.product;
      const catName = prod.categories?.name || 'General';

      // Category filter check
      if (selectedCategory && catName !== selectedCategory) {
        continue;
      }

      // Filter individual unit lists by search query
      const matchesSearch = (u) => {
        if (!q) return true;
        return (
          u.serial_number?.toLowerCase().includes(q) ||
          prod.name?.toLowerCase().includes(q) ||
          prod.sku?.toLowerCase().includes(q) ||
          u.invoice?.invoice_number?.toLowerCase().includes(q) ||
          u.invoice?.customer_name?.toLowerCase().includes(q)
        );
      };

      const filteredUnused = entry.unused.filter(matchesSearch);
      const filteredUsed = entry.used.filter(matchesSearch);

      // If search query is present and neither the product nor any units match, skip
      const prodMatchesQuery =
        !q || prod.name?.toLowerCase().includes(q) || prod.sku?.toLowerCase().includes(q);

      if (q && !prodMatchesQuery && filteredUnused.length === 0 && filteredUsed.length === 0) {
        continue;
      }

      // Status filter
      if (statusFilter === 'in_stock' && filteredUnused.length === 0) {
        continue;
      }
      if (statusFilter === 'sold' && filteredUsed.length === 0) {
        continue;
      }

      // Sort sold units latest first
      filteredUsed.sort((a, b) => {
        const tA = new Date(a.invoice?.created_at || a.updated_at).getTime();
        const tB = new Date(b.invoice?.created_at || b.updated_at).getTime();
        return tB - tA;
      });

      result.push({
        product: prod,
        unused: filteredUnused,
        used: filteredUsed,
      });
    }

    // Sort products by in-stock count descending, then product name
    return result.sort((a, b) => {
      if (b.unused.length !== a.unused.length) {
        return b.unused.length - a.unused.length;
      }
      return (a.product.name || '').localeCompare(b.product.name || '');
    });
  }, [activeProducts, enrichedSerials, search, selectedCategory, statusFilter]);

  // Flat unit lists for Ledger Table View
  const { tableUnused, tableUsed } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = enrichedSerials.filter((u) => {
      if (selectedCategory) {
        const catName = u.products?.categories?.name || 'General';
        if (catName !== selectedCategory) return false;
      }
      if (!q) return true;
      return (
        u.serial_number?.toLowerCase().includes(q) ||
        u.products?.name?.toLowerCase().includes(q) ||
        u.products?.sku?.toLowerCase().includes(q) ||
        u.invoice?.invoice_number?.toLowerCase().includes(q) ||
        u.invoice?.customer_name?.toLowerCase().includes(q)
      );
    });

    const soldAt = (u) => new Date(u.invoice?.created_at || u.updated_at).getTime();
    return {
      tableUnused: filtered.filter((u) => u.status === 'in_stock'),
      tableUsed: filtered.filter((u) => u.status === 'sold').sort((a, b) => soldAt(b) - soldAt(a)),
    };
  }, [enrichedSerials, search, selectedCategory]);

  function handleOpenCreate(productId = '') {
    setTargetProductId(productId);
    setIsCreateOpen(true);
  }

  function handleCreated(count) {
    setSuccessMsg(`${count} serial number${count === 1 ? '' : 's'} registered and added to stock.`);
    setTimeout(() => setSuccessMsg(''), 4500);
  }

  function handleDeleted(serial) {
    setSuccessMsg(`Serial number ${serial} removed from stock.`);
    setTimeout(() => setSuccessMsg(''), 4500);
  }

  const isLoading = isSerialsLoading || isProdsLoading;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border min-w-0">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
            INVENTORY CONTROL
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Serial Numbers & Units
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
            Unused serials stay with their product. Used serials can be billed again on any product with a full cash payment, then are removed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreate('')}
          className="inline-flex items-center gap-1.5 bg-accent text-accent-fg hover:opacity-95 active:scale-[0.99] font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 shadow-xs self-start sm:self-auto"
        >
          <Plus size={15} className="stroke-[2.5]" />
          <span>Create Serial Numbers</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-xl border border-brand-sage-border bg-brand-sage-subtle p-3.5 text-xs text-brand-sage-text font-medium flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 size={16} className="shrink-0 text-brand-sage" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-xs text-danger font-medium flex items-center gap-2.5 shadow-2xs">
          <AlertCircle size={16} className="shrink-0" />
          <span>Could not load serial numbers: {getErrorMessage(error)}</span>
        </div>
      )}

      {/* Operational KPI Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-brand-sage-border bg-brand-sage-subtle/50 p-3.5 sm:p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-brand-sage-text">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unused</span>
            <PackageCheck size={16} className="text-brand-sage" />
          </div>
          <div className="text-2xl font-bold text-brand-sage-text font-mono">{metrics.inStock}</div>
          <p className="text-[11px] text-brand-sage-text/80">Ready for billing & scan</p>
        </div>

        <div className="rounded-xl border border-brand-crimson-border bg-brand-crimson-subtle/50 p-3.5 sm:p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-brand-crimson-text">
            <span className="text-[11px] font-bold uppercase tracking-wider">Used</span>
            <ReceiptText size={16} className="text-brand-crimson" />
          </div>
          <div className="text-2xl font-bold text-brand-crimson-text font-mono">{metrics.sold}</div>
          <p className="text-[11px] text-brand-crimson-text/80">Billed to customer invoices</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Serials</span>
            <Barcode size={16} className="text-muted" />
          </div>
          <div className="text-2xl font-bold text-text font-mono">{metrics.total}</div>
          <p className="text-[11px] text-muted">Registered in this store</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Serialized SKUs</span>
            <Boxes size={16} className="text-muted" />
          </div>
          <div className="text-2xl font-bold text-text font-mono">{metrics.productsCount}</div>
          <p className="text-[11px] text-muted">Products with serialized units</p>
        </div>
      </div>

      {/* Category Pills Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory('')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border shadow-2xs flex items-center gap-1.5',
            !selectedCategory
              ? 'bg-accent text-accent-fg border-accent'
              : 'bg-surface text-muted hover:text-text border-border'
          )}
        >
          <span>All Categories</span>
          <span className={cn(
            'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
            !selectedCategory ? 'bg-surface/20 text-accent-fg' : 'bg-surface-subtle text-muted'
          )}>
            {metrics.total}
          </span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border shadow-2xs flex items-center gap-1.5',
                isSelected
                  ? 'bg-accent text-accent-fg border-accent'
                  : 'bg-surface text-muted hover:text-text border-border'
              )}
            >
              <span>{cat.name}</span>
              <span className={cn(
                'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                isSelected ? 'bg-surface/20 text-accent-fg' : 'bg-surface-subtle text-muted'
              )}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search, Status & View Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-surface shadow-2xs">
        <div className="flex-1 min-w-0">
          <Input
            id="search-serials"
            placeholder="Search by serial number, product, SKU, invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Segmented Switch */}
          <div className="bg-surface-subtle p-1 rounded-lg border border-border flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                statusFilter === 'all'
                  ? 'bg-surface text-text shadow-2xs border border-border'
                  : 'text-muted hover:text-text'
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_stock')}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                statusFilter === 'in_stock'
                  ? 'bg-brand-sage-subtle text-brand-sage-text shadow-2xs border border-brand-sage-border'
                  : 'text-muted hover:text-brand-sage-text'
              )}
            >
              Unused
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sold')}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                statusFilter === 'sold'
                  ? 'bg-brand-crimson-subtle text-brand-crimson-text shadow-2xs border border-brand-crimson-border'
                  : 'text-muted hover:text-brand-crimson-text'
              )}
            >
              Used
            </button>
          </div>

          {/* View Mode Toggle: Cards vs Ledger Table */}
          <div className="bg-surface-subtle p-1 rounded-lg border border-border flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn(
                'p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1',
                viewMode === 'cards'
                  ? 'bg-surface text-text shadow-2xs border border-border'
                  : 'text-muted hover:text-text'
              )}
              title="Product Cards View"
              aria-label="Cards View"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline text-xs">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1',
                viewMode === 'table'
                  ? 'bg-surface text-text shadow-2xs border border-border'
                  : 'text-muted hover:text-text'
              )}
              title="Audit Ledger Table View"
              aria-label="Table View"
            >
              <TableIcon size={15} />
              <span className="hidden sm:inline text-xs">Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        viewMode === 'cards' ? (
          <div className="space-y-4">
            <div className="h-40 rounded-xl border border-border bg-surface animate-pulse" />
            <div className="h-40 rounded-xl border border-border bg-surface animate-pulse" />
          </div>
        ) : (
          <TableSkeleton />
        )
      ) : viewMode === 'cards' ? (
        /* PRODUCT CARDS VIEW */
        groupedProducts.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-border bg-surface text-xs text-muted space-y-3">
            <Package size={32} className="mx-auto text-muted/60" />
            <h3 className="font-bold text-sm text-text">No matching products or serials found</h3>
            <p className="max-w-md mx-auto text-muted">
              {search || selectedCategory || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or clear the active category filter.'
                : 'No serialized products found in this store catalog. Create serial numbers to get started.'}
            </p>
            {(search || selectedCategory || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('');
                  setStatusFilter('all');
                }}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-surface hover:bg-surface-subtle text-text cursor-pointer transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedProducts.map(({ product, unused, used }) => (
              <ProductSerialCard
                key={product.id}
                product={product}
                unusedUnits={unused}
                usedUnits={used}
                storeCode={storeCode}
                onAddSerials={handleOpenCreate}
                onDeleteUnit={(unit) => setUnitToDelete(unit)}
              />
            ))}
          </div>
        )
      ) : (
        /* AUDIT LEDGER TABLE VIEW */
        <div className="space-y-6">
          {(statusFilter === 'all' || statusFilter === 'in_stock') && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <PackageCheck size={16} className="text-brand-sage" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-brand-sage-text">
                    Unused
                  </h2>
                  <Badge variant="success" className="text-[11px] font-mono">
                    {tableUnused.length}
                  </Badge>
                </div>
                <span className="text-[11px] text-brand-sage-text/80">Ready for billing</span>
              </div>

              {tableUnused.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-border bg-surface text-xs text-muted">
                  No unused serial numbers match your filters.
                </div>
              ) : (
                <Table className="table-auto min-w-160" containerClassName="overflow-auto max-h-120">
                  <TableHead className="sticky top-0 z-10">
                    <TableRow>
                      <TableHeaderCell>Serial Number</TableHeaderCell>
                      <TableHeaderCell>Product</TableHeaderCell>
                      <TableHeaderCell>Category</TableHeaderCell>
                      <TableHeaderCell>Grade / Warranty</TableHeaderCell>
                      <TableHeaderCell>Created</TableHeaderCell>
                      <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableUnused.map((u) => {
                      const isCopied = copiedSerial === u.serial_number;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 font-mono font-semibold text-xs sm:text-sm">
                              <Barcode size={14} className="text-brand-sage shrink-0" />
                              {u.serial_number}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-medium text-text truncate">
                                {u.products?.name || 'Unknown product'}
                              </div>
                              {u.products?.sku && (
                                <div className="text-[11px] font-mono text-muted">
                                  SKU: {u.products.sku}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border">
                              {u.products?.categories?.name || 'General'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted whitespace-nowrap">
                            <span className="uppercase font-semibold text-text">
                              {u.condition_grade || 'NEW'}
                            </span>
                            {' • '}
                            {u.warranty_months ? `${u.warranty_months}M warranty` : 'No warranty'}
                          </TableCell>
                          <TableCell className="text-xs text-muted whitespace-nowrap">
                            {formatDate(u.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => handleCopy(u.serial_number)}
                                className="p-1.5 rounded-md border border-border bg-surface hover:bg-surface-subtle text-muted hover:text-text cursor-pointer transition-colors"
                                title="Copy serial number"
                                aria-label="Copy"
                              >
                                {isCopied ? (
                                  <Check size={13} className="text-brand-sage" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setUnitToDelete(u)}
                                className="p-1.5 rounded-md border border-border bg-surface hover:bg-danger/10 hover:border-danger/30 text-muted hover:text-danger cursor-pointer transition-colors"
                                title="Remove / Void serial"
                                aria-label="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          )}

          {(statusFilter === 'all' || statusFilter === 'sold') && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ReceiptText size={16} className="text-brand-crimson" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-brand-crimson-text">
                    Used
                  </h2>
                  <Badge variant="danger" className="text-[11px] font-mono">
                    {tableUsed.length}
                  </Badge>
                </div>
                <span className="text-[11px] text-brand-crimson-text/80">Billed to invoices</span>
              </div>

              {tableUsed.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-brand-crimson-border bg-brand-crimson-subtle/40 text-xs text-muted">
                  No used serial numbers match your filters.
                </div>
              ) : (
                <Table className="table-auto min-w-160" containerClassName="overflow-auto max-h-120">
                  <TableHead className="sticky top-0 z-10">
                    <TableRow>
                      <TableHeaderCell>Serial Number</TableHeaderCell>
                      <TableHeaderCell>Product</TableHeaderCell>
                      <TableHeaderCell>Invoice</TableHeaderCell>
                      <TableHeaderCell>Customer</TableHeaderCell>
                      <TableHeaderCell>Used Date</TableHeaderCell>
                      <TableHeaderCell className="text-right">Action</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableUsed.map((u) => {
                      const isCopied = copiedSerial === u.serial_number;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 font-mono font-semibold text-xs sm:text-sm text-brand-crimson-text">
                              <Barcode size={14} className="text-brand-crimson shrink-0" />
                              {u.serial_number}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-medium text-text truncate">
                                {u.products?.name || 'Unknown product'}
                              </div>
                              {u.products?.sku && (
                                <div className="text-[11px] font-mono text-muted">
                                  SKU: {u.products.sku}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {u.invoice ? (
                              <Link
                                to={`/admin/${storeCode}/invoices`}
                                className="font-mono text-xs font-semibold text-text underline-offset-2 hover:underline inline-flex items-center gap-1"
                              >
                                <span>{u.invoice.invoice_number}</span>
                                <ExternalLink size={10} className="text-muted" />
                              </Link>
                            ) : (
                              <Badge variant="default" className="text-[10px]">
                                No bill linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {u.invoice?.customer_name || 'Counter Sale'}
                          </TableCell>
                          <TableCell className="text-xs text-muted whitespace-nowrap">
                            {formatDate(u.invoice?.created_at || u.updated_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => handleCopy(u.serial_number)}
                              className="p-1.5 rounded-md border border-border bg-surface hover:bg-surface-subtle text-muted hover:text-text cursor-pointer transition-colors"
                              title="Copy serial number"
                              aria-label="Copy"
                            >
                              {isCopied ? (
                                <Check size={13} className="text-brand-sage" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateSerialsModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setTargetProductId('');
        }}
        storeId={storeId}
        products={activeProducts}
        initialProductId={targetProductId}
        onCreated={handleCreated}
      />

      <DeleteSerialModal
        isOpen={Boolean(unitToDelete)}
        onClose={() => setUnitToDelete(null)}
        unit={unitToDelete}
        storeId={storeId}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
