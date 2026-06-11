import Link from 'next/link';

export const metadata = { title: 'API Reference — Consty Docs' };

function Endpoint({ method, path, desc, params, example }) {
  const colors = { GET: 'bg-blue-100 text-blue-700', POST: 'bg-green-100 text-green-700', PUT: 'bg-yellow-100 text-yellow-700', DELETE: 'bg-red-100 text-red-700', PATCH: 'bg-purple-100 text-purple-700' };
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-4">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${colors[method]}`}>{method}</span>
        <code className="text-sm font-mono text-foreground">{path}</code>
      </div>
      <div className="px-4 py-3 border-t border-border">
        <p className="text-sm text-muted-foreground mb-3">{desc}</p>
        {params && (
          <div className="mb-3">
            <p className="text-xs font-medium text-foreground mb-2">Parameters</p>
            <div className="space-y-1">
              {params.map(([name, type, required, detail]) => (
                <div key={name} className="flex gap-3 text-xs">
                  <code className="font-mono text-primary min-w-24">{name}</code>
                  <span className="text-muted-foreground min-w-12">{type}</span>
                  <span className={required ? 'text-red-500' : 'text-muted-foreground/60'}>{required ? 'required' : 'optional'}</span>
                  <span className="text-muted-foreground">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {example && (
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Example Response</p>
            <pre className="bg-muted rounded-lg px-3 py-2 text-xs font-mono text-foreground overflow-x-auto">{example}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApiPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>API Reference</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">API Reference</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Consty exposes a REST API for integrations, automation, and custom tooling.
        </p>
      </div>

      <div className="p-4 bg-muted/30 border border-border rounded-xl mb-8 text-sm">
        <p className="font-medium text-foreground mb-2">Authentication</p>
        <p className="text-muted-foreground">All API endpoints require a valid session cookie (<code className="bg-muted px-1 rounded font-mono text-xs">consty_session</code>). Sign in first via <code className="bg-muted px-1 rounded font-mono text-xs">POST /api/auth/signin</code>, then include the cookie in subsequent requests.</p>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">Authentication</h2>

      <Endpoint method="POST" path="/api/auth/signin"
        desc="Authenticate with email and password. Returns a session cookie on success."
        params={[
          ['email', 'string', true, 'User email address'],
          ['password', 'string', true, 'User password (plaintext over HTTPS)'],
        ]}
        example={`{ "user": { "id": "...", "name": "Alice", "role": "admin" }, "success": true }`}
      />

      <Endpoint method="GET" path="/api/auth/me"
        desc="Returns the current signed-in user's profile."
        example={`{ "user": { "id": "uuid", "name": "Alice", "email": "alice@co.com", "role": "admin" } }`}
      />

      <Endpoint method="POST" path="/api/auth/logout"
        desc="Destroys the current session. Redirects to sign-in."
      />

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Presence</h2>

      <Endpoint method="POST" path="/api/presence/ping"
        desc="Heartbeat endpoint. Upserts the current user's last_ping timestamp. Called automatically by the client every 30 seconds."
        example={`{ "success": true }`}
      />

      <Endpoint method="GET" path="/api/presence/status"
        desc="Get presence status. Pass ?userId=<uuid> for a specific user, or no params for all users (admin only)."
        params={[
          ['userId', 'string (UUID)', false, 'Filter to a specific user'],
        ]}
        example={`{ "online": true, "lastSeen": "2026-01-10T09:30:00Z" }`}
      />

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Error Codes</h2>
      <div className="border border-border rounded-xl overflow-hidden">
        {[
          ['200', 'Success'],
          ['400', 'Bad request — missing or invalid parameters'],
          ['401', 'Unauthorized — no valid session'],
          ['403', 'Forbidden — insufficient role'],
          ['404', 'Not found'],
          ['500', 'Server error — check logs'],
        ].map(([code, desc], i) => (
          <div key={code} className={`flex gap-4 px-4 py-2.5 text-sm border-t border-border first:border-t-0 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
            <code className={`font-mono font-bold min-w-10 ${code.startsWith('2') ? 'text-green-600' : code.startsWith('4') || code.startsWith('5') ? 'text-red-600' : 'text-foreground'}`}>{code}</code>
            <span className="text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <Link href="/docs/automation" className="flex items-center gap-1 text-sm text-primary hover:underline">← Automation</Link>
      </div>
    </div>
  );
}
