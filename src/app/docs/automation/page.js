import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';

export const metadata = { title: 'Automation — Consty Docs' };

export default function AutomationPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Automation</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Automation</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Automate repetitive tasks via webhooks, scheduled jobs, and the Consty API.
        </p>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-8 text-sm">
        <p className="font-medium text-amber-900 flex items-center gap-2"><Zap size={14} /> Coming Soon</p>
        <p className="text-amber-800 mt-1">Visual workflow automation (triggers + actions) is on the roadmap. Current automation is available via the REST API.</p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Built-in Automations</h2>
          <div className="space-y-3">
            {[
              { trigger: 'Prospect follow-up date reached', action: 'Surface in Needs Follow-up filter' },
              { trigger: 'Invoice due date reached (unpaid)', action: 'Status changes to Overdue' },
              { trigger: 'Payment recorded', action: 'Auto-create ledger entry in Finance' },
              { trigger: 'Deal converted from prospect', action: 'Link historical notes to deal' },
              { trigger: 'User tab active (30s interval)', action: 'Presence heartbeat sent' },
            ].map(({ trigger, action }) => (
              <div key={trigger} className="border border-border rounded-lg p-3 text-sm">
                <p className="font-medium text-foreground text-xs mb-1">TRIGGER</p>
                <p className="text-muted-foreground mb-2">{trigger}</p>
                <p className="font-medium text-foreground text-xs mb-1">ACTION</p>
                <p className="text-muted-foreground">{action}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">API-based Automation</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Use the Consty REST API to build custom integrations. Authenticate with a session cookie, then call any endpoint to create prospects, record payments, or query reports. Combine with <strong className="text-foreground">cron jobs</strong> or tools like Zapier or Make.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/workflow" className="flex items-center gap-1 text-sm text-primary hover:underline">← Workflow</Link>
        <Link href="/docs/api" className="flex items-center gap-1 text-sm text-primary hover:underline">API Reference <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
