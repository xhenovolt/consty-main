'use client';

/**
 * useFormSubmit — Universal form transaction controller for Consty.
 *
 * Prevents duplicate submissions, provides loading state, and integrates
 * with the global toast system for success/error feedback.
 *
 * Usage:
 *   const { submitting, handleSubmit } = useFormSubmit();
 *
 *   <form onSubmit={handleSubmit(async () => {
 *     const res = await fetchWithAuth('/api/deals', { method: 'POST', ... });
 *     const json = res.json ? await res.json() : res;
 *     if (!json.success) throw new Error(json.error || 'Failed');
 *     return json;
 *   }, {
 *     successMessage: 'Deal created successfully',
 *     onSuccess: (json) => router.push(`/app/deals/${json.data.id}`),
 *   })}>
 *     <button disabled={submitting}>
 *       {submitting ? 'Saving...' : 'Save'}
 *     </button>
 *   </form>
 */

import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';

export function useFormSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const lockRef = useRef(false);
  const toast = useToast();

  const handleSubmit = useCallback((asyncFn, options = {}) => {
    return async (e) => {
      if (e && e.preventDefault) e.preventDefault();

      // Prevent double-submit
      if (lockRef.current) return;
      lockRef.current = true;
      setSubmitting(true);

      try {
        const result = await asyncFn();

        if (options.successMessage) {
          toast.success(options.successMessage);
        }

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const message = err?.message || 'Something went wrong';
        toast.error(options.errorMessage || message);

        if (options.onError) {
          options.onError(err);
        }
      } finally {
        lockRef.current = false;
        setSubmitting(false);
      }
    };
  }, [toast]);

  return { submitting, handleSubmit };
}
