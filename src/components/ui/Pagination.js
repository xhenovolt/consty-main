'use client';

/**
 * Pagination component for Consty.
 * Provides page controls, record count, and per-page selector.
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export function Pagination({ page, totalPages, totalCount, onPageChange, pageSize, onPageSizeChange }) {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {totalCount !== undefined && <span>{totalCount.toLocaleString()} records</span>}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="ml-2 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-xs"
          >
            {[25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPageChange(1)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {start > 1 && <span className="px-1 text-muted-foreground text-xs">…</span>}
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition ${p === page ? 'bg-blue-600 text-white' : 'border border-border hover:bg-muted text-foreground'}`}>
            {p}
          </button>
        ))}
        {end < totalPages && <span className="px-1 text-muted-foreground text-xs">…</span>}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
