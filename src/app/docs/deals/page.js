import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata = { title: 'Deals & Pipeline — Consty Docs' };

const stages = [
  { name: 'Lead', color: 'bg-gray-100 text-gray-700', desc: 'Initial interest, not yet qualified' },
  { name: 'Qualified', color: 'bg-blue-100 text-blue-700', desc: 'Need confirmed, budget checked' },
  { name: 'Proposal', color: 'bg-purple-100 text-purple-700', desc: 'Offer or proposal sent' },
  { name: 'Negotiation', color: 'bg-yellow-100 text-yellow-700', desc: 'Back-and-forth on terms' },
  { name: 'Won', color: 'bg-green-100 text-green-700', desc: 'Deal closed, revenue secured' },
  { name: 'Lost', color: 'bg-red-100 text-red-700', desc: 'Did not proceed' },
];

export default function DealsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Deals</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Deals & Pipeline</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Track opportunities from negotiation to closed-won — with payments, invoices, and forecasting built in.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Deal Stages</h2>
          <p className="text-sm text-muted-foreground mb-4">Every deal moves through a defined pipeline. Update the stage as the deal progresses.</p>
          <div className="space-y-2">
            {stages.map((s) => (
              <div key={s.name} className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium min-w-24 text-center ${s.color}`}>{s.name}</span>
                <span className="text-muted-foreground">{s.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Creating a Deal</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">1.</span>Go to <strong className="text-foreground">Deals</strong> → <strong className="text-foreground">New Deal</strong></li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">2.</span>Enter the deal name, value, and expected close date</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">3.</span>Link to a prospect (or create a standalone deal)</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">4.</span>Set the initial stage</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">5.</span>Add notes and save</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Recording Payments</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            A deal can have multiple partial payments. Each payment records the <strong className="text-foreground">amount received, date, and payment method</strong>. Consty automatically creates the corresponding ledger entry in the Finance module.
          </p>
          <div className="border border-border rounded-lg p-4 font-mono text-xs text-muted-foreground space-y-1">
            <p><span className="text-green-600">DEBIT</span>  Bank Account         $3,000</p>
            <p><span className="text-red-600">CREDIT</span> Client Revenue Account $3,000</p>
            <p className="text-muted-foreground/50 pt-1">// Auto-created when payment is recorded</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Pipeline Forecasting</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The pipeline view shows your <strong className="text-foreground">weighted forecast</strong>: each deal's value multiplied by its probability of closing, summed across your pipeline. Use this to project monthly revenue.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/prospecting" className="flex items-center gap-1 text-sm text-primary hover:underline">← Prospecting</Link>
        <Link href="/docs/finance" className="flex items-center gap-1 text-sm text-primary hover:underline">Finance <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
