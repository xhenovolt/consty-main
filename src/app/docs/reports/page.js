import Link from 'next/link';
import { ArrowRight, BarChart3, TrendingUp, DollarSign, Users } from 'lucide-react';

export const metadata = { title: 'Reports — Consty Docs' };

const reports = [
  { icon: TrendingUp, name: 'Revenue Trend', desc: 'Monthly revenue over time. Compare current vs previous periods.' },
  { icon: BarChart3, name: 'Pipeline Report', desc: 'Deal counts and values by stage. Highlights conversion rates.' },
  { icon: DollarSign, name: 'Expense Report', desc: 'Spending by category, account, or date range.' },
  { icon: Users, name: 'Client Report', desc: 'Revenue per client, deal count, and lifetime value.' },
];

export default function ReportsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Reports</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Reports & Analytics</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Understand your business performance with built-in reports across pipeline, revenue, and expenses.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Available Reports</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {reports.map(({ icon: Icon, name, desc }) => (
              <div key={name} className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <h3 className="font-medium text-foreground text-sm">{name}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Filtering & Date Ranges</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All reports support custom date range filters. Select <strong className="text-foreground">This Month</strong>, <strong className="text-foreground">Last Quarter</strong>, <strong className="text-foreground">Year to Date</strong>, or pick a custom start/end date. Reports update in real-time as filters change.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Exporting Data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Reports can be exported to <strong className="text-foreground">CSV</strong> for use in spreadsheets. Use the export button in the top-right of any report view. The CSV includes all rows in the current filter — not just the visible page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Dashboard Widgets</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The main dashboard auto-populates the most important metrics: total pipeline value, collected revenue this month, overdue invoices, and recent activity. These widgets pull from the same data as the full reports.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/invoicing" className="flex items-center gap-1 text-sm text-primary hover:underline">← Invoicing</Link>
        <Link href="/docs/users" className="flex items-center gap-1 text-sm text-primary hover:underline">User Management <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
