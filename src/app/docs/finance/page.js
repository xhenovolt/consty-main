import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata = { title: 'Finance — Consty Docs' };

const accountTypes = [
  { type: 'Asset', examples: 'Bank accounts, receivables, equipment', normal: 'Debit' },
  { type: 'Liability', examples: 'Loans, payables, credit card', normal: 'Credit' },
  { type: 'Equity', examples: 'Owner capital, retained earnings', normal: 'Credit' },
  { type: 'Revenue', examples: 'Client payments, service income', normal: 'Credit' },
  { type: 'Expense', examples: 'Software, payroll, rent, marketing', normal: 'Debit' },
];

export default function FinancePage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Finance</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Finance & Accounting</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Double-entry bookkeeping, chart of accounts, ledger, expenses, budgets, and transfers — all in one module.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Your chart of accounts is the backbone of your financial records. Every transaction is assigned to at least two accounts (debit and credit). Consty creates default accounts when you set up your workspace — you can add custom ones at any time.
          </p>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Examples</th>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Normal Balance</th>
                </tr>
              </thead>
              <tbody>
                {accountTypes.map((row, i) => (
                  <tr key={row.type} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-4 py-2 font-medium text-foreground">{row.type}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.examples}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${row.normal === 'Debit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} dark:bg-red-900/30 dark:text-red-300 dark:bg-green-900/30 dark:text-green-300`}>{row.normal}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Recording Expenses</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">1.</span>Go to <strong className="text-foreground">Finance → Expenses → New Expense</strong></li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">2.</span>Select the expense category and account</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">3.</span>Enter the amount and date</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">4.</span>Optionally attach a receipt or note</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">5.</span>Save — a debit/credit entry is automatically created in the ledger</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Account Transfers</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Moving money between your own accounts (e.g., from a checking account to savings) is recorded as a <strong className="text-foreground">transfer</strong>. Transfers create offsetting ledger entries so your net position doesn't change — only the account balances shift.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Budgets</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Create monthly or annual budgets per expense category. Consty tracks your actuals against budgeted amounts in real-time, surfacing overspending via alerts in the Reports module.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">General Ledger</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The ledger is a chronological record of every debit and credit in your system. You cannot edit ledger entries — they are immutable. To correct an entry, create a reversing entry.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/deals" className="flex items-center gap-1 text-sm text-primary hover:underline">← Deals</Link>
        <Link href="/docs/invoicing" className="flex items-center gap-1 text-sm text-primary hover:underline">Invoicing <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
