import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Badge,
  Input,
  Select,
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
import { formatDate } from '@/shared/lib/format';
import { getErrorMessage } from '@/shared/lib/errors';
import { AlertCircle, Barcode, CheckCircle2, PackageCheck, Plus, ReceiptText } from 'lucide-react';

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
  const [productFilter, setProductFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { data: serials = [], isLoading, error } = useStoreSerials(storeId);
  const { data: products = [] } = useProducts(storeId);

  const activeProducts = useMemo(() => products.filter((p) => p.is_active !== false), [products]);

  const productOptions = useMemo(() => {
    const map = new Map();
    serials.forEach((u) => {
      if (u.products?.id) map.set(u.products.id, u.products.name);
    });
    return [
      { value: '', label: 'All Products' },
      ...Array.from(map.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [serials]);

  const { unused, used } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = serials
      .filter((u) => !productFilter || u.product_id === productFilter)
      .map((u) => ({ ...u, invoice: latestInvoice(u) }))
      .filter(
        (u) =>
          !q ||
          u.serial_number?.toLowerCase().includes(q) ||
          u.products?.name?.toLowerCase().includes(q) ||
          u.products?.sku?.toLowerCase().includes(q) ||
          u.invoice?.invoice_number?.toLowerCase().includes(q) ||
          u.invoice?.customer_name?.toLowerCase().includes(q)
      );

    const soldAt = (u) => new Date(u.invoice?.created_at || u.updated_at).getTime();
    return {
      unused: filtered.filter((u) => u.status === 'in_stock'),
      used: filtered.filter((u) => u.status === 'sold').sort((a, b) => soldAt(b) - soldAt(a)),
    };
  }, [serials, search, productFilter]);

  function handleCreated(count) {
    setSuccessMsg(`${count} serial number${count === 1 ? '' : 's'} created and added to stock.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border min-w-0">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
            INVENTORY CONTROL
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">Serial Numbers</h1>
          <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
            Every billed item needs a serial number. An unused serial moves to used when it is billed. A used
            serial can be billed once more on a cash bill, after which it is removed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 bg-accent text-accent-fg hover:opacity-95 active:scale-[0.99] font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 shadow-xs self-start sm:self-auto"
        >
          <Plus size={15} className="stroke-[2.5]" />
          <span>Create Serial Numbers</span>
        </button>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-brand-sage-border bg-brand-sage-subtle p-3 text-xs text-brand-sage-text font-medium flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-brand-sage" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>Could not load serial numbers: {getErrorMessage(error)}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-xl border border-border bg-surface shadow-2xs">
        <div className="sm:col-span-8">
          <Input
            id="search-serials"
            placeholder="Search by serial number, product, SKU, invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:col-span-4">
          <Select
            id="filter-serial-product"
            options={productOptions}
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          />
        </div>
      </div>

      <section className="space-y-3">
        <SectionHeader
          icon={<PackageCheck size={16} className="text-brand-sage" />}
          title="Unused Serial Numbers"
          count={unused.length}
          caption="In stock and usable on any bill. Moves to used when billed."
        />
        {isLoading ? (
          <TableSkeleton />
        ) : unused.length === 0 ? (
          <EmptySection
            message={
              search || productFilter
                ? 'No unused serial numbers match your filters.'
                : 'No unused serial numbers yet. Create some to make units available for billing.'
            }
          />
        ) : (
          <Table className="table-auto min-w-160" containerClassName="overflow-auto max-h-120">
            <TableHead className="sticky top-0 z-10">
              <TableRow>
                <TableHeaderCell>Serial Number</TableHeaderCell>
                <TableHeaderCell>Product</TableHeaderCell>
                <TableHeaderCell>Grade / Warranty</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unused.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-mono font-semibold text-xs sm:text-sm">
                      <Barcode size={14} className="text-brand-sage shrink-0" />
                      {u.serial_number}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ProductCell product={u.products} />
                  </TableCell>
                  <TableCell className="text-xs text-muted whitespace-nowrap">
                    <span className="uppercase font-semibold text-text">{u.condition_grade}</span>
                    {' • '}
                    {u.warranty_months ? `${u.warranty_months}M warranty` : 'No warranty'}
                  </TableCell>
                  <TableCell className="text-xs text-muted whitespace-nowrap">{formatDate(u.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          icon={<ReceiptText size={16} className="text-muted" />}
          title="Used Serial Numbers"
          count={used.length}
          caption="Sold once. Billing it again on a cash bill removes it from this list."
        />
        {isLoading ? (
          <TableSkeleton />
        ) : used.length === 0 ? (
          <EmptySection
            message={
              search || productFilter
                ? 'No used serial numbers match your filters.'
                : 'No serial numbers have been sold yet.'
            }
          />
        ) : (
          <Table className="table-auto min-w-160" containerClassName="overflow-auto max-h-120">
            <TableHead className="sticky top-0 z-10">
              <TableRow>
                <TableHeaderCell>Serial Number</TableHeaderCell>
                <TableHeaderCell>Product</TableHeaderCell>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <TableHeaderCell>Customer</TableHeaderCell>
                <TableHeaderCell>Sold</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {used.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-mono font-semibold text-xs sm:text-sm text-muted">
                      <Barcode size={14} className="shrink-0" />
                      {u.serial_number}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ProductCell product={u.products} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {u.invoice ? (
                      <Link
                        to={`/admin/${storeCode}/invoices`}
                        className="font-mono text-xs font-semibold text-text underline-offset-2 hover:underline"
                      >
                        {u.invoice.invoice_number}
                      </Link>
                    ) : (
                      <Badge variant="default" className="text-[10px]">No bill linked</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{u.invoice?.customer_name || '-'}</TableCell>
                  <TableCell className="text-xs text-muted whitespace-nowrap">
                    {formatDate(u.invoice?.created_at || u.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <CreateSerialsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        storeId={storeId}
        products={activeProducts}
        onCreated={handleCreated}
      />
    </div>
  );
}

function SectionHeader({ icon, title, count, caption }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 px-1">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold uppercase tracking-wider text-text">{title}</h2>
        <Badge variant="default" className="text-[11px] font-mono">{count}</Badge>
      </div>
      <span className="text-[11px] text-muted">{caption}</span>
    </div>
  );
}

function ProductCell({ product }) {
  if (!product) return <span className="text-xs text-muted">Unknown product</span>;
  return (
    <div className="min-w-0">
      <div className="text-xs sm:text-sm font-medium text-text truncate">{product.name}</div>
      {product.sku && <div className="text-[11px] font-mono text-muted">SKU: {product.sku}</div>}
    </div>
  );
}

function EmptySection({ message }) {
  return (
    <div className="p-8 text-center rounded-xl border border-dashed border-border bg-surface text-xs text-muted">
      {message}
    </div>
  );
}
