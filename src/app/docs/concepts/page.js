import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata = { title: 'Core Concepts — Consty Docs' };

function ConceptCard({ title, children }) {
  return (
    <div className="border border-border rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default function ConceptsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Core Concepts</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Core Concepts</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Understand the mental models that make Consty work.
        </p>
      </div>

      <ConceptCard title="The Core Workflow">
        <p className="text-sm text-muted-foreground mb-4">
          Consty is built around a single, end-to-end workflow that every founder goes through:
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {['Prospect', 'Follow-up', 'Convert', 'Deal', 'Invoice', 'Payment', 'Ledger Entry', 'Report'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-primary/10 text-primary font-medium rounded-md">{step}</span>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Each step feeds the next. A prospect becomes a deal, a deal generates an invoice, an invoice becomes a payment, and a payment creates a double-entry ledger record. No manual data entry between systems.
        </p>
      </ConceptCard>

      <ConceptCard title="Modules">
        <p className="text-sm text-muted-foreground mb-3">
          Consty is organized into <strong className="text-foreground">8 modules</strong>, each responsible for a part of the business:
        </p>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {[
            { name: 'Prospecting', desc: 'Lead capture and follow-up tracking' },
            { name: 'Deals', desc: 'Pipeline management and deal lifecycle' },
            { name: 'Finance', desc: 'Chart of accounts, ledger, budgets' },
            { name: 'Invoicing', desc: 'Invoice creation, sending, and tracking' },
            { name: 'Reports', desc: 'Revenue, pipeline, and expense analytics' },
            { name: 'Assets', desc: 'Asset inventory and depreciation' },
            { name: 'Users', desc: 'Team management with role-based access' },
            { name: 'Audit', desc: 'Full activity log for compliance' },
          ].map(({ name, desc }) => (
            <div key={name} className="flex gap-2 p-2 bg-muted/40 rounded-md">
              <span className="font-medium text-foreground min-w-24">{name}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </ConceptCard>

      <ConceptCard title="Role-Based Access Control (RBAC)">
        <p className="text-sm text-muted-foreground mb-4">
          Every user has a <strong className="text-foreground">role</strong> that determines what they can see and do.
        </p>
        <div className="space-y-2 text-sm">
          {[
            { role: 'viewer', color: 'bg-gray-100 text-gray-700', desc: 'Read-only access to dashboard and reports' },
            { role: 'member', color: 'bg-blue-100 text-blue-700', desc: 'Can create prospects, deals, and record payments' },
            { role: 'manager', color: 'bg-green-100 text-green-700', desc: 'Full access to all modules + user management' },
            { role: 'admin', color: 'bg-orange-100 text-orange-700', desc: 'System configuration, audit logs, all permissions' },
            { role: 'superadmin', color: 'bg-red-100 text-red-700', desc: 'Complete system access including architecture and schemas' },
          ].map(({ role, color, desc }) => (
            <div key={role} className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${color}`}>{role}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </ConceptCard>

      <ConceptCard title="Double-Entry Finance">
        <p className="text-sm text-muted-foreground mb-3">
          Every financial transaction in Consty uses <strong className="text-foreground">double-entry bookkeeping</strong>. When you record a payment:
        </p>
        <div className="font-mono text-sm bg-muted border border-border rounded-lg p-4 space-y-1">
          <div className="flex gap-4"><span className="text-green-600 w-24">DEBIT</span><span className="text-foreground">Bank Account +$5,000</span></div>
          <div className="flex gap-4"><span className="text-red-600 w-24">CREDIT</span><span className="text-foreground">Revenue Account -$5,000</span></div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Debits always equal credits, ensuring your books are always balanced. See the <Link href="/docs/finance" className="text-primary hover:underline">Finance guide</Link> for details.
        </p>
      </ConceptCard>

      <ConceptCard title="Presence & Collaboration">
        <p className="text-sm text-muted-foreground">
          Consty tracks online presence using a <strong className="text-foreground">heartbeat system</strong>. Your client pings the server every 30 seconds while the tab is visible. If no ping arrives within 60 seconds, you appear offline. This powers the real-time presence indicators in the user management module.
        </p>
      </ConceptCard>

      <div className="mt-8 flex gap-4">
        <Link href="/docs/modules" className="flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowRight size={14} /> All Modules
        </Link>
        <Link href="/docs/getting-started" className="flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowRight size={14} /> Quick Start
        </Link>
      </div>
    </div>
  );
}
