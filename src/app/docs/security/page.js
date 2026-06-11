import Link from 'next/link';
import { ArrowRight, Shield, Lock, Key } from 'lucide-react';

export const metadata = { title: 'Security — Consty Docs' };

export default function SecurityPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>Security</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Security & Access Control</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          How Consty protects your data — authentication, sessions, RBAC, and route protection.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Authentication</h2>
          <div className="space-y-4">
            <div className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Lock className="w-4 h-4 text-primary" /><h3 className="font-medium text-foreground text-sm">Session-based Auth</h3></div>
              <p className="text-xs text-muted-foreground">Consty uses HTTP-only cookie sessions (<code className="bg-muted px-1 rounded font-mono">consty_session</code>). The cookie is inaccessible to JavaScript, protecting against XSS token theft.</p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Key className="w-4 h-4 text-primary" /><h3 className="font-medium text-foreground text-sm">Password Hashing</h3></div>
              <p className="text-xs text-muted-foreground">Passwords are hashed with bcrypt before storage. Plain-text passwords are never written to the database. The original password cannot be recovered — only reset.</p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-primary" /><h3 className="font-medium text-foreground text-sm">Route Guards</h3></div>
              <p className="text-xs text-muted-foreground">Middleware at <code className="bg-muted px-1 rounded font-mono">middleware.ts</code> intercepts requests to protected paths (<code className="bg-muted px-1 rounded font-mono">/app/*</code>, <code className="bg-muted px-1 rounded font-mono">/dashboard</code>, <code className="bg-muted px-1 rounded font-mono">/assets</code>) and redirects unauthenticated users to sign-in. Public paths (like <code className="bg-muted px-1 rounded font-mono">/docs/*</code>) are always accessible.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Role-Based Access Control</h2>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Every API endpoint checks the user's role before processing the request. Role checks are server-side — there's no reliance on client-side state to enforce permissions.
          </p>
          <div className="font-mono text-xs bg-muted border border-border rounded-lg p-4">
            <p className="text-muted-foreground">// Example server-side role check</p>
            <p className="text-foreground">const user = await getCurrentUser(req);</p>
            <p className="text-foreground">if (!user || user.role !== <span className="text-green-600">'admin'</span>) {`{`}</p>
            <p className="text-foreground pl-4">return NextResponse.json({`{ error: 'Forbidden' }`}, {`{ status: 403 }`});</p>
            <p className="text-foreground">{`}`}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Superadmin Content</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pages containing architecture diagrams, schema details, and system internals are restricted to users with <code className="bg-muted px-1 rounded font-mono text-xs">is_superadmin = true</code>. These are server-side checks — the page itself returns a 403 if accessed without the correct flag.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Logout</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Signing out destroys the session cookie server-side (via <code className="bg-muted px-1 rounded font-mono text-xs">POST /api/auth/logout</code>) and redirects to the landing page. The session cannot be replayed after logout.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/users" className="flex items-center gap-1 text-sm text-primary hover:underline">← Users</Link>
        <Link href="/docs/audit" className="flex items-center gap-1 text-sm text-primary hover:underline">Audit Logs <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
