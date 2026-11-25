const LOCK_COUNT_ATTR = 'data-scroll-lock-count';

/**
 * Reference-counted body scroll lock so stacking/switching modals or drawers
 * never unlocks scrolling while another overlay remains open.
 */
export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  const current = Number(document.body.getAttribute(LOCK_COUNT_ATTR) || '0');
  const next = current + 1;
  document.body.setAttribute(LOCK_COUNT_ATTR, String(next));
  document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  const current = Number(document.body.getAttribute(LOCK_COUNT_ATTR) || '0');
  const next = Math.max(0, current - 1);
  if (next === 0) {
    document.body.removeAttribute(LOCK_COUNT_ATTR);
    document.body.style.overflow = '';
  } else {
    document.body.setAttribute(LOCK_COUNT_ATTR, String(next));
  }
}
