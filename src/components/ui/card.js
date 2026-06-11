import React from 'react';

export const Card = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`} {...props}>
    {children}
  </div>
));
Card.displayName = 'Card';

export const CardHeader = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>
    {children}
  </div>
));
CardHeader.displayName = 'CardHeader';

export const CardFooter = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`flex items-center p-6 pt-0 ${className}`} {...props}>
    {children}
  </div>
));
CardFooter.displayName = 'CardFooter';

export const CardTitle = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <h2 ref={ref} className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h2>
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <p ref={ref} className={`text-sm text-slate-500 dark:text-slate-400 ${className}`} {...props}>
    {children}
  </p>
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`p-6 pt-0 ${className}`} {...props}>
    {children}
  </div>
));
CardContent.displayName = 'CardContent';
