import { cn } from '@/shared/lib/cn';

const variants = {
  default: 'border-border bg-surface-subtle text-text',
  outline: 'border-border bg-surface text-muted',
  success: 'border-brand-sage-border bg-brand-sage-subtle text-brand-sage-text',
  sage: 'border-brand-sage-border bg-brand-sage-subtle text-brand-sage-text',
  amber: 'border-pastel-amber-border bg-pastel-amber text-pastel-amber-text',
  warning: 'border-pastel-amber-border bg-pastel-amber text-pastel-amber-text',
  purple: 'border-pastel-purple-border bg-pastel-purple text-pastel-purple-text',
  blue: 'border-brand-blue-border bg-brand-blue-subtle text-brand-blue-text',
  danger: 'border-brand-crimson-border bg-brand-crimson-subtle text-brand-crimson-text',
  crimson: 'border-brand-crimson-border bg-brand-crimson-subtle text-brand-crimson-text',
  accent: 'border-accent bg-accent text-accent-fg',
};

/**
 * Token-driven status badge consistent across light and dark themes.
 * @param {Object} props
 * @param {'default'|'outline'|'success'|'sage'|'amber'|'warning'|'purple'|'blue'|'danger'|'crimson'|'accent'} [props.variant]
 * @param {string} [props.className]
 * @param {import('react').ReactNode} props.children
 */
export function Badge({ variant = 'default', className, children, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 select-none',
        variants[variant] || variants.default,
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
