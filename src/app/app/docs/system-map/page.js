'use client';

import Link from 'next/link';
import { ArrowLeft, Globe, Server, Database, Map } from 'lucide-react';

const uiRoutes = [
  { category: 'Core', routes: ['/app/dashboard'] },
  {
    category: 'Growth (Prospects)',
    routes: [
      '/app/prospecting',
      '/app/prospecting/new',
      '/app/prospecting/[id]',
      '/app/prospecting/followups',
      '/app/prospecting/conversions',
      '/app/prospecting/dashboard',
    ],
  },
  {
    category: 'Investments (Deals & Payments)',
    routes: [
      '/app/deals',
      '/app/deals/create',
      '/app/deals/edit/[id]',
      '/app/pipeline',
      '/app/clients',
      '/app/contracts',
      '/app/payments',
    ],
  },
  {
    category: 'Finance',
    routes: [
      '/app/finance',
      '/app/expenses',
    ],
  },
  {
    category: 'Systems',
    routes: [
      '/app/intellectual-property',
    ],
  },
  {
    category: 'Invoicing',
    routes: [
      '/app/invoices',
      '/app/invoices/[id]/view',
      '/app/invoices/[id]/edit',
      '/app/invoices/[id]/print',
    ],
  },
  {
    category: 'Admin',
    routes: [
      '/app/admin/users',
      '/app/admin/users/[userId]',
      '/app/admin/activity',
      '/app/admin/activity-analytics',
      '/app/admin/audit-logs',
      '/app/admin/roles',
    ],
  },
  {
    category: 'Documentation',
    routes: [
      '/app/docs',
      '/app/docs/getting-started',
      '/app/docs/founder',
      '/app/docs/guides',
      '/app/docs/modules',
      '/app/docs/workflow',
      '/app/docs/system-map',
      '/app/docs/developer',
    ],
  },
];

const apiEndpoints = [
  { category: 'Prospects', count: 10, examples: ['GET /api/prospects', 'POST /api/prospects', 'POST /api/prospects/[id]/convert-to-client'] },
  { category: 'Deals', count: 7, examples: ['GET /api/deals', 'POST /api/deals', 'POST /api/deals/[id]/win'] },
  { category: 'Clients', count: 5, examples: ['GET /api/clients', 'POST /api/clients'] },
  { category: 'Contracts', count: 5, examples: ['GET /api/contracts', 'POST /api/contracts'] },
  { category: 'Payments', count: 5, examples: ['GET /api/payments', 'POST /api/payments'] },
  { category: 'Allocations', count: 5, examples: ['GET /api/allocations', 'POST /api/allocations'] },
  { category: 'Finance', count: 3, examples: ['GET /api/financial-dashboard', 'GET /api/expenses'] },
  { category: 'IP / Systems', count: 5, examples: ['GET /api/intellectual-property', 'POST /api/intellectual-property'] },
  { category: 'Invoices', count: 10, examples: ['GET /api/invoices', 'POST /api/invoices', 'GET /api/invoices/[id]/pdf'] },
  { category: 'Admin', count: 8, examples: ['GET /api/admin/users', 'GET /api/admin/audit-logs', 'POST /api/admin/users'] },
  { category: 'Auth', count: 5, examples: ['POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/session'] },
];

const database = {
  tables: [
    { name: 'prospects', purpose: 'Lead tracking' },
    { name: 'prospect_activities', purpose: 'Follow-up log' },
    { name: 'clients', purpose: 'Converted prospects' },
    { name: 'deals', purpose: 'Sales opportunities' },
    { name: 'contracts', purpose: 'Formal agreements' },
    { name: 'payments', purpose: 'Money received' },
    { name: 'allocations', purpose: 'Fund distribution' },
    { name: 'intellectual_property', purpose: 'Systems/products' },
    { name: 'invoices', purpose: 'Invoice records' },
    { name: 'invoice_items', purpose: 'Invoice line items' },
    { name: 'expenses', purpose: 'Business expenses' },
    { name: 'vault_balances', purpose: 'Financial reserves' },
    { name: 'users', purpose: 'User accounts' },
    { name: 'roles', purpose: 'Access control' },
    { name: 'audit_logs', purpose: 'Activity tracking' },
  ],
  views: [
    { name: 'v_financial_summary', purpose: 'KPIs aggregation' },
    { name: 'v_revenue_by_system', purpose: 'Revenue per product' },
  ],
};

export default function SystemMapPage() {
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
        <div className="bg-gradient-to-br from-teal-500 to-teal-700 text-white rounded-xl p-8 shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-4">System Route Map</h1>
          <p className="text-xl text-teal-50">
            Complete inventory of all UI routes, API endpoints, and database architecture.
          </p>
        </div>

        {/* System Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-xl p-6 shadow-sm text-center">
            <Globe className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-foreground mb-1">42</div>
            <div className="text-muted-foreground">UI Page Routes</div>
          </div>
          <div className="bg-card rounded-xl p-6 shadow-sm text-center">
            <Server className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-foreground mb-1">85</div>
            <div className="text-muted-foreground">API Endpoints</div>
          </div>
          <div className="bg-card rounded-xl p-6 shadow-sm text-center">
            <Database className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-foreground mb-1">30+</div>
            <div className="text-muted-foreground">Database Tables</div>
          </div>
        </div>

        {/* UI Routes */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-foreground">UI Page Routes</h2>
          </div>
          <div className="space-y-6">
            {uiRoutes.map((group, i) => (
              <div key={i}>
                <h3 className="font-semibold text-foreground mb-3 text-lg">{group.category}</h3>
                <div className="grid md:grid-cols-2 gap-2">
                  {group.routes.map((route, j) => {
                    const isDynamic = route.includes('[');
                    return isDynamic ? (
                      <span
                        key={j}
                        className="p-3 bg-muted border border-border rounded-lg font-mono text-sm text-muted-foreground cursor-default"
                      >
                        {route}
                      </span>
                    ) : (
                      <Link
                        key={j}
                        href={route}
                        className="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition font-mono text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/20"
                      >
                        {route}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Endpoints */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-foreground">API Endpoints</h2>
          </div>
          <div className="space-y-4">
            {apiEndpoints.map((group, i) => (
              <div key={i} className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{group.category}</h3>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium dark:bg-green-900/30 dark:text-green-300">
                    {group.count} endpoints
                  </span>
                </div>
                <div className="space-y-1">
                  {group.examples.map((example, j) => (
                    <div key={j} className="text-sm font-mono text-muted-foreground">
                      {example}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Standard CRUD Pattern:</strong> All resources follow GET (list), POST (create), GET/:id (read), PUT/:id (update), DELETE/:id (delete) conventions.
            </p>
          </div>
        </div>

        {/* Database Architecture */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-foreground">Database Architecture</h2>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3 text-lg">Tables</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {database.tables.map((table, i) => (
                <div key={i} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="font-mono text-sm text-purple-900 font-semibold">{table.name}</div>
                  <div className="text-xs text-purple-700 mt-1">{table.purpose}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-3 text-lg">Views</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {database.views.map((view, i) => (
                <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="font-mono text-sm text-blue-900 font-semibold">{view.name}</div>
                  <div className="text-xs text-blue-700 mt-1">{view.purpose}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Flow */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Map className="w-6 h-6 text-orange-600" />
            <h2 className="text-2xl font-bold text-foreground">Data Flow</h2>
          </div>
          <div className="bg-muted p-6 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-foreground">
{`Prospect → (convert) → Client
    ↓                        ↓
    ↓                        ↓
    Deal ──────────────→ Contract ──────────→ Payment ──────────→ Allocation
    ↓                        ↓                     ↓                    ↓
    ↓                        ↓                     ↓                    ↓
System (IP) ←───────────────┘                     ↓                    ↓
                                                   ↓                    ↓
                                            Finance Dashboard ←────────┘`}
            </pre>
          </div>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">Key Constraints</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Prospects must be converted before creating contracts</li>
              <li>• Deals require system_id (what you're selling)</li>
              <li>• Contracts require client_id (not prospect_id)</li>
              <li>• Payments must link to contracts</li>
              <li>• Allocations validated by database triggers</li>
            </ul>
          </div>
        </div>

        {/* Technology Stack */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Technology Stack</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-green-400 mb-3">Frontend</h3>
              <ul className="space-y-2 text-gray-200 text-sm">
                <li>• Next.js 16.1.1 (App Router)</li>
                <li>• React 19.0.0</li>
                <li>• Tailwind CSS 4.0</li>
                <li>• Framer Motion (animations)</li>
                <li>• Lucide React (icons)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-blue-400 mb-3">Backend</h3>
              <ul className="space-y-2 text-gray-200 text-sm">
                <li>• PostgreSQL (Neon Cloud)</li>
                <li>• Node.js pg driver</li>
                <li>• Zod 4.2.1 (validation)</li>
                <li>• Next.js API Routes</li>
                <li>• Database triggers & views</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
