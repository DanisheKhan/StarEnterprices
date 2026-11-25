import { cn } from '@/shared/lib/cn';

/**
 * Structured 3-zone operational record card used consistently for invoices,
 * dealer bills, supplier ledgers, and transaction/intake records.
 * @param {Object} props
 * @param {import('react').ElementType} [props.as]
 * @param {string} [props.className]
 * @param {import('react').ReactNode} props.children
 */
export function RecordCard({ as: Tag = 'article', className, children, ...rest }) {
  return (
    <Tag
      className={cn(
        'bg-surface border border-border rounded-xl shadow-2xs hover:border-border-strong transition-colors overflow-hidden min-w-0',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Top metadata strip for a RecordCard (ID, document type badge, timestamp, status pills).
 */
export function RecordCardHeader({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        'px-4 sm:px-5 py-3 bg-surface-subtle/60 border-b border-border flex flex-wrap items-center justify-between gap-2.5 min-w-0',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Responsive 12-column body with full-height horizontal (mobile) and vertical (desktop) dividers.
 */
export function RecordCardBody({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-12 items-stretch divide-y md:divide-y-0 md:divide-x divide-border/70 min-w-0',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Individual column inside RecordCardBody.
 */
export function RecordCardSection({ className, children, ...rest }) {
  return (
    <div className={cn('p-4 sm:px-5 sm:py-4 min-w-0', className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * Uppercase micro-heading with optional icon and trailing count/meta inside RecordCardSection.
 */
export function RecordCardSectionTitle({ icon: Icon, iconClassName, meta, className, children }) {
  return (
    <div
      className={cn(
        'text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2 min-w-0',
        className
      )}
    >
      {Icon && <Icon size={12} className={cn('text-brand-sage shrink-0', iconClassName)} />}
      <span className="truncate">{children}</span>
      {meta && <span className="text-[10px] font-medium text-muted normal-case shrink-0">{meta}</span>}
    </div>
  );
}

/**
 * Crisp line-item pill inside a RecordCard (product/stock line with qty, unit price, and optional sub-row).
 */
export function RecordCardLineItem({
  title,
  qtyLabel,
  subContent,
  className,
}) {
  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg bg-surface-subtle/80 border border-border/80 text-xs space-y-1 min-w-0',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-text font-semibold truncate" title={title}>
          {title}
        </span>
        {qtyLabel && (
          <span className="font-mono tabular-nums text-muted text-[11px] shrink-0 font-semibold">
            {qtyLabel}
          </span>
        )}
      </div>
      {subContent && <div className="min-w-0">{subContent}</div>}
    </div>
  );
}

/**
 * Bottom summary & action toolbar of a RecordCard.
 */
export function RecordCardFooter({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        'px-4 sm:px-5 py-2.5 bg-surface-subtle/50 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

const actionVariants = {
  neutral:
    'border border-border bg-surface text-text hover:bg-surface-subtle hover:border-border-strong',
  sage:
    'border border-border bg-surface text-muted hover:border-brand-sage-border hover:text-brand-sage-text hover:bg-brand-sage-subtle',
  'sage-active':
    'border border-brand-sage-border bg-brand-sage-subtle text-brand-sage-text hover:opacity-90',
  'amber-solid':
    'border border-transparent bg-brand-gold text-white hover:bg-brand-gold-hover font-bold',
  danger:
    'border border-border bg-surface text-muted hover:text-brand-crimson-text hover:border-brand-crimson-border hover:bg-brand-crimson-subtle',
  primary:
    'border border-transparent bg-accent text-accent-fg hover:opacity-95 font-bold',
};

/**
 * Standardized compact action button or Link inside RecordCardFooter.
 * @param {Object} props
 * @param {'neutral'|'sage'|'sage-active'|'amber-solid'|'danger'|'primary'} [props.variant]
 * @param {import('react').ElementType} [props.as]
 * @param {string} [props.className]
 * @param {import('react').ReactNode} props.children
 */
export function RecordCardAction({
  variant = 'neutral',
  as: Tag = 'button',
  className,
  children,
  ...rest
}) {
  const isButton = Tag === 'button';
  return (
    <Tag
      className={cn(
        'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 select-none active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none',
        actionVariants[variant] || actionVariants.neutral,
        className
      )}
      {...(isButton ? { type: rest.type ?? 'button' } : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}
