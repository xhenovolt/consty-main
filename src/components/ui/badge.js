import React from 'react';

export const Badge = React.forwardRef(({ children, className = '', variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80',
    secondary: 'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80',
    destructive: 'border-transparent bg-red-500 text-white hover:bg-red-600',
    outline: 'text-slate-950',
  };

  return (
    <div
      ref={ref}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 ${variants[variant] || variants.default} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
Badge.displayName = 'Badge';
