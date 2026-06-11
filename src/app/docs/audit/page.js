import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

export const metadata = { title: 'Audit Log — Consty Docs' };

const sampleEvents = [
  { action: 'prospect.created', user: 'alice@co.com', resource: 'Prospect #14', time: '2 min ago' },
  { action: 'deal.updated', user: 'alice@co.com', resource: 'Deal #7 — stage', time: '15 min ago' },
  { action: 'payment.recorded', user: 'bob@co.com', resource: 'Deal #3 — $5,000', time: '1 hr ago' },
  { action: 'user.role_changed', user: 'admin@co.com', resource: 'bob@co.com → manager', time: '3 hr ago' },
  { action: 'invoice.created', user: 'alice@co.com', resource: 'Invoice #INV-042', time: '1 day ago' },
];

export default function AuditPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Audit Log</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Audit Log</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          An immutable, chronological record of every action performed in Consty.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">What Gets Logged</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Every create, update, and delete operation across all modules is logged automatically. You cannot disable audit logging.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
            {['User sign-in/out', 'Prospect created/updated', 'Deal stage changes', 'Payment recorded', 'Invoice changes', 'Expense added', 'User role changed', 'Account transfers', 'Budget changes'].map((e) => (
              <div key={e} className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/40 rounded-md">
                <span className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
                {e}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Sample Log Entries</h2>
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/50 grid grid-cols-3 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Event</span>
              <span>User</span>
              <span className="flex items-center gap-1"><Clock size={10} /> Time</span>
            </div>
            {sampleEvents.map((ev) => (
              <div key={ev.action + ev.time} className="grid grid-cols-3 px-4 py-2.5 border-t border-border text-xs">
                <span className="font-mono text-foreground">{ev.action}</span>
                <span className="text-muted-foreground">{ev.user}</span>
                <span className="text-muted-foreground">{ev.time}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Immutability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Audit entries are <strong className="text-foreground">append-only</strong>. Once written, they cannot be edited or deleted — even by superadmins. This guarantees an honest record for compliance and dispute resolution.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Access</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The full audit log is accessible at <code className="bg-muted px-1 rounded font-mono text-xs">/app/audit</code>. Access requires the <span className="font-mono text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded dark:bg-orange-900/30 dark:text-orange-300">admin</span> or <span className="font-mono text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded dark:bg-red-900/30 dark:text-red-300">superadmin</span> role. Members and viewers cannot access audit logs.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/security" className="flex items-center gap-1 text-sm text-primary hover:underline">← Security</Link>
        <Link href="/docs/workflow" className="flex items-center gap-1 text-sm text-primary hover:underline">Business Workflow <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
