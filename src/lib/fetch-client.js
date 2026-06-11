/**
 * Client-side fetch utility
 * Automatically includes credentials and parses JSON
 */

/**
 * Fetch with automatic credential inclusion and JSON parsing
 * Returns parsed JSON object with a .json() shim for backward compatibility
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Parsed JSON response
 */
export async function fetchWithAuth(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
  });
  try {
    const data = await res.json();
    // Backward compat: old callers do `.json()` on the result
    if (typeof data === 'object' && data !== null) {
      data.json = () => Promise.resolve(data);
      data._status = res.status;
      data._ok = res.ok;
    }
    return data;
  } catch {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
}

export default fetchWithAuth;
