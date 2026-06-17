'use client';

/**
 * Project Activity — a unified feed of recent project-domain events
 * (projects, work items, procurement, goods receipts, expenses, blockers,
 * change orders), scoped to the projects the user can see. Backed by
 * /api/activity/feed. No legacy CRM activity.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity, Briefcase, ListTree, ShoppingCart, PackageCheck, Wallet, AlertTriangle, Gavel,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { PageTransition } from '@/components/ui/PageTransition';

const ICON = {
  project: Briefcase, work_item: ListTree, procurement: ShoppingCart, goods_receipt: PackageCheck,
  expense: Wallet, blocker: AlertTriangle, change_order: Gavel,
};
const TONE = {
  blocker: 'text-orange-500', goods_receipt: 'text-emerald-500', procurement: 'text-blue-500',
  expense: 'text-purple-500', change_order: 'text-indigo-500',
};

function when(ts) {
  if (!ts) return '';
  const d = new Date(ts), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function ActivityPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('/api/activity/feed')
      .then(r => r.json()).then(j => { if (j.success) setRows(j.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-1"><Activity className="w-6 h-6 text-primary" /> Project Activity</h1>
        <p className="text-sm text-muted-foreground mb-5">Recent events across your projects.</p>

        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-foreground font-medium">No activity yet</p>
            <p className="text-sm text-muted-foreground mt-1">Project events will appear here as work happens.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {rows.map((r, i) => {
              const Icon = ICON[r.entity_type] || Activity;
              return (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Icon size={18} className={`mt-0.5 shrink-0 ${TONE[r.entity_type] || 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground">{r.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.project_name && <Link href={`/app/projects/${r.project_id}`} className="hover:text-foreground">{r.project_name}</Link>}
                      {r.project_name && r.actor_name ? ' · ' : ''}
                      {r.actor_name}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{when(r.ts)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
