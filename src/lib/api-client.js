'use client';

/**
 * Global API Client — Zero-Silence Policy
 * Every API call passes through this wrapper.
 * Automatically shows loading, catches errors, and shows success.
 */

import Swal from 'sweetalert2';

let _toastRef = null;

/** Register the toast API from ToastProvider */
export function registerToast(toastApi) {
  _toastRef = toastApi;
}

function getToast() {
  return _toastRef;
}

/**
 * Core API request handler
 * @param {string} url - API endpoint
 * @param {object} options - fetch options + feedback config
 * @param {string} options.method - HTTP method
 * @param {object} options.body - Request body (auto-stringified)
 * @param {string} options.successMessage - Toast message on success
 * @param {string} options.errorMessage - Custom error message override
 * @param {boolean} options.showSuccess - Show success toast (default: true if successMessage provided)
 * @param {boolean} options.showError - Show error toast (default: true)
 * @param {boolean} options.silent - Suppress all toasts
 * @param {object} options.headers - Additional headers
 * @returns {Promise<{ok: boolean, data: any, error: string|null, status: number}>}
 */
export async function apiRequest(url, options = {}) {
  const {
    method = 'GET',
    body,
    successMessage,
    errorMessage,
    showSuccess = !!successMessage,
    showError = true,
    silent = false,
    headers = {},
    ...fetchOptions
  } = options;

  const toast = getToast();

  try {
    const fetchOpts = {
      method,
      credentials: 'include',
      headers: {
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...fetchOptions,
    };

    if (body) {
      fetchOpts.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    const res = await fetch(url, fetchOpts);
    let data = null;

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errMsg = data?.error || data?.message || errorMessage || `Request failed (${res.status})`;
      if (!silent && showError && toast) {
        toast.error(errMsg, { title: 'Error' });
      }
      return { ok: false, data, error: errMsg, status: res.status };
    }

    if (!silent && showSuccess && toast) {
      toast.success(successMessage || 'Success', { title: 'Done' });
    }

    return { ok: true, data: data?.data ?? data, error: null, status: res.status };
  } catch (err) {
    const errMsg = err?.message || 'Network error. Please try again.';
    if (!silent && showError && toast) {
      toast.error(errMsg, { title: 'Connection Error' });
    }
    return { ok: false, data: null, error: errMsg, status: 0 };
  }
}

/** Shorthand helpers */
export const api = {
  get: (url, opts) => apiRequest(url, { method: 'GET', ...opts }),
  post: (url, body, opts) => apiRequest(url, { method: 'POST', body, ...opts }),
  put: (url, body, opts) => apiRequest(url, { method: 'PUT', body, ...opts }),
  patch: (url, body, opts) => apiRequest(url, { method: 'PATCH', body, ...opts }),
  delete: (url, opts) => apiRequest(url, { method: 'DELETE', ...opts }),
};

/**
 * SweetAlert2 Confirmation Dialog
 */
export async function confirmAction({
  title = 'Are you sure?',
  text = '',
  icon = 'warning',
  confirmText = 'Yes',
  cancelText = 'Cancel',
  confirmColor = '#3b82f6',
  cancelColor = '#6b7280',
} = {}) {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: confirmColor,
    cancelButtonColor: cancelColor,
    customClass: {
      popup: 'rounded-xl',
      title: 'text-lg',
    },
  });
  return result.isConfirmed;
}

/**
 * SweetAlert2 Success Alert
 */
export function alertSuccess(title, text) {
  return Swal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonColor: '#10b981',
    customClass: { popup: 'rounded-xl' },
  });
}

/**
 * SweetAlert2 Error Alert
 */
export function alertError(title, text) {
  return Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonColor: '#ef4444',
    customClass: { popup: 'rounded-xl' },
  });
}
