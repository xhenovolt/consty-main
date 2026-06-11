import Link from 'next/link';
import { Shield, Lock } from 'lucide-react';
import { getCurrentUser } from '@/lib/current-user';

export const metadata = { title: 'Architecture — Consty Docs' };

export default async function ArchitecturePage() {
  const user = await getCurrentUser();
  const isSuperadmin = user?.isSuperadmin === true;

  if (!isSuperadmin) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link href="/docs" className="hover:text-foreground">Documentation</Link>
            <span>/</span>
            <span>Architecture</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">System Architecture</h1>
        </div>

        <div className="border border-amber-200 bg-amber-50 rounded-xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-amber-900 mb-2">Superadmin Access Required</h2>
          <p className="text-amber-800 text-sm mb-6 max-w-sm mx-auto">
            This page contains internal architecture documentation, schema details, and system internals.
            Access is restricted to superadmins.
          </p>
          <div className="flex gap-3 justify-center">
            {user ? (
              <div className="text-sm text-amber-700">
                Signed in as <strong>{user.email}</strong> — role does not have superadmin access.
              </div>
            ) : (
              <Link href="/auth/signin" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition">
                Sign In
              </Link>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm text-muted-foreground mb-4">You may find these public docs helpful:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Core Concepts', href: '/docs/concepts' },
              { label: 'Security & RBAC', href: '/docs/security' },
              { label: 'Business Workflow', href: '/docs/workflow' },
              { label: 'API Reference', href: '/docs/api' },
            ].map(({ label, href }) => (
              <Link key={href} href={href} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:border-primary/40 transition-colors text-foreground">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Superadmin content
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Architecture</span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-3xl font-bold text-foreground">System Architecture</h1>
          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium dark:bg-red-900/30 dark:text-red-300">
            <Shield size={11} /> Superadmin Only
          </span>
        </div>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Internal architecture, database schema, service topology, and system design decisions.
        </p>
      </div>

      <div className="space-y-8">
        <section className="border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Tech Stack</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              ['Framework', 'Next.js 16.1.1 (App Router, webpack)'],
              ['Database', 'Neon PostgreSQL (serverless)'],
              ['Auth', 'Session-based (HTTP-only cookie)'],
              ['CSS', 'Tailwind CSS v4'],
              ['Deployment', 'Vercel / Node.js server'],
              ['ORM', 'Raw SQL via pg (no ORM)'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="text-muted-foreground min-w-24">{k}</span>
                <span className="font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Database Schema Overview</h2>
          <div className="space-y-3">
            {[
              { table: 'users', desc: 'id (UUID PK), email, password_hash, name, role, is_superadmin, status, created_at' },
              { table: 'sessions', desc: 'id (UUID PK), user_id (FK), created_at, expires_at, data (JSONB)' },
              { table: 'prospects', desc: 'id, user_id (FK), name, email, company, status, follow_up_date, notes, created_at' },
              { table: 'deals', desc: 'id, prospect_id (FK), user_id, name, value, stage, expected_close_date, created_at' },
              { table: 'payments', desc: 'id, deal_id (FK), amount, date, method, created_at' },
              { table: 'invoices', desc: 'id, deal_id (FK), client_id, status, total, due_date, issued_date, created_at' },
              { table: 'accounts', desc: 'id, name, type (asset/liability/equity/revenue/expense), balance, created_at' },
              { table: 'ledger_entries', desc: 'id, debit_account_id (FK), credit_account_id (FK), amount, description, created_at' },
              { table: 'expenses', desc: 'id, account_id (FK), category, amount, date, notes, created_at' },
              { table: 'user_presence', desc: 'user_id (UUID PK FK→users.id), last_ping (TIMESTAMPTZ), last_seen, status' },
              { table: 'audit_log', desc: 'id, user_id (FK), action, resource_type, resource_id, metadata (JSONB), created_at' },
            ].map(({ table, desc }) => (
              <div key={table} className="border border-border rounded-lg p-3">
                <code className="text-sm font-mono font-bold text-primary">{table}</code>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Request Lifecycle</h2>
          <div className="font-mono text-xs bg-muted border border-border rounded-lg p-4 space-y-1">
            <p className="text-muted-foreground">// Every authenticated request</p>
            <p>Browser → middleware.ts (cookie check)</p>
            <p>  → App Router (Server Component or API route)</p>
            <p>  → getCurrentUser() (session → user lookup)</p>
            <p>  → RBAC check (role/is_superadmin)</p>
            <p>  → DB query via pg Pool</p>
            <p>  → Response</p>
          </div>
        </section>

        <section className="border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Key Directories</h2>
          <div className="font-mono text-xs bg-muted border border-border rounded-lg p-4 space-y-1 text-muted-foreground">
            <p><span className="text-foreground">src/app/</span>            — All pages (App Router)</p>
            <p><span className="text-foreground">src/app/api/</span>         — REST API endpoints</p>
            <p><span className="text-foreground">src/app/app/</span>         — Authenticated app pages</p>
            <p><span className="text-foreground">src/app/docs/</span>        — Public documentation</p>
            <p><span className="text-foreground">src/components/</span>      — Shared UI components</p>
            <p><span className="text-foreground">src/lib/</span>             — Server utilities (auth, db, etc.)</p>
            <p><span className="text-foreground">migrations/</span>          — SQL migration files</p>
            <p><span className="text-foreground">middleware.ts</span>        — Route protection</p>
          </div>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <Link href="/docs" className="text-sm text-primary hover:underline">← Back to Docs</Link>
      </div>
    </div>
  );
}
