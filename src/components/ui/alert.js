import React from 'react';

export const Alert = React.forwardRef(({ children, className = '', variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-white text-slate-950 border border-slate-200 [&>svg]:text-slate-950',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
  };

  return (
    <div
      ref={ref}
      className={`relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground ${variants[variant] || variants.default} ${className}`}
      role="alert"
      {...props}
    >
      {children}
    </div>
  );
});
Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <h5 ref={ref} className={`mb-1 font-medium leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h5>
));
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`text-sm [&_p]:leading-relaxed ${className}`} {...props}>
    {children}
  </div>
));
AlertDescription.displayName = 'AlertDescription';
