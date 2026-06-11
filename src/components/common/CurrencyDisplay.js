'use client';

/**
 * Simple currency display component
 * Formats a monetary amount with $ symbol
 */
export default function CurrencyDisplay({ amount, className = '', showCode = false }) {
  const formatted = parseFloat(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return (
    <span className={className}>
      {showCode ? 'USD ' : '$'}{formatted}
    </span>
  );
}
