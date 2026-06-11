-- =============================================================================
-- MIGRATION 941: System Architecture Audit, Issue Tracking & Documentation
-- Applies: 2026-03-19
-- Author:  Consty Core Systems Architect
-- Purpose:
--   1. Augment system_issues with architecture audit fields
--   2. Create docs + doc_versions tables for DB-backed documentation
--   3. Fix data_scope for 'user' and 'viewer' roles (GLOBAL → OWN)
--   4. Fill missing route_path on 10 permissions
--   5. Insert all identified architectural issues as records
--   6. Seed foundational documentation records
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. AUGMENT system_issues
--    Add architecture/audit-specific fields without modifying existing data.
--    system_id gets a DEFAULT so platform-level issues don't need it.
-- ---------------------------------------------------------------------------
ALTER TABLE system_issues
  ALTER COLUMN system_id DROP NOT NULL;

ALTER TABLE system_issues
  ADD COLUMN IF NOT EXISTS root_cause         TEXT,
  ADD COLUMN IF NOT EXISTS affected_modules   TEXT[],
  ADD COLUMN IF NOT EXISTS fix_summary        TEXT,
  ADD COLUMN IF NOT EXISTS related_logs       JSONB        DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS verified_by        VARCHAR(50)  DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS detected_at        TIMESTAMPTZ  DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS fixed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category           VARCHAR(50)  DEFAULT 'system';

-- ---------------------------------------------------------------------------
-- 2. CREATE docs TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE,
  content     TEXT         NOT NULL DEFAULT '',
  category    VARCHAR(50)  NOT NULL DEFAULT 'general',
  version     VARCHAR(20)  NOT NULL DEFAULT '1.0',
  is_public   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category);
CREATE INDEX IF NOT EXISTS idx_docs_slug     ON docs(slug);

-- ---------------------------------------------------------------------------
-- 3. CREATE doc_versions TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doc_versions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id           UUID        NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  content_snapshot TEXT        NOT NULL,
  version          VARCHAR(20) NOT NULL,
  changed_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON doc_versions(doc_id);

-- ---------------------------------------------------------------------------
-- 4. FIX data_scope: user and viewer should see OWN records, not GLOBAL
-- ---------------------------------------------------------------------------
UPDATE roles SET data_scope = 'OWN' WHERE name IN ('user', 'viewer');

-- ---------------------------------------------------------------------------
-- 5. FILL missing route_path on permissions
-- ---------------------------------------------------------------------------
UPDATE permissions SET route_path = '/app/approvals'      WHERE module = 'approvals' AND action IN ('view', 'manage') AND (route_path IS NULL OR route_path = '');
UPDATE permissions SET route_path = '/app/invoices'       WHERE module = 'invoices'  AND action = 'manage'            AND (route_path IS NULL OR route_path = '');
UPDATE permissions SET route_path = '/app/reports'        WHERE module = 'reports'   AND action = 'export'            AND (route_path IS NULL OR route_path = '');
UPDATE permissions SET route_path = '/app/staff'          WHERE module = 'staff'     AND action IN ('create', 'delete', 'update') AND (route_path IS NULL OR route_path = '');
UPDATE permissions SET route_path = '/app/admin/users'    WHERE module = 'users'     AND action IN ('create', 'delete', 'update') AND (route_path IS NULL OR route_path = '');

-- ---------------------------------------------------------------------------
-- 6. INSERT ARCHITECTURAL ISSUES
--    Consty platform system_id: c987ff73-d468-4de5-9ccb-70cd0741e4b4
-- ---------------------------------------------------------------------------

INSERT INTO system_issues (
  system_id, title, description, root_cause, affected_modules, severity,
  status, detected_at, category, verified_by, related_logs
) VALUES

-- Issue 1: CRITICAL — isSuperadmin always false in getCurrentUser()
(
  'c987ff73-d468-4de5-9ccb-70cd0741e4b4',
  'isSuperadmin always false in getCurrentUser()',
  'current-user.js returns isSuperadmin: user.is_superadmin ?? false. The users table has no is_superadmin column, so user.is_superadmin is always undefined, making isSuperadmin always false even for superadmin role users.',
  'users table has no is_superadmin column; getCurrentUser() should derive isSuperadmin from user.role === ''superadmin'' instead of reading a non-existent column',
  ARRAY['auth', 'docs', 'admin'],
  'critical',
  'fixed',
  NOW(),
  'auth',
  'system',
  '{"fix": "Changed isSuperadmin derivation in current-user.js to use role === ''superadmin''"}'::JSONB
),

-- Issue 2: HIGH — user and viewer roles have GLOBAL data_scope
(
  'c987ff73-d468-4de5-9ccb-70cd0741e4b4',
  'user and viewer roles have GLOBAL data_scope — exposes all records',
  'The ''user'' and ''viewer'' roles were assigned data_scope = GLOBAL during initial RBAC setup. This means any regular user or viewer can query ALL prospects, deals, payments, and expenses across the entire system — bypassing the intended per-user restriction.',
  'Initial role seeding assigned GLOBAL scope to non-admin roles without review; data_scope should be OWN for user and viewer tiers',
  ARRAY['prospects', 'deals', 'payments', 'expenses', 'finance', 'rbac'],
  'high',
  'fixed',
  NOW(),
  'rbac',
  'system',
  '{"fix": "SET data_scope = OWN for user and viewer roles via migration"}'::JSONB
),

-- Issue 3: MEDIUM — 10 permissions missing route_path
(
  'c987ff73-d468-4de5-9ccb-70cd0741e4b4',
  '10 permissions missing route_path — incomplete route-permission map',
  'The permissions: approvals.view, approvals.manage, invoices.manage, reports.export, staff.create/update/delete, users.create/update/delete have no route_path. This prevents the Access Inspector and RoutePermissionGuard from correctly identifying which routes require those permissions.',
  'Permission records were created for module-level CRUD actions (create/update/delete) without populating the route_path field, which is required for route→permission resolution',
  ARRAY['rbac', 'permissions', 'admin'],
  'medium',
  'fixed',
  NOW(),
  'rbac',
  'system',
  '{"fix": "Added route_path for all 10 affected permissions via migration"}'::JSONB
),

-- Issue 4: MEDIUM — docs and doc_versions tables absent
(
  'c987ff73-d468-4de5-9ccb-70cd0741e4b4',
  'docs and doc_versions tables missing — no DB-backed documentation',
  'The planned architecture includes a database-backed documentation system (docs, doc_versions tables) but these tables were never created. All documentation is static code with no versioning, search, or dynamic delivery.',
  'Documentation database layer was designed but never implemented; no migration was created to add the docs/doc_versions tables',
  ARRAY['docs', 'knowledge'],
  'medium',
  'fixed',
  NOW(),
  'docs',
  'system',
  '{"fix": "Created docs and doc_versions tables via migration 941"}'::JSONB
),

-- Issue 5: MEDIUM — system_issues lacks audit fields
(
  'c987ff73-d468-4de5-9ccb-70cd0741e4b4',
  'system_issues table lacks root_cause, fix_summary, related_logs fields',
  'The system_issues table tracks product-level bugs but lacks the fields required for architectural issue tracking: root_cause, affected_modules, fix_summary, related_logs, verified_by, detected_at, fixed_at. These are essential for the system audit trail.',
  'system_issues was designed for reported product bugs with FK to systems table; architectural audit usage was never anticipated in the original schema',
  ARRAY['audit', 'admin'],
  'medium',
  'fixed',
  NOW(),
  'audit',
  'system',
  '{"fix": "Added 7 new columns to system_issues via migration 941"}'::JSONB
),

-- Issue 6: LOW — middleware checks cookie presence only, not session validity
(
  'c987ff73-d468-4de5-9ccb-70cd0741e4b4',
  'Middleware validates cookie presence only, not session validity',
  'The Next.js edge middleware can only verify that the consty_session cookie exists, not that the session is valid, active, or unexpired. A user with a revoked or expired session cookie can pass the middleware check and only be blocked at the server component (layout) level.',
  'Edge runtime limitations: no database access available in middleware; session validation must happen in server components and API routes, not edge middleware',
  ARRAY['auth', 'middleware'],
  'low',
  'open',
  NOW(),
  'auth',
  'system',
  '{"note": "By design: server layout (AppLayout) and API requirePermission() handle real session validation. Edge middleware is a traffic gate only."}'::JSONB
)

ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. SEED FOUNDATIONAL DOCUMENTATION
-- ---------------------------------------------------------------------------
INSERT INTO docs (id, title, slug, content, category, version, is_public) VALUES

(
  gen_random_uuid(),
  'Authentication System',
  'auth-system',
  '# Authentication System

## Overview
Consty uses server-side sessions exclusively — no JWT, no stateless tokens.

## How It Works
1. User submits credentials to `POST /api/auth/login`
2. Server verifies bcrypt hash against `users.password_hash`
3. A session record is inserted into the `sessions` table
4. Session ID is set as an HTTP-only, SameSite=Strict cookie (`consty_session`)
5. All subsequent requests include the cookie automatically

## Session Security
- **Inactivity timeout**: 60 minutes of idle time revokes the session
- **Absolute expiry**: 7 days maximum session lifetime
- **Device tracking**: Each session records device_name, ip_address, user_agent
- **Revocation**: Sessions can be individually revoked via `/api/auth/sessions`

## Multi-Device Support
GET `/api/auth/sessions` — list all active sessions for current user
DELETE `/api/auth/sessions` — revoke specific session or all other sessions

## No JWT Policy
JWT is explicitly prohibited. All authentication state lives in the `sessions` table.
Any JWT library usage in the codebase is a critical bug to be fixed immediately.',
  'security',
  '1.0',
  FALSE
),

(
  gen_random_uuid(),
  'RBAC Architecture',
  'rbac-architecture',
  '# Role-Based Access Control (RBAC)

## Permission Model
Permissions are `module.action` strings, e.g. `finance.view`, `deals.create`.

## Access Chain
```
users → staff → staff_roles → roles → role_permissions → permissions
```
Fallback for users without a staff record:
```
users.role (text) → roles → role_permissions → permissions
```

## Data Scope
Each role has a `data_scope` that controls which records a user can see:
- **OWN** — only records they created
- **DEPARTMENT** — records in their department
- **GLOBAL** — all records (admin/manager only)

| Role       | data_scope  |
|------------|-------------|
| superadmin | GLOBAL      |
| admin      | GLOBAL      |
| manager    | DEPARTMENT  |
| user       | OWN         |
| viewer     | OWN         |

## Permission Caching
Permissions are cached in-memory per user with a 5-minute TTL to reduce DB load.
Cache is invalidated on role/permission changes.

## requirePermission()
API routes use `requirePermission(request, ''module.action'')` which:
1. Verifies the session
2. Checks cache or loads from DB
3. Returns `{ auth, dataScope, departmentId }` on success
4. Returns `NextResponse 403` on failure',
  'security',
  '1.0',
  FALSE
),

(
  gen_random_uuid(),
  'Database Architecture',
  'database-architecture',
  '# Database Architecture

## Technology
Neon Serverless PostgreSQL — accessed via connection pooling.

## Core Tables

| Table | Purpose |
|-------|---------|
| users | Authentication identities |
| staff | Employee/contractor profiles |
| staff_roles | Links staff to RBAC roles |
| roles | Role definitions with authority_level and data_scope |
| permissions | Module.action permission strings with route_path |
| role_permissions | Role ↔ Permission junction |
| sessions | Server-side session store |
| docs | System documentation records |
| doc_versions | Versioned snapshots of documentation |
| system_issues | Architecture issue tracker |

## User ↔ Staff Linkage
- `users.staff_id` → `staff.id` (primary link)
- `staff.user_id` and `staff.linked_user_id` as secondary back-references
- Every active user must have a linked staff record
- Users without a staff record fall back to role-text-based permissions (degraded mode)

## Session Security Model
Sessions table has:
- `is_revoked` boolean for explicit revocation
- `inactivity_timeout_minutes` per-session idle limit
- `device_name`, `ip_address`, `user_agent` for device tracking',
  'architecture',
  '1.0',
  FALSE
),

(
  gen_random_uuid(),
  'API Security Patterns',
  'api-security-patterns',
  '# API Security Patterns

## All API Routes Must Use requirePermission()

```js
import { requirePermission } from ''@/lib/permissions'';

export async function GET(request) {
  const perm = await requirePermission(request, ''module.view'');
  if (perm instanceof NextResponse) return perm; // 401 or 403
  const { auth, dataScope, departmentId } = perm;
  // ... proceed with data_scope-filtered query
}
```

## Data Scope Filtering

```js
import { buildDataScopeFilter } from ''@/lib/permissions'';

const filter = buildDataScopeFilter({
  dataScope,
  userId: auth.userId,
  departmentId,
  tableAlias: ''p'',
  paramOffset: existingParams.length,
});
const params = [...existingParams, ...filter.params];
const sql = `SELECT * FROM prospects p WHERE 1=1${filter.clause}`;
```

## Never Trust Client Input
- All user IDs come from the verified session, never from the request body/query
- Data scope is derived server-side from the role chain, never from the client

## Error Responses
All API errors follow the format:
```json
{ "success": false, "error": "Human-readable message" }
```',
  'security',
  '1.0',
  FALSE
)

ON CONFLICT (slug) DO NOTHING;

COMMIT;
