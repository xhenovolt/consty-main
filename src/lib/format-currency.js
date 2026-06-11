/**
 * Currency Formatting Utilities
 * Centralized currency formatting for all Consty modules.
 * Base currency: UGX (Ugandan Shilling)
 */

/** Supported currencies with their locale and display settings */
export const CURRENCY_CONFIG = {
  UGX: { locale: 'en-UG', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  USD: { locale: 'en-US', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  EUR: { locale: 'de-DE', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  GBP: { locale: 'en-GB', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  KES: { locale: 'en-KE', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  TZS: { locale: 'sw-TZ', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  RWF: { locale: 'rw-RW', minimumFractionDigits: 0, maximumFractionDigits: 0 },
};

/**
 * Format a number as a currency string.
 * @param {number|string} amount - The amount to format
 * @param {string} [currency='UGX'] - ISO 4217 currency code
 * @returns {string} Formatted currency string (e.g. "UGX 1,250,000")
 */
export function formatCurrency(amount, currency = 'UGX') {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const config = CURRENCY_CONFIG[currency] ?? {
    locale: 'en-UG',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: config.minimumFractionDigits,
    maximumFractionDigits: config.maximumFractionDigits,
  }).format(num);
}

/**
 * Format a number as UGX (shorthand for the default base currency).
 * @param {number|string} amount
 * @returns {string}
 */
export function formatUGX(amount) {
  return formatCurrency(amount, 'UGX');
}

/**
 * Parse a formatted currency string back to a number.
 * @param {string} str - Formatted currency string
 * @returns {number}
 */
export function parseCurrency(str) {
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/[^0-9.\-]/g, '')) || 0;
}

/**
 * List of supported currency options for select inputs.
 * @type {{ value: string, label: string }[]}
 */
export const CURRENCY_OPTIONS = [
  { value: 'UGX', label: 'UGX – Ugandan Shilling' },
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'KES', label: 'KES – Kenyan Shilling' },
  { value: 'TZS', label: 'TZS – Tanzanian Shilling' },
  { value: 'RWF', label: 'RWF – Rwandan Franc' },
];

export default formatCurrency;
