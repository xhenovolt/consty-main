import Link from 'next/link';
import { Target, DollarSign, FileText, BarChart3, Shield, Users, Clock, Package, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Module Overview — Consty Docs' };

const modules = [
  {
    icon: Target,
    name: 'Prospecting',
    path: '/app/prospecting',
    href: '/docs/prospecting',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    summary: 'Track leads from first contact to conversion.',
    features: ['Create and categorize prospects', 'Set follow-up dates with reminders', 'Add interaction notes', 'Convert to deal with one click'],
  },
  {
    icon: DollarSign,
    name: 'Deals',
    path: '/app/deals',
    href: '/docs/deals',
    color: 'text-green-600',
    bg: 'bg-green-50',
    summary: 'Pipeline management from negotiation to closed-won.',
    features: ['Deal stages (Lead → Negotiation → Won/Lost)', 'Revenue forecasting', 'Payment recording', 'Link to prospects and invoices'],
  },
  {
    icon: DollarSign,
    name: 'Finance',
    path: '/app/finance',
    href: '/docs/finance',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    summary: 'Double-entry bookkeeping, accounts, and budgets.',
    features: ['Chart of accounts', 'General ledger', 'Expense tracking', 'Budget management', 'Account transfers'],
  },
  {
    icon: FileText,
    name: 'Invoicing',
    path: '/app/invoices',
    href: '/docs/invoicing',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    summary: 'Create, send, and track professional invoices.',
    features: ['PDF invoice generation', 'Item line management', 'Due date tracking', 'Status: Draft → Sent → Paid'],
  },
  {
    icon: BarChart3,
    name: 'Reports',
    path: '/app/reports',
    href: '/docs/reports',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    summary: 'Analytics across pipeline, revenue, and expenses.',
    features: ['Revenue trends', 'Pipeline conversion rates', 'Expense breakdowns', 'Custom date ranges'],
  },
  {
    icon: Package,
    name: 'Assets',
    path: '/app/assets',
    href: '/docs/modules',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    summary: 'Track company assets and their depreciation.',
    features: ['Asset register', 'Purchase date and value', 'Depreciation schedules', 'Category management'],
  },
  {
    icon: Users,
    name: 'User Management',
    path: '/app/users',
    href: '/docs/users',
    color: 'text-red-600',
    bg: 'bg-red-50',
    summary: 'Team roles, permissions, and presence tracking.',
    features: ['Create and manage users', 'Assign roles (viewer → superadmin)', 'Real-time online presence', 'Password management'],
  },
  {
    icon: Clock,
    name: 'Audit Log',
    path: '/app/audit',
    href: '/docs/audit',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    summary: 'Immutable record of every action in the system.',
    features: ['All create/update/delete events', 'User and timestamp', 'Resource type and ID', 'Admin-only access'],
  },
];

export default function ModulesPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Module Overview</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Module Overview</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Consty has 8 core modules. Each covers a specific domain of running a business. They integrate seamlessly — data flows automatically between them.
        </p>
      </div>

      <div className="grid gap-6">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div key={mod.name} className="border border-border rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 ${mod.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${mod.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-semibold text-foreground">{mod.name}</h2>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{mod.path}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{mod.summary}</p>
                  <ul className="grid sm:grid-cols-2 gap-1">
                    {mod.features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={mod.href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3">
                    Read full guide <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
