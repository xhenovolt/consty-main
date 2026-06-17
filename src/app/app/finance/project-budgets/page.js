'use client';

/**
 * Finance → Project Budgets (read-only rollup).
 * Bridges the project domain (`project_budgets`) into Finance — distinct from
 * company/overhead budgets. Edit happens in each project's Budget tab.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, ArrowRight } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { PageTransition } from '@/components/ui/PageTransition';

const STATUS_STYLE = {
  surplus: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  balanced: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  tight: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  deficit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  frozen: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  overrun: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const num = (v) => Number(v || 0).toLocaleString();

export default function ProjectBudgetsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('/api/finance/project-budgets')
      .then(r => r.json()).then(j => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading project budgets…</div>;
  const rows = data?.rows || [];
  const t = data?.totals || {};

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet className="w-6 h-6 text-primary" /> Project Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">Portfolio rollup across all project budgets. Edit in each project&apos;s Budget tab. Separate from company/overhead budgets.</p>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-5">
          {[['Allocated', t.allocated], ['Actual', t.actual], ['Committed', t.committed], ['Forecast', t.forecast], ['Variance', t.variance]].map(([label, val]) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className={`text-xl font-bold ${label === 'Variance' && Number(val) < 0 ? 'text-red-600' : 'text-foreground'}`}>{num(val)}</div>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <Wallet className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-foreground font-medium">No project budgets yet</p>
            <p className="text-sm text-muted-foreground mt-1">Set a budget inside a project&apos;s Budget tab to see it here.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 px-3 font-medium">Project</th>
                  <th className="py-2 px-3 font-medium text-right">Allocated</th>
                  <th className="py-2 px-3 font-medium text-right">Actual</th>
                  <th className="py-2 px-3 font-medium text-right">Committed</th>
                  <th className="py-2 px-3 font-medium text-right">Forecast</th>
                  <th className="py-2 px-3 font-medium text-right">Remaining</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 px-3">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{r.code} · {r.project_status?.replace('_', ' ')}</div>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-foreground">{num(r.allocated_amount)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{num(r.actual_amount)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{num(r.committed_amount)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{num(r.forecast_amount)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums ${Number(r.remaining) < 0 ? 'text-red-600' : 'text-foreground'}`}>{num(r.remaining)}</td>
                    <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.budget_status] || 'bg-muted'}`}>{r.budget_status}</span></td>
                    <td className="py-2 px-3 text-right"><Link href={`/app/projects/${r.id}`} className="inline-flex items-center gap-1 text-xs text-primary">Open <ArrowRight size={12} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
