/**
 * formatCurrency.ts
 * Typed currency formatting utilities for Consty.
 * System default: UGX (Ugandan Shilling)
 *
 * Usage:
 *   formatCurrency(700000)              → "UGX 700,000"
 *   formatCurrency(1200000, 'UGX')      → "UGX 1,200,000"
 *   formatCurrency(500, 'USD')          → "$500.00"
 */

export type SupportedCurrency = 'UGX' | 'USD' | 'EUR' | 'GBP' | 'KES' | 'TZS' | 'RWF';

interface CurrencyConfig {
  locale: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
}

export const CURRENCY_CONFIG: Record<SupportedCurrency, CurrencyConfig> = {
  UGX: { locale: 'en-UG', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  USD: { locale: 'en-US', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  EUR: { locale: 'de-DE', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  GBP: { locale: 'en-GB', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  KES: { locale: 'en-KE', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  TZS: { locale: 'sw-TZ', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  RWF: { locale: 'rw-RW', minimumFractionDigits: 0, maximumFractionDigits: 0 },
};

/** Default system currency */
export const DEFAULT_CURRENCY: SupportedCurrency = 'UGX';

/**
 * Format a number as a currency string.
 * Never shows a bare "$" — uses proper locale-aware formatting.
 *
 * @param amount  - The numeric amount
 * @param currency - ISO 4217 code (default: 'UGX')
 * @returns Formatted string e.g. "UGX 700,000"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0')) || 0;
  const config: CurrencyConfig = (CURRENCY_CONFIG as Record<string, CurrencyConfig>)[currency] ?? {
    locale: 'en-UG',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: config.minimumFractionDigits,
      maximumFractionDigits: config.maximumFractionDigits,
    }).format(num);
  } catch {
    // Fallback for unknown currency codes
    return `${currency} ${num.toLocaleString()}`;
  }
}

/**
 * Format as UGX — shorthand for the Consty system default.
 * Example: formatUGX(700000) → "UGX 700,000"
 */
export function formatUGX(amount: number | string | null | undefined): string {
  return formatCurrency(amount, 'UGX');
}

/**
 * Compact formatter for large UGX amounts (for dashboards).
 * Example: fmtCompact(1200000) → "UGX 1.2M"
 */
export function fmtCompact(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0')) || 0;
  if (num >= 1_000_000_000) return `${currency} ${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${currency} ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${currency} ${(num / 1_000).toFixed(1)}K`;
  return formatCurrency(num, currency);
}

/**
 * Parse a formatted currency string back to a number.
 * Removes currency symbols, commas, etc.
 */
export function parseCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}
