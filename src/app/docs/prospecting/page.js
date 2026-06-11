import Link from 'next/link';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export const metadata = { title: 'Prospecting — Consty Docs' };

export default function ProspectingPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Prospecting</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Prospecting</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Manage your lead pipeline — from first contact to converted client.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Overview</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The Prospecting module is the entry point for new business. Every potential client starts as a <strong className="text-foreground">prospect</strong>. You track them through interactions, schedule follow-ups, and convert them to deals when they're ready to buy.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
            {['New Lead', 'Follow-up Scheduled', 'Contacted', 'Qualified', 'Converted'].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="px-2 py-1 bg-muted border border-border rounded text-xs">{s}</span>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Creating a Prospect</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="font-bold text-foreground min-w-5">1.</span>
              Navigate to <strong className="text-foreground">Prospecting</strong> in the sidebar and click <strong className="text-foreground">New Prospect</strong>.
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground min-w-5">2.</span>
              Fill in the required fields: <strong className="text-foreground">Name</strong>, <strong className="text-foreground">Email</strong>, and optionally <strong className="text-foreground">Company</strong>, phone, and source.
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground min-w-5">3.</span>
              Set a <strong className="text-foreground">follow-up date</strong>. This will surface the prospect in your reminders.
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground min-w-5">4.</span>
              Add any initial <strong className="text-foreground">notes</strong> — context from your first conversation.
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground min-w-5">5.</span>
              Click <strong className="text-foreground">Save</strong>. The prospect now appears in your list.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Managing Follow-ups</h2>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Follow-up dates are central to the prospecting workflow. Set a date after every interaction. When the date arrives, the prospect is surfaced in the <strong className="text-foreground">Needs Follow-up</strong> view.
          </p>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <p className="font-medium text-amber-900 mb-1 flex items-center gap-2"><AlertCircle size={14} /> Best Practice</p>
            <p className="text-amber-800">Always set a follow-up date before closing a prospect record. Prospects without follow-up dates fall through the cracks.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Converting to a Deal</h2>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            When a prospect is ready to proceed, convert them to a deal:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Open the prospect record</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Click <strong className="text-foreground">Convert to Deal</strong></li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Set the deal value and expected close date</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> The prospect status changes to <em>Converted</em></li>
          </ul>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/getting-started" className="flex items-center gap-1 text-sm text-primary hover:underline">← Getting Started</Link>
        <Link href="/docs/deals" className="flex items-center gap-1 text-sm text-primary hover:underline">Deals & Pipeline <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
