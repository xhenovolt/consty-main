'use client';

import Link from 'next/link';
import { ArrowLeft, Code, Database, FileCode, GitBranch, Shield, Zap } from 'lucide-react';

export default function DeveloperPage() {
  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/app/docs"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documentation
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-xl p-8 shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-4">Developer Documentation</h1>
          <p className="text-xl text-gray-100">
            Technical architecture, API patterns, and extension guide for Consty.
          </p>
        </div>

        {/* Project Structure */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <FileCode className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-foreground">Project Structure</h2>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg font-mono text-sm text-green-400 overflow-x-auto">
            <pre>{`consty/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── prospects/    # Prospect endpoints
│   │   │   ├── deals/        # Deal endpoints
│   │   │   ├── payments/     # Payment endpoints
│   │   │   └── ...
│   │   ├── app/              # Protected app routes
│   │   │   ├── dashboard/
│   │   │   ├── prospecting/
│   │   │   ├── deals/
│   │   │   ├── docs/         # Documentation portal
│   │   │   └── ...
│   │   ├── login/            # Public login page
│   │   └── layout.js
│   └── lib/
│       ├── db.js             # Database connection
│       ├── auth.js           # Authentication
│       ├── validation.js     # Zod schemas
│       └── ...
├── migrations/               # SQL migrations
├── public/                   # Static assets
├── middleware.ts             # Auth middleware
├── package.json
└── next.config.mjs`}</pre>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-yellow-600" />
            <h2 className="text-2xl font-bold text-foreground">Technology Stack</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Frontend</h3>
                <ul className="space-y-2 text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Next.js 16.1.1</strong> - App Router, Server Components</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>React 19.0.0</strong> - UI library</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Tailwind CSS 4.0</strong> - Utility-first styling</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Framer Motion</strong> - Animations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Lucide React</strong> - Icon library</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Backend</h3>
                <ul className="space-y-2 text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong>PostgreSQL</strong> - Neon Cloud database</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong>Node.js pg</strong> - Database driver</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong>Zod 4.2.1</strong> - Schema validation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong>Next.js API Routes</strong> - Backend endpoints</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* API Patterns */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Code className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-foreground">API Patterns</h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Standard CRUD Endpoints</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400">
                <pre>{`GET    /api/resource          # List all
POST   /api/resource          # Create new
GET    /api/resource/[id]     # Get one
PUT    /api/resource/[id]     # Update
DELETE /api/resource/[id]     # Delete`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Example API Route</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400 overflow-x-auto">
                <pre>{`// src/app/api/prospects/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { validateProspect } from '@/lib/validation';

export async function GET(request) {
  try {
    const result = await pool.query(
      'SELECT * FROM prospects ORDER BY created_at DESC'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validated = validateProspect(body); // Zod validation
    
    const result = await pool.query(
      \`INSERT INTO prospects (name, email, phone, source)
       VALUES ($1, $2, $3, $4)
       RETURNING *\`,
      [validated.name, validated.email, validated.phone, validated.source]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Validation with Zod</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400">
                <pre>{`// src/lib/validation.js
import { z } from 'zod';

export const prospectSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().min(1, 'Source required'),
}).refine(
  data => data.email || data.phone,
  { message: 'Either email or phone required' }
);

export function validateProspect(data) {
  return prospectSchema.parse(data);
}`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Database Architecture */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-foreground">Database Architecture</h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Connection Pool</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400">
                <pre>{`// src/lib/db.js
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default pool;`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Key Tables & Relationships</h3>
              <div className="bg-muted p-4 rounded-lg text-sm text-foreground">
                <ul className="space-y-2">
                  <li><strong>prospects</strong> → converts to → <strong>clients</strong></li>
                  <li><strong>deals</strong> → links to → <strong>clients</strong> + <strong>intellectual_property</strong> (systems)</li>
                  <li><strong>contracts</strong> → created from → <strong>deals</strong> (when won)</li>
                  <li><strong>payments</strong> → linked to → <strong>contracts</strong></li>
                  <li><strong>allocations</strong> → distribute → <strong>payments</strong></li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Database Triggers</h3>
              <p className="text-sm text-foreground mb-2">
                Critical business logic enforced at database level:
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm">
                <ul className="space-y-2 text-blue-900">
                  <li>• <strong>update_payment_allocation_status</strong> - Updates payment status based on total allocations</li>
                  <li>• <strong>validate_deal_requirements</strong> - Ensures deals have system_id and client/prospect</li>
                  <li>• <strong>validate_allocation_total</strong> - Prevents over-allocation of payments</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-foreground">Authentication & Authorization</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Middleware Protection</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400 overflow-x-auto">
                <pre>{`// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('auth-token');
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/app/:path*', // Protect all /app routes
};`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Role-Based Access Control</h3>
              <div className="bg-muted p-4 rounded-lg text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Access Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-semibold">User</td>
                      <td className="p-2 text-foreground">Basic read/write access</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-semibold">Manager</td>
                      <td className="p-2 text-foreground">Team oversight, reports</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-semibold">Admin</td>
                      <td className="p-2 text-foreground">User management, audit logs</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold">Super Admin</td>
                      <td className="p-2 text-foreground">Full system access</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Adding New Features */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <GitBranch className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-foreground">Adding New Features</h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Step 1: Database Migration</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400">
                <pre>{`-- migrations/114_add_new_feature.sql
CREATE TABLE new_feature (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Run with: psql $DATABASE_URL -f migrations/114_add_new_feature.sql`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Step 2: API Route</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400">
                <pre>{`// src/app/api/new-feature/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const result = await pool.query('SELECT * FROM new_feature');
  return NextResponse.json(result.rows);
}

export async function POST(request) {
  const { name } = await request.json();
  const result = await pool.query(
    'INSERT INTO new_feature (name) VALUES ($1) RETURNING *',
    [name]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Step 3: UI Page</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400 overflow-x-auto">
                <pre>{`// src/app/app/new-feature/page.js
'use client';
import { useState, useEffect } from 'react';

export default function NewFeaturePage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch('/api/new-feature')
      .then(res => res.json())
      .then(setItems);
  }, []);

  return (
    <div>
      <h1>New Feature</h1>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Step 4: Add to Navigation</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400 overflow-x-auto">
                <pre>{`// src/lib/navigation-config.js
export const navigationConfig = {
  sections: [
    // ... existing sections
    {
      label: 'New Feature',
      href: '/app/new-feature',
      icon: 'Star',
    },
  ],
};`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Testing */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Testing</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Manual Testing Checklist</h3>
              <ul className="space-y-2 text-sm text-foreground ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Test all CRUD operations via UI</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Verify validation errors display correctly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Check database constraints don't break</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Test with different user roles</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Verify responsive design on mobile</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-2">Build Test</h3>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm text-green-400">
                <pre>{`npm run build

# Should complete without errors
# Verifies all routes compile correctly`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Deployment */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 text-white rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Deployment</h2>
          <div className="space-y-4 text-green-50">
            <div>
              <h3 className="font-semibold mb-2">Environment Variables Required</h3>
              <div className="bg-green-900 p-3 rounded font-mono text-sm">
                <pre>{`DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NODE_ENV=production`}</pre>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Build & Deploy</h3>
              <div className="bg-green-900 p-3 rounded font-mono text-sm">
                <pre>{`npm run build
npm start

# Or deploy to Vercel/Netlify`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="bg-card rounded-xl p-8 shadow-sm mt-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Related Documentation</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link
              href="/app/docs/modules"
              className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition dark:hover:bg-purple-900/20"
            >
              <div className="font-semibold text-purple-900">Module Documentation</div>
              <div className="text-purple-700 text-sm mt-1">Detailed module reference</div>
            </Link>
            <Link
              href="/app/docs/system-map"
              className="p-4 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition dark:hover:bg-teal-900/20"
            >
              <div className="font-semibold text-teal-900">System Route Map</div>
              <div className="text-teal-700 text-sm mt-1">All routes & endpoints</div>
            </Link>
            <Link
              href="/app/docs/workflow"
              className="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition dark:hover:bg-orange-900/20"
            >
              <div className="font-semibold text-orange-900">Workflow Guide</div>
              <div className="text-orange-700 text-sm mt-1">Business process flow</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
