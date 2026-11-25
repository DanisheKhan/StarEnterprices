import { useDeferredValue, useMemo, useState } from 'react';
import { Modal, Input, Select } from '@/shared/ui';
import { useAddSerializedUnitsBulk } from '../hooks/useInventory';
import { MAX_SERIALS_PER_BATCH } from '../api/inventory.api';
import { getErrorMessage } from '@/shared/lib/errors';
import { cn } from '@/shared/lib/cn';
import { AlertCircle, Barcode, Keyboard, ListOrdered, Plus } from 'lucide-react';

const MIN_GENERATED_DIGITS = 4;

/**
 * @param {string} text
 * @returns {string[]}
 */
function parseManualSerials(text) {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * @param {{ prefix: string, start: number, quantity: number }} param0
 * @returns {string[]}
 */
function generateSerials({ prefix, start, quantity }) {
  const cleanPrefix = prefix.trim().toUpperCase();
  const digits = Math.max(MIN_GENERATED_DIGITS, String(start + quantity - 1).length);
  return Array.from({ length: quantity }, (_, i) => `${cleanPrefix}${String(start + i).padStart(digits, '0')}`);
}

export function CreateSerialsModal({ isOpen, onClose, storeId, products = [], initialProductId = '', onCreated }) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Serial Numbers" size="lg">
      <CreateSerialsForm
        key={`${isOpen ? 'open' : 'closed'}-${initialProductId}`}
        storeId={storeId}
        products={products}
        initialProductId={initialProductId}
        onClose={onClose}
        onCreated={onCreated}
      />
    </Modal>
  );
}

function CreateSerialsForm({ storeId, products, initialProductId = '', onClose, onCreated }) {
  const initialProduct = useMemo(
    () => products.find((p) => p.id === initialProductId),
    [products, initialProductId]
  );

  const [productId, setProductId] = useState(() => initialProductId || '');
  const [mode, setMode] = useState('manual');
  const [manualText, setManualText] = useState('');
  const deferredManualText = useDeferredValue(manualText);
  const [prefix, setPrefix] = useState(() => (initialProduct?.sku ? `${initialProduct.sku.toUpperCase()}-` : ''));
  const [startNumber, setStartNumber] = useState('1');
  const [quantity, setQuantity] = useState('10');
  const [conditionGrade, setConditionGrade] = useState('new');
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [purchaseCost, setPurchaseCost] = useState(() => String(initialProduct?.cost_price || 0));
  const [error, setError] = useState('');

  const createMutation = useAddSerializedUnitsBulk();

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.sku ? `${p.name} (${p.sku})` : p.name })),
    [products]
  );

  const parsedStart = parseInt(startNumber, 10);
  const parsedQuantity = parseInt(quantity, 10);
  const generateInputsValid =
    !isNaN(parsedStart) && parsedStart >= 0 && !isNaN(parsedQuantity) && parsedQuantity > 0;

  const { serials, manualDuplicateCount } = useMemo(() => {
    if (mode === 'manual') {
      const parsed = parseManualSerials(deferredManualText);
      const unique = [...new Set(parsed)];
      return { serials: unique, manualDuplicateCount: parsed.length - unique.length };
    }
    if (!generateInputsValid || parsedQuantity > MAX_SERIALS_PER_BATCH) {
      return { serials: [], manualDuplicateCount: 0 };
    }
    return {
      serials: generateSerials({ prefix, start: parsedStart, quantity: parsedQuantity }),
      manualDuplicateCount: 0,
    };
  }, [mode, deferredManualText, prefix, parsedStart, parsedQuantity, generateInputsValid]);

  const tooMany =
    mode === 'manual' ? serials.length > MAX_SERIALS_PER_BATCH : parsedQuantity > MAX_SERIALS_PER_BATCH;

  function handleProductChange(nextId) {
    setProductId(nextId);
    setError('');
    const product = products.find((p) => p.id === nextId);
    if (!product) return;
    if (!prefix.trim() && product.sku) setPrefix(`${product.sku.toUpperCase()}-`);
    setPurchaseCost(String(product.cost_price || 0));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productId) {
      setError('Select the product these serial numbers belong to.');
      return;
    }
    if (tooMany) {
      setError(`You can create up to ${MAX_SERIALS_PER_BATCH} serial numbers at a time.`);
      return;
    }
    if (serials.length === 0) {
      setError(mode === 'manual' ? 'Enter at least one serial number.' : 'Enter a valid starting number and quantity.');
      return;
    }

    setError('');
    try {
      const created = await createMutation.mutateAsync({
        storeId,
        productId,
        serialNumbers: serials,
        conditionGrade,
        purchaseCost,
        warrantyMonths,
      });
      onCreated?.(created.length);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-text min-w-0">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Select
        id="serials-product"
        label="Product"
        required
        placeholder={productOptions.length ? 'Select a product...' : 'No products in this store'}
        value={productId}
        onChange={(e) => handleProductChange(e.target.value)}
        options={productOptions}
      />

      <div className="bg-surface-subtle p-1 rounded-xl border border-border flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn(
            'flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none',
            mode === 'manual'
              ? 'bg-surface text-text shadow-2xs border border-border'
              : 'text-muted hover:text-text hover:bg-surface/50 border border-transparent'
          )}
        >
          <Keyboard size={14} />
          <span>Type or Scan</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('generate')}
          className={cn(
            'flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none',
            mode === 'generate'
              ? 'bg-surface text-text shadow-2xs border border-border'
              : 'text-muted hover:text-text hover:bg-surface/50 border border-transparent'
          )}
        >
          <ListOrdered size={14} />
          <span>Auto-generate</span>
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="serials-manual" className="text-xs font-bold text-text uppercase tracking-wider">
            Serial Numbers / IMEI
          </label>
          <textarea
            id="serials-manual"
            rows={6}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={'One per line, or separated by commas\nSN-94829104\nSN-94829105'}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-xs sm:text-sm font-mono text-text placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-sage"
          />
          <p className="text-xs text-muted">
            {serials.length} serial number{serials.length === 1 ? '' : 's'} ready
            {manualDuplicateCount > 0 && ` (${manualDuplicateCount} duplicate${manualDuplicateCount === 1 ? '' : 's'} ignored)`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              id="serials-prefix"
              label="Prefix"
              placeholder="e.g. SE-SOFA-"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            />
            <Input
              id="serials-start"
              label="Starting Number"
              type="number"
              min="0"
              value={startNumber}
              onChange={(e) => setStartNumber(e.target.value)}
            />
            <Input
              id="serials-quantity"
              label="Quantity"
              type="number"
              min="1"
              max={MAX_SERIALS_PER_BATCH}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          {serials.length > 0 && (
            <div className="p-3 rounded-xl border border-border bg-surface-subtle text-xs space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Preview</span>
              <div className="font-mono text-text flex flex-wrap gap-x-3 gap-y-1">
                {serials.slice(0, 3).map((s) => (
                  <span key={s}>{s}</span>
                ))}
                {serials.length > 4 && <span className="text-muted">...</span>}
                {serials.length > 3 && <span>{serials[serials.length - 1]}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
        <Select
          id="serials-grade"
          label="Condition Grade"
          value={conditionGrade}
          onChange={(e) => setConditionGrade(e.target.value)}
          options={[
            { value: 'new', label: 'Brand New (Sealed)' },
            { value: 'A', label: 'Grade A (Open Box / Flawless)' },
            { value: 'B', label: 'Grade B (Minor Wear)' },
            { value: 'refurbished', label: 'Refurbished' },
          ]}
        />
        <Select
          id="serials-warranty"
          label="Warranty"
          value={warrantyMonths}
          onChange={(e) => setWarrantyMonths(e.target.value)}
          options={[
            { value: '12', label: '12 Months (1 Year)' },
            { value: '24', label: '24 Months (2 Years)' },
            { value: '6', label: '6 Months' },
            { value: '0', label: 'No Warranty' },
          ]}
        />
        <Input
          id="serials-cost"
          label="Unit Purchase Cost (₹)"
          formatCommas
          value={purchaseCost}
          onChange={(e) => setPurchaseCost(e.target.value)}
        />
      </div>

      <p className="text-[11px] text-muted flex items-start gap-1.5">
        <Barcode size={13} className="shrink-0 mt-px" />
        <span>Each new serial number adds one unit to stock and becomes selectable in POS billing.</span>
      </p>

      <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-text hover:bg-surface-subtle transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || serials.length === 0 || tooMany}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-accent text-accent-fg hover:opacity-90 active:scale-[0.99] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          <Plus size={14} className="stroke-[2.5]" />
          <span>
            {createMutation.isPending
              ? 'Creating...'
              : `Create ${serials.length || ''} Serial Number${serials.length === 1 ? '' : 's'}`}
          </span>
        </button>
      </div>
    </form>
  );
}
