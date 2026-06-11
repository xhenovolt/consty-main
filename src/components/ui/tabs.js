import React, { useState, createContext, useContext } from 'react';

const TabsContext = createContext(null);

export const Tabs = ({ children, defaultValue, onValueChange, ...props }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleValueChange = (value) => {
    setActiveTab(value);
    onValueChange?.(value);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 ${className}`}
    role="tablist"
    {...props}
  >
    {children}
  </div>
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef(({ children, value, className = '', ...props }, ref) => {
  const context = useContext(TabsContext);

  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        context?.activeTab === value
          ? 'bg-white text-slate-950 shadow-sm'
          : 'text-slate-600 hover:text-slate-950'
      } ${className}`}
      onClick={() => context?.setActiveTab(value)}
      role="tab"
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef(({ children, value, className = '', ...props }, ref) => {
  const context = useContext(TabsContext);

  if (context?.activeTab !== value) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${className}`}
      role="tabpanel"
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = 'TabsContent';
