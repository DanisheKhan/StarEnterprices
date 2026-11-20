import { useState } from 'react';
import { Modal } from '@/shared/ui';
import { useRemoveSerializedUnit } from '../hooks/useInventory';
import { getErrorMessage } from '@/shared/lib/errors';
import { AlertCircle, AlertTriangle, Barcode, Trash2 } from 'lucide-react';

export function DeleteSerialModal({ isOpen, onClose, unit, storeId, onDeleted }) {
  const [error, setError] = useState('');
  const removeMutation = useRemoveSerializedUnit();

  if (!isOpen || !unit) return null;

  const productName = unit.products?.name || 'Selected product';
  const sku = unit.products?.sku || '';
  const serial = unit.serial_number;

  async function handleDelete() {
    setError('');
    try {
      await removeMutation.mutateAsync({
        unitId: unit.id,
        storeId,
        productId: unit.product_id || unit.products?.id,
        newStatus: 'void',
        notes: 'Voided via serial numbers console',
      });
      onDeleted?.(serial);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Remove Serial Number" size="sm">
      <div className="space-y-4 text-text">
        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl border border-danger/20 bg-danger/5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-danger">Void this serial number?</p>
            <p className="text-muted leading-relaxed">
              This unit will be removed from active stock and your available inventory count will decrease by 1.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
          <div className="text-[11px] font-mono font-semibold text-text flex items-center gap-2">
            <Barcode size={15} className="text-muted shrink-0" />
            <span className="bg-surface px-2 py-0.5 rounded border border-border">{serial}</span>
          </div>
          <div className="text-xs text-muted">
            <span className="font-medium text-text">{productName}</span>
            {sku && <span className="font-mono text-[11px] block mt-0.5">SKU: {sku}</span>}
          </div>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={removeMutation.isPending}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-text hover:bg-surface-subtle transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={removeMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-danger text-white hover:opacity-95 active:scale-[0.99] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>{removeMutation.isPending ? 'Removing...' : 'Remove Serial'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
