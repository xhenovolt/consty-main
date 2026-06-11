import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata = { title: 'Business Workflow — Consty Docs' };

const flow = [
  { step: 1, title: 'Prospect', desc: 'Capture the lead. Record name, email, company, and source. Set a follow-up date.', module: 'Prospecting', color: 'border-blue-300 bg-blue-50' },
  { step: 2, title: 'Follow-up', desc: 'Log every touchpoint. Update notes after each call or email. Reschedule as needed.', module: 'Prospecting', color: 'border-blue-300 bg-blue-50' },
  { step: 3, title: 'Convert', desc: "When the prospect says yes, convert to a Deal. Consty links the histories automatically.", module: 'Prospecting → Deals', color: 'border-purple-300 bg-purple-50' },
  { step: 4, title: 'Deal & Negotiation', desc: 'Set deal value, expected close, and stage. Record discussion notes and milestones.', module: 'Deals', color: 'border-purple-300 bg-purple-50' },
  { step: 5, title: 'Invoice', desc: 'Create a professional invoice from the deal. Add line items, tax, and payment terms.', module: 'Invoicing', color: 'border-orange-300 bg-orange-50' },
  { step: 6, title: 'Payment', desc: 'Record when payment arrives. Partial payments supported. Consty updates the invoice status.', module: 'Deals / Invoicing', color: 'border-orange-300 bg-orange-50' },
  { step: 7, title: 'Ledger', desc: 'A double-entry ledger record is auto-created. Debit to bank, credit to revenue account.', module: 'Finance', color: 'border-green-300 bg-green-50' },
  { step: 8, title: 'Report', desc: 'Revenue, pipeline, and expense data roll up automatically into reports and dashboard widgets.', module: 'Reports', color: 'border-teal-300 bg-teal-50' },
];

export default function WorkflowPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Business Workflow</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Business Workflow</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          The complete lifecycle — from first contact with a prospect to revenue on your books.
        </p>
      </div>

      <div className="p-4 bg-muted/30 border border-border rounded-xl mb-8 text-sm">
        <p className="font-medium text-foreground mb-2">The Core Loop</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {['Prospect', 'Follow-up', 'Convert', 'Deal', 'Invoice', 'Payment', 'Ledger', 'Report'].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="px-2 py-1 bg-primary/10 text-primary font-medium rounded">{s}</span>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-6">
          {flow.map((item) => (
            <div key={item.step} className="flex gap-4 relative">
              <div className="flex-shrink-0 z-10 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                {item.step}
              </div>
              <div className={`flex-1 border ${item.color} rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <span className="text-xs text-muted-foreground bg-white/60 border border-border px-2 py-0.5 rounded-full">{item.module}</span>
                </div>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 border border-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-3">Data Automatically Flows Between Modules</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You never need to enter the same data twice. Converting a prospect carries their details to the deal. A recorded payment updates the invoice, the deal, and creates a ledger entry — all from a single action. Reports pull from live data across all modules with no manual exports.
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/audit" className="flex items-center gap-1 text-sm text-primary hover:underline">← Audit Log</Link>
        <Link href="/docs/automation" className="flex items-center gap-1 text-sm text-primary hover:underline">Automation <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
