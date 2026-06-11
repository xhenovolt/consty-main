import React from 'react';

export const Table = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={`w-full caption-bottom text-sm ${className}`} {...props}>
      {children}
    </table>
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <thead ref={ref} className={`[&_tr]:border-b ${className}`} {...props}>
    {children}
  </thead>
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <tbody ref={ref} className={`[&_tr:last-child]:border-0 ${className}`} {...props}>
    {children}
  </tbody>
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <tfoot ref={ref} className={`border-t bg-slate-100/50 font-medium dark:bg-slate-800/50 ${className}`} {...props}>
    {children}
  </tfoot>
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <tr
    ref={ref}
    className={`border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100 dark:hover:bg-slate-800/50 dark:data-[state=selected]:bg-slate-800 ${className}`}
    {...props}
  >
    {children}
  </tr>
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <th
    ref={ref}
    className={`h-12 px-4 text-left align-middle font-medium text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  >
    {children}
  </th>
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <td
    ref={ref}
    className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  >
    {children}
  </td>
));
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <caption ref={ref} className={`mt-4 text-sm text-slate-500 dark:text-slate-400 ${className}`} {...props}>
    {children}
  </caption>
));
TableCaption.displayName = 'TableCaption';
