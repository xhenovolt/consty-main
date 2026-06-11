import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata = { title: 'User Management — Consty Docs' };

const roles = [
  { name: 'viewer', color: 'bg-gray-100 text-gray-700', perms: ['View dashboard', 'View reports', 'Read-only all modules'] },
  { name: 'member', color: 'bg-blue-100 text-blue-700', perms: ['All viewer permissions', 'Create prospects & deals', 'Record payments', 'Create invoices'] },
  { name: 'manager', color: 'bg-green-100 text-green-700', perms: ['All member permissions', 'Edit and delete records', 'Manage team members', 'View audit logs'] },
  { name: 'admin', color: 'bg-orange-100 text-orange-700', perms: ['All manager permissions', 'System configuration', 'User role assignment', 'Full audit access'] },
  { name: 'superadmin', color: 'bg-red-100 text-red-700', perms: ['All admin permissions', 'Architecture docs (private)', 'DB schema access', 'Security configuration'] },
];

export default function UsersPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/docs" className="hover:text-foreground">Documentation</Link>
          <span>/</span>
          <span>User Management</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">User Management</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Add team members, assign roles, and monitor online presence.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Roles & Permissions</h2>
          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.name} className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${role.color}`}>{role.name}</span>
                </div>
                <ul className="grid sm:grid-cols-2 gap-1">
                  {role.perms.map((p) => (
                    <li key={p} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Inviting Users</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">1.</span>Go to <strong className="text-foreground">Settings → Users → Invite User</strong></li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">2.</span>Enter the user's name and email</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">3.</span>Assign a role</li>
            <li className="flex gap-3"><span className="font-bold text-foreground min-w-5">4.</span>The user receives an email to set their password</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Online Presence</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Consty uses a <strong className="text-foreground">heartbeat system</strong> to show real-time presence. Each signed-in user pings the server every 30 seconds while their browser tab is active. If no ping is received within 60 seconds, the user is shown as offline. Admins can see presence for all users in the Users list.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-muted-foreground">Online — active tab, last ping &lt;60s</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
              <span className="text-muted-foreground">Offline — tab closed or no recent ping</span>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex justify-between">
        <Link href="/docs/reports" className="flex items-center gap-1 text-sm text-primary hover:underline">← Reports</Link>
        <Link href="/docs/security" className="flex items-center gap-1 text-sm text-primary hover:underline">Security <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
