import React, { useState, createContext, useContext } from 'react';

const AlertDialogContext = createContext(null);

export const AlertDialog = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(open ?? false);
  
  return (
    <AlertDialogContext.Provider value={{ isOpen, setIsOpen, onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
};

export const AlertDialogTrigger = React.forwardRef(({ children, asChild, ...props }, ref) => {
  const context = useContext(AlertDialogContext);
  
  if (!context) {
    console.warn('AlertDialogTrigger must be used within AlertDialog');
    return null;
  }

  const trigger = React.cloneElement(children, {
    ref,
    onClick: () => context.setIsOpen(true),
    ...props,
  });

  return trigger;
});
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

export const AlertDialogContent = React.forwardRef(({ children, className = '', ...props }, ref) => {
  const context = useContext(AlertDialogContext);
  
  if (!context?.isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => context.setIsOpen(false)}
      />
      <div
        ref={ref}
        className={`fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-slate-200 bg-white shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] ${className}`}
        {...props}
      >
        {children}
      </div>
    </>
  );
});
AlertDialogContent.displayName = 'AlertDialogContent';

export const AlertDialogHeader = ({ ...props }) => (
  <div className="flex flex-col space-y-2 text-center sm:text-left" {...props} />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

export const AlertDialogFooter = ({ ...props }) => (
  <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2" {...props} />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

export const AlertDialogTitle = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <h2 ref={ref} className={`text-lg font-semibold ${className}`} {...props}>
    {children}
  </h2>
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

export const AlertDialogDescription = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <p ref={ref} className={`text-sm text-slate-500 ${className}`} {...props}>
    {children}
  </p>
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

export const AlertDialogAction = React.forwardRef(({ children, onClick, ...props }, ref) => {
  const context = useContext(AlertDialogContext);
  
  return (
    <button
      ref={ref}
      className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:opacity-50"
      onClick={(e) => {
        context?.setIsOpen(false);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
AlertDialogAction.displayName = 'AlertDialogAction';

export const AlertDialogCancel = React.forwardRef(({ children, onClick, ...props }, ref) => {
  const context = useContext(AlertDialogContext);
  
  return (
    <button
      ref={ref}
      className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
      onClick={(e) => {
        context?.setIsOpen(false);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
AlertDialogCancel.displayName = 'AlertDialogCancel';
