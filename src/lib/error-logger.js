/**
 * ERROR LOGGER - Client-side error capture and auto-reporting
 * 
 * Captures frontend errors and automatically logs them to the API
 * Ensures no errors go unnoticed
 */

let isInitialized = false;
let bufferedErrors = [];
const MAX_BUFFER = 100; // Don't overflow memory

/**
 * Initialize global error handlers
 */
export function initializeErrorLogger() {
  if (isInitialized) return;
  isInitialized = true;

  // ── 1. Capture unhandled errors ──
  window.addEventListener('error', (event) => {
    logError({
      type: 'uncaught_error',
      message: event.message,
      errorCode: 'ERR_UNCAUGHT',
      stack: event.error?.stack || '',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });

  // ── 2. Capture unhandled promise rejections ──
  window.addEventListener('unhandledrejection', (event) => {
    logError({
      type: 'unhandled_rejection',
      message: event.reason?.message || String(event.reason),
      errorCode: 'ERR_UNHANDLED_REJECTION',
      stack: event.reason?.stack || '',
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });

  console.log('[ErrorLogger] Global error handlers installed');
}

/**
 * Safe array map — catches "e.map is not a function"
 * @param {*} arr - Value that should be an array
 * @param {Function} fn - Mapping function
 * @returns {Array} Empty array if not array-like, otherwise mapped result
 */
export function safeMap(arr, fn) {
  if (!Array.isArray(arr)) {
    console.warn('[safeMap] Expected array but got', typeof arr, arr);
    return [];
  }
  try {
    return arr.map(fn);
  } catch (err) {
    console.error('[safeMap] Error mapping array:', err.message);
    return [];
  }
}

/**
 * Safe filter — similar safety wrapper
 */
export function safeFilter(arr, fn) {
  if (!Array.isArray(arr)) {
    console.warn('[safeFilter] Expected array but got', typeof arr);
    return [];
  }
  try {
    return arr.filter(fn);
  } catch (err) {
    console.error('[safeFilter] Error filtering array:', err.message);
    return [];
  }
}

/**
 * Safe reduce
 */
export function safeReduce(arr, fn, initial) {
  if (!Array.isArray(arr)) {
    console.warn('[safeReduce] Expected array but got', typeof arr);
    return initial;
  }
  try {
    return arr.reduce(fn, initial);
  } catch (err) {
    console.error('[safeReduce] Error reducing array:', err.message);
    return initial;
  }
}

/**
 * High-order component helper: safe forEach
 */
export function safeForEach(arr, fn) {
  if (!Array.isArray(arr)) {
    console.warn('[safeForEach] Expected array but got', typeof arr);
    return;
  }
  try {
    arr.forEach(fn);
  } catch (err) {
    console.error('[safeForEach] Error iterating:', err.message);
  }
}

/**
 * Log an error (buffer locally + send to API)
 */
async function logError(errorData) {
  // ── Prevent infinite loops ──
  if (errorData.message?.includes('Failed to fetch') && errorData.message?.includes('/api/issues')) {
    return;
  }

  const issuPayload = {
    system_id: 'Consty',
    title: errorData.message || 'Unknown Error',
    description: `Stack Trace:\n${errorData.stack}`,
    severity: errorData.severity || 'high',
    source: 'auto',
    error_code: errorData.errorCode || 'ERR_UNKNOWN',
    error_stack: errorData.stack || '',
    context: {
      type: errorData.type,
      url: errorData.url,
      userAgent: errorData.userAgent,
      filename: errorData.filename,
      lineno: errorData.lineno,
      colno: errorData.colno,
    },
  };

  // Buffer locally (in case API is down)
  bufferedErrors.push(issuPayload);
  if (bufferedErrors.length > MAX_BUFFER) {
    bufferedErrors.shift();
  }

  // ── Send to API asynchronously ──
  try {
    const res = await fetch('/api/issues/auto-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issuPayload),
      credentials: 'include',
    });

    if (!res.ok) {
      console.warn('[ErrorLogger] Failed to log error:', res.status);
    }
  } catch (err) {
    // Silently fail — don't create a loop
    console.warn('[ErrorLogger] Could not send error to API', err.message);
  }
}

/**
 * Manually log an error (for caught exceptions)
 */
export async function reportError(message, options = {}) {
  const error = {
    message,
    severity: options.severity || 'medium',
    errorCode: options.errorCode || 'ERR_MANUAL',
    stack: options.stack || new Error().stack,
    type: 'manual_report',
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...options,
  };
  await logError(error);
}

/**
 * Get buffered errors (for debugging/testing)
 */
export function getBufferedErrors() {
  return [...bufferedErrors];
}

/**
 * Clear buffer
 */
export function clearErrorBuffer() {
  bufferedErrors = [];
}

export default {
  initializeErrorLogger,
  safeMap,
  safeFilter,
  safeReduce,
  safeForEach,
  reportError,
  getBufferedErrors,
  clearErrorBuffer,
};
