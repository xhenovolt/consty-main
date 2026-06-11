'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerToast } from '@/lib/api-client';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-800 dark:text-emerald-200' },
  error:   { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', text: 'text-red-800 dark:text-red-200' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-800 dark:text-amber-200' },
  info:    { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', text: 'text-blue-800 dark:text-blue-200' },
};

let _toastId = 0;

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info;
  const colors = COLORS[toast.type] || COLORS.info;

  useEffect(() => {
    if (toast.duration !== Infinity) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full ${colors.bg} ${colors.border}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${colors.icon}`} />
      <div className="flex-1 min-w-0">
        {toast.title && <p className={`text-sm font-semibold ${colors.text}`}>{toast.title}</p>}
        <p className={`text-sm ${colors.text} ${toast.title ? 'opacity-80' : ''}`}>{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className={`shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition ${colors.icon}`}>
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type, message, options = {}) => {
    const id = ++_toastId;
    setToasts(prev => [...prev.slice(-4), { id, type, message, ...options }]);
    return id;
  }, []);

  const api = useMemo(() => ({
    success: (msg, opts) => toast('success', msg, opts),
    error:   (msg, opts) => toast('error', msg, opts),
    warning: (msg, opts) => toast('warning', msg, opts),
    info:    (msg, opts) => toast('info', msg, opts),
    dismiss,
    // Legacy addToast support
    addToast: ({ type, title, message }) => toast(type, message, { title }),
  }), [toast, dismiss]);

  // Register globally so api-client can show toasts
  useEffect(() => {
    registerToast(api);
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  // Return both direct API and addToast for backward compat
  return { ...ctx, addToast: ctx.addToast };
}
