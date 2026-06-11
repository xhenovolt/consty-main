/**
 * Environment Variables Configuration
 * Next.js automatically loads .env.local, so these are available via process.env
 */

import { APP_NAME } from './product.js';

// Export validated environment variables
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Optional environment variables
export const API_URL = process.env.API_URL || 'http://localhost:3000';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function getFallbackOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || '';
}

function getFallbackHostname() {
  try {
    return new URL(getFallbackOrigin()).hostname;
  } catch {
    return 'localhost';
  }
}

// WebAuthn / Passkeys configuration
// WEBAUTHN_RP_ID     — hostname only (e.g. "consty.example.com" or "localhost")
// WEBAUTHN_ORIGIN    — full origin  (e.g. "https://consty.example.com" or "http://localhost:3000")
// WEBAUTHN_RP_NAME   — human-readable app name shown in authenticator dialog
export const WEBAUTHN_RP_ID = process.env.WEBAUTHN_RP_ID || (NODE_ENV === 'production' ? getFallbackHostname() : 'localhost');
export const WEBAUTHN_ORIGIN =
  process.env.WEBAUTHN_ORIGIN ||
  (NODE_ENV === 'production' ? getFallbackOrigin() || 'http://localhost:3000' : `http://localhost:${process.env.PORT || 3000}`);
export const WEBAUTHN_RP_NAME = process.env.WEBAUTHN_RP_NAME || APP_NAME;

/**
 * Check if running in production
 */
export const isProduction = NODE_ENV === 'production';

/**
 * Check if running in development
 */
export const isDevelopment = NODE_ENV === 'development';

/**
 * Check if running in testing
 */
export const isTesting = NODE_ENV === 'test';

// Warn about missing required variables in development
if (isDevelopment && !DATABASE_URL) {
  console.warn(
    'Warning: DATABASE_URL is not set. Database features will be unavailable.'
  );
}

export default {
  DATABASE_URL,
  NODE_ENV,
  API_URL,
  LOG_LEVEL,
  WEBAUTHN_RP_ID,
  WEBAUTHN_ORIGIN,
  WEBAUTHN_RP_NAME,
  isProduction,
  isDevelopment,
  isTesting,
};
  
