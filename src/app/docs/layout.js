/**
 * Public Documentation Layout
 * No authentication required — publicly accessible at /docs/*
 */
import Link from 'next/link';

export const metadata = {
  title: { template: '%s — Consty Docs', default: 'Consty Documentation' },
  description: 'Complete documentation for the Consty Construction Operations Platform.',
};

export default function DocsLayout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-primary">Consty</Link>
            <span className="text-muted-foreground text-sm">/</span>
            <Link href="/docs" className="text-sm font-medium text-foreground hover:text-primary transition">Docs</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/app/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition">Dashboard</Link>
            <Link href="/login" className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">Sign In</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex gap-8">
        {/* Sidebar navigation */}
        <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-22 self-start h-[calc(100vh-6rem)] overflow-y-auto">
          <nav className="space-y-6">
            <DocNavSection title="Getting Started">
              <DocNavLink href="/docs" exact>Introduction</DocNavLink>
              <DocNavLink href="/docs/getting-started">Quick Start</DocNavLink>
              <DocNavLink href="/docs/concepts">Core Concepts</DocNavLink>
            </DocNavSection>
            <DocNavSection title="Modules">
              <DocNavLink href="/docs/modules">Overview</DocNavLink>
              <DocNavLink href="/docs/prospecting">Opportunities</DocNavLink>
              <DocNavLink href="/docs/deals">Projects & Payments</DocNavLink>
              <DocNavLink href="/docs/finance">Finance</DocNavLink>
              <DocNavLink href="/docs/invoicing">Invoicing</DocNavLink>
              <DocNavLink href="/docs/reports">Reports</DocNavLink>
            </DocNavSection>
            <DocNavSection title="Administration">
              <DocNavLink href="/docs/users">User Management</DocNavLink>
              <DocNavLink href="/docs/security">Security & RBAC</DocNavLink>
              <DocNavLink href="/docs/audit">Audit Logs</DocNavLink>
            </DocNavSection>
            <DocNavSection title="Systems">
              <DocNavLink href="/docs/workflow">Workflow</DocNavLink>
              <DocNavLink href="/docs/automation">Automation</DocNavLink>
              <DocNavLink href="/docs/api">API Reference</DocNavLink>
              <DocNavLink href="/docs/architecture">Architecture ↗</DocNavLink>
            </DocNavSection>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function DocNavSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function DocNavLink({ href, children, exact = false }) {
  return (
    <li>
      <Link
        href={href}
        className="block px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}
