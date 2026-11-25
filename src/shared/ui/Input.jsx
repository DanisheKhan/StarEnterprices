import { forwardRef, useLayoutEffect, useRef } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatIndianNumber, parseNumericInput, toTitleCase } from '@/shared/lib/format';

/**
 * Bare input that converts entered text to Title / Pascal Case while preserving cursor position.
 */
export const TitleCaseInput = forwardRef(function TitleCaseInput(
  { value, onChange, className, type = 'text', ...rest },
  forwardedRef
) {
  const innerRef = useRef(null);
  const cursorPosRef = useRef(null);
  const displayValue = toTitleCase(value ?? '');

  function assignRef(node) {
    innerRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }

  useLayoutEffect(() => {
    const pos = cursorPosRef.current;
    const el = innerRef.current;
    cursorPosRef.current = null;
    if (pos === null || !el || document.activeElement !== el) return;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // Ignore selection errors
    }
  }, [displayValue]);

  function handleChange(e) {
    cursorPosRef.current = e.target.selectionStart ?? null;
    const formatted = toTitleCase(e.target.value);
    if (onChange) {
      onChange({
        ...e,
        target: { ...e.target, value: formatted },
        currentTarget: { ...e.currentTarget, value: formatted },
      });
    }
  }

  return (
    <input
      ref={assignRef}
      type={type}
      value={displayValue}
      onChange={handleChange}
      className={className}
      {...rest}
    />
  );
});

/**
 * Bare input that displays values with Indian comma grouping (en-IN) while emitting
 * clean unformatted numeric strings via onChange.
 */
export const CurrencyInput = forwardRef(function CurrencyInput(
  { value, onChange, allowDecimals = true, className, type: _type, ...rest },
  forwardedRef
) {
  const innerRef = useRef(null);
  const cursorStateRef = useRef(null);
  const displayValue = formatIndianNumber(value);

  function assignRef(node) {
    innerRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }

  useLayoutEffect(() => {
    const pending = cursorStateRef.current;
    const el = innerRef.current;
    if (!pending || !el || document.activeElement !== el) {
      cursorStateRef.current = null;
      return;
    }

    const { tokensBefore } = pending;
    cursorStateRef.current = null;

    let seen = 0;
    let nextPos = displayValue.length;
    if (tokensBefore === 0) {
      nextPos = 0;
    } else {
      for (let i = 0; i < displayValue.length; i += 1) {
        if (/[0-9.]/.test(displayValue[i])) {
          seen += 1;
          if (seen >= tokensBefore) {
            nextPos = i + 1;
            break;
          }
        }
      }
    }
    try {
      el.setSelectionRange(nextPos, nextPos);
    } catch {
      // Ignore selection errors on unsupported input types
    }
  }, [displayValue]);

  function handleChange(e) {
    const raw = e.target.value;
    const selStart = e.target.selectionStart ?? raw.length;
    const tokensBefore = raw.slice(0, selStart).replace(/[^0-9.]/g, '').length;
    const cleaned = parseNumericInput(raw, { allowDecimals });

    cursorStateRef.current = { tokensBefore };

    if (onChange) {
      onChange({
        ...e,
        target: { ...e.target, value: cleaned },
        currentTarget: { ...e.currentTarget, value: cleaned },
      });
    }
  }

  return (
    <input
      ref={assignRef}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={displayValue}
      onChange={handleChange}
      className={className}
      {...rest}
    />
  );
});

/**
 * @param {Object} props
 * @param {string} props.id
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {string} [props.className]
 * @param {boolean} [props.formatCommas]
 * @param {boolean} [props.allowDecimals]
 * @param {boolean} [props.titleCase]
 */
export const Input = forwardRef(function Input(
  {
    id,
    label,
    hint,
    error,
    className,
    required,
    formatCommas = false,
    allowDecimals = true,
    titleCase = false,
    ...rest
  },
  ref
) {
  const inputClassName = cn(
    'w-full min-h-10 rounded-lg border bg-surface px-3.5 py-2 text-xs sm:text-sm text-text transition-colors',
    'border-border placeholder:text-muted',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-sage',
    error && 'border-danger focus-visible:outline-danger',
    className
  );

  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-text uppercase tracking-wider flex items-center">
          <span>{label}</span>
          {required && (
            <span className="text-danger ml-0.5 font-bold" aria-hidden="true" title="Required field">*</span>
          )}
        </label>
      )}
      {formatCommas ? (
        <CurrencyInput
          ref={ref}
          id={id}
          required={required}
          allowDecimals={allowDecimals}
          className={inputClassName}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...rest}
        />
      ) : titleCase ? (
        <TitleCaseInput
          ref={ref}
          id={id}
          required={required}
          className={inputClassName}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...rest}
        />
      ) : (
        <input
          ref={ref}
          id={id}
          required={required}
          className={inputClassName}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...rest}
        />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger font-medium">
          {error}
        </p>
      )}
    </div>
  );
});
