import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export const metadata = { title: 'Invoicing — Consty Docs' };

const statuses = [
  { name: 'Draft', color: 'bg-gray-100 text-gray-700', desc: 'Created but not sent' },
  { name: 'Sent', color: 'bg-blue-100 text-blue-700', desc: 'Delivered to client' },
  { name: 'Viewed', color: 'bg-purple-100 text-purple-700', desc: 'Client opened the invoice' },
  { name: 'Partial', color: 'bg-yellow-100 text-yellow-700', desc: 'Partially paid' },
  { name: 'Paid', color: 'bg-green-100 text-green-700', desc: 'Fully collected' },
  { name: 'Overdue', color: 'bg-red-100 text-red-700', desc: 'Past due date, unpaid' },
];

export default function InvoicingPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Invoicing</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Invoicing</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Create professional invoices, track payment status, and generate PDF exports for clients.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Invoice Lifecycle</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {statuses.map((s) => (
              <div key={s.name} className="flex flex-col items-center gap-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Creating an Invoice</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">1.</span>Go to <strong className="text-foreground">Invoices → New Invoice</strong></li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">2.</span>Select the client (from deals or add manually)</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">3.</span>Add line items — description, quantity, unit price, and tax rate</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">4.</span>Set the issue date and due date</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">5.</span>Add payment terms and notes</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">6.</span>Save as draft or send immediately</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">PDF Export</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every invoice can be exported as a professional PDF. The PDF includes your business details, client information, itemized line table, subtotal, tax, and total. View the PDF at <code className="bg-muted px-1 rounded font-mono text-xs">/app/invoices/[id]/view</code>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Marking Invoices Paid</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            When a client pays, mark the invoice as paid. Consty will:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-green-500" /> Update the invoice status to Paid</li>
            <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-green-500" /> Create a payment record on the linked deal</li>
            <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-green-500" /> Generate a ledger entry in the Finance module</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/finance" className="flex items-center gap-1 text-sm text-primary hover:underline">← Finance</Link>
        <Link href="/docs/reports" className="flex items-center gap-1 text-sm text-primary hover:underline">Reports <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
