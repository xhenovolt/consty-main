'use client';

import Link from 'next/link';
import { ArrowLeft, Box, Users, DollarSign, FileText, BarChart3, Lightbulb, Receipt, Shield, Briefcase, UserCheck, Target } from 'lucide-react';
import { useState } from 'react';

const modules = [
  {
    id: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard',
    description: 'Central hub providing real-time business overview with key metrics and quick access to critical functions.',
    routes: ['/app/dashboard'],
    tables: ['deals', 'prospects', 'payments', 'contracts'],
    color: 'blue',
  },
  {
    id: 'prospects',
    icon: Users,
    title: 'Prospects',
    description: 'Manage leads from initial contact through conversion to client.',
    routes: ['/app/prospecting', '/app/prospecting/new', '/app/prospecting/followups', '/app/prospecting/conversions'],
    tables: ['prospects', 'prospect_activities', 'prospect_stages', 'prospect_sources'],
    workflow: 'Add Prospect → Log Activity → Advance Stage → Convert to Client',
    color: 'green',
  },
  {
    id: 'deals',
    icon: Target,
    title: 'Deals',
    description: 'Manage sales opportunities from initial pitch through closing.',
    routes: ['/app/deals', '/app/deals/create', '/app/pipeline'],
    tables: ['deals', 'clients', 'prospects', 'intellectual_property', 'contracts'],
    workflow: 'Create Deal → Progress Stages → Win Deal → Auto-create Contract',
    rules: ['Deal MUST have system_id', 'Deal MUST have client_id OR prospect_id', 'Winning deal auto-creates contract'],
    color: 'purple',
  },
  {
    id: 'clients',
    icon: UserCheck,
    title: 'Clients',
    description: 'Manage converted prospects who have become paying clients.',
    routes: ['/app/clients'],
    tables: ['clients', 'prospects', 'contracts', 'payments'],
    workflow: 'Convert Prospect → View Clients → Review History',
    color: 'indigo',
  },
  {
    id: 'contracts',
    icon: FileText,
    title: 'Contracts',
    description: 'Formalize agreements with clients for systems/products sold.',
    routes: ['/app/contracts'],
    tables: ['contracts', 'clients', 'intellectual_property', 'deals', 'payments'],
    workflow: 'Auto-Created on Win or Manual Creation → Record Payment',
    rules: ['Contract MUST have client_id', 'Contract MUST have system_id'],
    color: 'orange',
  },
  {
    id: 'payments',
    icon: DollarSign,
    title: 'Payments',
    description: 'Track money received from clients and manage allocation.',
    routes: ['/app/payments'],
    tables: ['payments', 'contracts', 'allocations'],
    workflow: 'Record Payment → Allocate Funds → View Status',
    rules: ['Payment MUST have contract_id', 'Amount must be > 0', 'Allocation status auto-updates via trigger'],
    color: 'green',
  },
  {
    id: 'allocations',
    icon: Briefcase,
    title: 'Allocations',
    description: 'Distribute received payments to different financial categories.',
    routes: [],
    tables: ['allocations', 'payments', 'expense_categories'],
    workflow: 'Create Allocation → Select Type (vault/operating/expense/investment) → Enter Amount',
    rules: ['Total allocations cannot exceed payment amount', 'Database trigger validates and updates payment status'],
    color: 'teal',
  },
  {
    id: 'finance',
    icon: BarChart3,
    title: 'Finance Dashboard',
    description: 'Real-time financial overview showing revenue, expenses, profit, and cash position.',
    routes: ['/app/finance'],
    tables: ['payments', 'expenses', 'allocations', 'vault_balances', 'contracts'],
    views: ['v_financial_summary', 'v_revenue_by_system'],
    workflow: 'View Dashboard → Review Metrics → Check Cash Position → Analyze Performance',
    color: 'blue',
  },
  {
    id: 'ip',
    icon: Lightbulb,
    title: 'Intellectual Property (Systems)',
    description: 'Manage the portfolio of products/systems being sold.',
    routes: ['/app/intellectual-property'],
    tables: ['intellectual_property', 'deals', 'contracts'],
    workflow: 'Add System → Link to Deals → Track Revenue',
    rules: ['Every deal must reference a system', 'Every contract must reference a system'],
    color: 'yellow',
  },
  {
    id: 'invoices',
    icon: Receipt,
    title: 'Invoices',
    description: 'Generate and manage invoices for clients.',
    routes: ['/app/invoices', '/app/invoices/[id]/view', '/app/invoices/[id]/edit', '/app/invoices/[id]/print'],
    tables: ['invoices', 'invoice_items'],
    workflow: 'Create Invoice → Add Items → Send → Record Payment → Print/Export',
    color: 'pink',
  },
  {
    id: 'admin',
    icon: Shield,
    title: 'Admin',
    description: 'System administration, user management, and security.',
    routes: ['/app/admin/users', '/app/admin/activity', '/app/admin/audit-logs', '/app/admin/roles'],
    tables: ['users', 'roles', 'permissions', 'role_permissions', 'audit_logs', 'sessions'],
    workflow: 'Create User → Assign Role → Monitor Activity → Review Audit',
    access: 'Admin only - Requires admin or superadmin role',
    color: 'red',
  },
];

const colorStyles = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: 'text-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: 'text-green-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', icon: 'text-purple-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', icon: 'text-indigo-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: 'text-orange-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', icon: 'text-teal-600' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', icon: 'text-yellow-600' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', icon: 'text-pink-600' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: 'text-red-600' },
};

function ModuleCard({ module }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = module.icon;
  const styles = colorStyles[module.color] || colorStyles.blue;

  return (
    <div className={`bg-card rounded-lg shadow-sm border ${styles.border} overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between p-6 hover:bg-muted transition text-left"
      >
        <div className="flex items-start gap-4 flex-1">
          <div className={`w-12 h-12 ${styles.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${styles.icon}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground mb-2">{module.title}</h3>
            <p className="text-sm text-muted-foreground">{module.description}</p>
            {module.routes && module.routes.length > 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {module.routes.slice(0, 2).map((route, i) => (
                  route.includes('[') ? (
                    <span
                      key={i}
                      className={`text-xs px-2 py-1 ${styles.bg} ${styles.text} rounded font-mono cursor-default`}
                    >
                      {route}
                    </span>
                  ) : (
                  <Link
                    key={i}
                    href={route}
                    className={`text-xs px-2 py-1 ${styles.bg} ${styles.text} rounded font-medium hover:opacity-80`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {route}
                  </Link>
                  )
                ))}
                {module.routes.length > 2 && (
                  <span className="text-xs text-muted-foreground">+{module.routes.length - 2} more</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={`text-sm font-medium ${styles.text} cursor-pointer`}>
          {isExpanded ? '▲ Less' : '▼ More'}
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-border">
          {module.workflow && (
            <div>
              <h4 className="font-semibold text-foreground mb-2 text-sm">Typical Workflow</h4>
              <div className="text-sm text-foreground bg-muted p-3 rounded">
                {module.workflow}
              </div>
            </div>
          )}

          {module.tables && (
            <div>
              <h4 className="font-semibold text-foreground mb-2 text-sm">Database Tables</h4>
              <div className="flex flex-wrap gap-1">
                {module.tables.map((table, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-gray-200 text-foreground rounded font-mono">
                    {table}
                  </span>
                ))}
              </div>
            </div>
          )}

          {module.views && (
            <div>
              <h4 className="font-semibold text-foreground mb-2 text-sm">Database Views</h4>
              <div className="flex flex-wrap gap-1">
                {module.views.map((view, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono dark:bg-blue-900/30 dark:text-blue-300">
                    {view}
                  </span>
                ))}
              </div>
            </div>
          )}

          {module.rules && (
            <div>
              <h4 className="font-semibold text-foreground mb-2 text-sm flex items-center gap-2">
                <span className="text-green-600">✓</span> Business Rules
              </h4>
              <ul className="space-y-1">
                {module.rules.map((rule, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-green-600 font-bold flex-shrink-0">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {module.access && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <h4 className="font-semibold text-red-900 mb-1 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Access Control
              </h4>
              <p className="text-sm text-red-800">{module.access}</p>
            </div>
          )}

          {module.routes && module.routes.length > 0 && (
            <div>
              <h4 className="font-semibold text-foreground mb-2 text-sm">All Routes</h4>
              <div className="flex flex-wrap gap-2">
                {module.routes.map((route, i) => (
                  <Link
                    key={i}
                    href={route}
                    className={`text-xs px-3 py-1.5 ${styles.bg} ${styles.text} rounded hover:opacity-80 font-medium transition`}
                  >
                    {route} →
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModulesPage() {
  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/app/docs"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documentation
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-xl p-8 shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-4">Module Documentation</h1>
          <p className="text-xl text-purple-50">
            Complete reference for each system module. Click any module to expand details.
          </p>
        </div>

        {/* Dependency Map */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Module Dependency Map</h2>
          <div className="bg-muted p-6 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-foreground">
{`Authentication
    ↓
Dashboard ← (reads from all modules)
    ↓
Prospects → Clients
    ↓           ↓
    → Deals → Contracts → Payments → Allocations → Finance Dashboard
           ↓       ↓           ↓
           ↓       ↓           → Expenses
           ↓       ↓
    Systems (IP) ←┘`}
            </pre>
          </div>
        </div>

        {/* Quick Reference Table */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8 overflow-x-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">Quick Reference</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-3 font-semibold">Module</th>
                <th className="text-left p-3 font-semibold">Primary Route</th>
                <th className="text-left p-3 font-semibold">Create Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                { module: 'Prospects', route: '/app/prospecting', action: 'New Prospect' },
                { module: 'Deals', route: '/app/deals', action: 'Create Deal' },
                { module: 'Clients', route: '/app/clients', action: 'Convert Prospect' },
                { module: 'Contracts', route: '/app/contracts', action: 'Win Deal (auto)' },
                { module: 'Payments', route: '/app/payments', action: 'New Payment' },
                { module: 'Finance', route: '/app/finance', action: 'N/A' },
                { module: 'Systems', route: '/app/intellectual-property', action: 'New System' },
                { module: 'Invoices', route: '/app/invoices', action: 'New Invoice' },
                { module: 'Admin', route: '/app/admin/users', action: 'New User' },
              ].map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="p-3 font-semibold text-foreground">{row.module}</td>
                  <td className="p-3">
                    <Link href={row.route} className="text-blue-600 hover:underline">{row.route}</Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modules */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground mb-4">All Modules</h2>
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>

        {/* Footer Note */}
        <div className="bg-muted rounded-lg p-6 mt-8">
          <p className="text-sm text-muted-foreground text-center">
            <strong>Document Version:</strong> 1.0 | <strong>Last Updated:</strong> January 2026 | For detailed API documentation, see <Link href="/app/docs/developer" className="text-blue-600 hover:underline">Developer Docs</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
