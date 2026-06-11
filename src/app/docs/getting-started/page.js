import Link from 'next/link';
import { ArrowRight, CheckCircle2, LogIn, LayoutDashboard, Target, DollarSign } from 'lucide-react';

export const metadata = { title: 'Getting Started — Consty Docs' };

function Step({ number, title, description, children }) {
  return (
    <div className="flex gap-4 pb-8 border-b border-border last:border-0 last:pb-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mb-3">{description}</p>}
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="bg-muted border border-border rounded-lg px-4 py-3 text-sm font-mono text-foreground overflow-x-auto">
      {children}
    </pre>
  );
}

export default function GettingStartedPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Getting Started</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Getting Started</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Get Consty running and learn the core workflow in under 10 minutes.
        </p>
      </div>

      {/* Prerequisites */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-8 text-sm">
        <p className="font-medium text-blue-900 mb-1">Prerequisites</p>
        <p className="text-blue-800">Node.js 18+, PostgreSQL database (Neon recommended), and a Consty account with admin access.</p>
      </div>

      {/* Steps */}
      <div className="space-y-0 mb-10">
        <Step
          number="1"
          title="Sign in to Consty"
          description="Navigate to your Consty instance and sign in with the credentials provided by your administrator."
        >
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <LogIn className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Go to your Consty URL</p>
              <p className="text-xs text-muted-foreground">e.g. https://consty.yourdomain.com/login</p>
            </div>
          </div>
        </Step>

        <Step
          number="2"
          title="Explore the Dashboard"
          description="The dashboard is your command center. It shows an overview of your pipeline, recent activity, and key metrics."
        >
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: LayoutDashboard, label: 'Pipeline overview', desc: 'Active deals & values' },
              { icon: Target, label: 'Prospects', desc: 'Leads in the funnel' },
              { icon: DollarSign, label: 'Revenue', desc: 'Collected payments' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-2 p-2 bg-muted/40 rounded-md">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Step>

        <Step
          number="3"
          title="Add your first prospect"
          description="Prospects are potential clients. Go to Prospecting → New Prospect and fill in their details."
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Enter name, email, and company</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Set a follow-up date</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Add notes about the opportunity</div>
          </div>
        </Step>

        <Step
          number="4"
          title="Convert to a deal"
          description="When a prospect is ready, convert them to a Deal. Deals have a value, stage, and expected close date."
        >
          <p className="text-sm text-muted-foreground">
            Open the prospect record and click <strong className="text-foreground">Convert to Deal</strong>.
            The deal will appear in your pipeline view.
          </p>
        </Step>

        <Step
          number="5"
          title="Record a payment"
          description="When you collect money from a client, record it as a payment against the deal."
        >
          <p className="text-sm text-muted-foreground">
            Inside a deal, open the <strong className="text-foreground">Payments</strong> tab and add the received amount.
            The payment will automatically create a ledger entry in your Finance module.
          </p>
        </Step>
      </div>

      {/* Next steps */}
      <div className="border border-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-4">Next Steps</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Learn core concepts', href: '/docs/concepts', desc: 'RBAC, modules, data flow' },
            { label: 'Prospecting guide', href: '/docs/prospecting', desc: 'Full funnel walkthrough' },
            { label: 'Finance overview', href: '/docs/finance', desc: 'Accounts & ledger' },
            { label: 'Module overview', href: '/docs/modules', desc: 'All 8 modules explained' },
          ].map(({ label, href, desc }) => (
            <Link key={href} href={href} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:border-primary/40 transition-colors">
              <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
