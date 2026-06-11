'use client';

import { motion } from 'framer-motion';

function Bone({ className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, delay }}
      className={`rounded-lg bg-muted ${className}`}
    />
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-muted/50 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Bone key={c} className={`h-4 flex-1 ${c === 0 ? 'max-w-[200px]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border rounded-xl p-5 space-y-3">
          <Bone className="h-5 w-3/4" />
          <Bone className="h-4 w-1/2" />
          <div className="flex gap-2 pt-2">
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-xl p-4 space-y-2">
            <Bone className="h-4 w-20" />
            <Bone className="h-8 w-24" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="border border-border rounded-xl p-6">
        <Bone className="h-5 w-40 mb-4" />
        <Bone className="h-48 w-full" />
      </div>
      {/* List */}
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}

export function SkeletonForm({ fields = 6 }) {
  return (
    <div className="space-y-4 p-6 border border-border rounded-xl">
      <Bone className="h-6 w-48 mb-2" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-4 w-24" />
            <Bone className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Bone className="h-10 w-32 mt-4" />
    </div>
  );
}

export function SkeletonLine({ className = '' }) {
  return <Bone className={`h-4 ${className}`} />;
}

export function SkeletonDeals({ count = 5 }) {
  return (
    <div className="bg-card rounded-xl border border-border divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4">
          <div className="space-y-2 flex-1">
            <Bone className="h-4 w-48" delay={i * 0.1} />
            <Bone className="h-3 w-32" delay={i * 0.1 + 0.05} />
          </div>
          <Bone className="h-6 w-20 rounded-full" delay={i * 0.1} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonInvoices({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Bone className="h-4 w-32" delay={i * 0.08} />
          <Bone className="h-4 flex-1" delay={i * 0.08 + 0.03} />
          <Bone className="h-4 w-24" delay={i * 0.08 + 0.06} />
          <Bone className="h-4 w-20" delay={i * 0.08 + 0.09} />
        </div>
      ))}
    </div>
  );
}
