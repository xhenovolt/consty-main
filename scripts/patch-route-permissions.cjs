/**
 * scripts/patch-route-permissions.js
 *
 * Automatically injects requirePermission() guards into every unprotected
 * API route handler. Safe to re-run — already-patched files are skipped.
 *
 * Usage:
 *   node scripts/patch-route-permissions.js
 *
 * What it does per handler function (GET / POST / PUT / PATCH / DELETE):
 *   1. Finds "export async function METHOD(request" in the file
 *   2. Locates the FIRST "const auth = await verifyAuth(request)" inside that function
 *   3. Replaces that + the adjacent null-check with requirePermission
 *   4. Adds the requirePermission import if not already present
 *   5. For admin role-check pattern, replaces the 3-line block
 *
 * Permissions are assigned per-route from the PERMISSION_MAP below.
 * Routes in AUTH_ONLY get just a requireAuth check (no specific permission).
 * Routes already using requirePermission are skipped (idempotent).
 */

const fs = require('fs');
const path = require('path');

// ── PERMISSION MAP ─────────────────────────────────────────────────────────
// Key: relative path from project root
// Value: { GET?, POST?, PUT?, PATCH?, DELETE? }  — permission string per method
//        or a single string applying to ALL methods
const PERMISSION_MAP = {
  // Dashboard
  'src/app/api/dashboard/route.js':                        { GET: 'dashboard.view' },
  'src/app/api/intelligence/dashboard/route.js':           { GET: 'intelligence.view' },
  'src/app/api/founder/command-center/route.js':           { GET: 'dashboard.view' },
  'src/app/api/org/control-tower/route.js':                { GET: 'dashboard.view' },

  // Reports / Metrics
  'src/app/api/reports/route.js':                          { GET: 'reports.view' },
  'src/app/api/metrics/route.js':                          { GET: 'reports.view' },

  // Activity / Audit
  'src/app/api/activity/route.js':                         { GET: 'activity_logs.view' },
  'src/app/api/decision-logs/route.js':                    { GET: 'activity_logs.view', POST: 'activity_logs.view' },
  'src/app/api/decision-logs/[id]/route.js':               { GET: 'activity_logs.view', PUT: 'activity_logs.view', DELETE: 'activity_logs.view' },
  'src/app/api/admin/audit-logs/route.js':                 { GET: 'audit.view' },
  'src/app/api/admin/rbac-audit/route.js':                 { GET: 'audit.view' },
  'src/app/api/org/change-logs/route.js':                  { GET: 'audit.view' },

  // Admin — Users
  'src/app/api/admin/users/[userId]/route.js':             { GET: 'users.view', PUT: 'users.update' },

  // Admin — Roles & Permissions
  'src/app/api/admin/roles/route.js':                      { GET: 'roles.manage', POST: 'roles.manage' },
  'src/app/api/admin/roles/[roleId]/route.js':             { GET: 'roles.manage', PUT: 'roles.manage', DELETE: 'roles.manage' },
  'src/app/api/admin/roles/[roleId]/permissions/route.js': { GET: 'roles.manage', POST: 'roles.manage', PATCH: 'roles.manage' },
  'src/app/api/admin/permissions/route.js':                { GET: 'roles.manage', POST: 'roles.manage' },
  'src/app/api/admin/permissions/[permissionId]/route.js': { GET: 'roles.manage', PUT: 'roles.manage', DELETE: 'roles.manage' },
  'src/app/api/admin/authority-levels/route.js':           { GET: 'roles.manage', POST: 'roles.manage' },
  'src/app/api/admin/authority-levels/[id]/route.js':      { GET: 'roles.manage', PUT: 'roles.manage', DELETE: 'roles.manage' },

  // Admin — Staff roles
  'src/app/api/admin/staff/[staffId]/roles/route.js':      { GET: 'staff.update', POST: 'staff.update', DELETE: 'staff.update' },

  // Finance
  'src/app/api/accounts/[id]/route.js':                    { GET: 'finance.view', PUT: 'finance.create', DELETE: 'finance.manage' },
  'src/app/api/allocations/route.js':                      { GET: 'finance.view', POST: 'finance.create' },
  'src/app/api/budgets/[id]/route.js':                     { GET: 'finance.view', PUT: 'finance.create', DELETE: 'finance.manage' },
  'src/app/api/capital-allocation/route.js':               { GET: 'finance.view', POST: 'finance.create' },
  'src/app/api/expenses/[id]/route.js':                    { GET: 'finance.view', PUT: 'finance.create', DELETE: 'finance.manage' },
  'src/app/api/liabilities/route.js':                      { GET: 'finance.view', POST: 'finance.create' },
  'src/app/api/payments/[id]/route.js':                    { GET: 'finance.view', PUT: 'finance.create', DELETE: 'finance.manage' },
  'src/app/api/revenue-events/route.js':                   { GET: 'finance.view', POST: 'finance.create' },
  'src/app/api/transfers/route.js':                        { GET: 'finance.view', POST: 'finance.create' },
  'src/app/api/transfers/[id]/route.js':                   { GET: 'finance.view', PUT: 'finance.create', DELETE: 'finance.manage' },

  // Invoices
  'src/app/api/invoices/[id]/route.js':                    { GET: 'invoices.view', PUT: 'invoices.create', DELETE: 'invoices.manage' },
  'src/app/api/invoices/[id]/pdf/route.js':                { GET: 'invoices.view' },

  // CRM — Prospects
  'src/app/api/prospects/[id]/contacts/route.js':          { GET: 'prospects.view', POST: 'prospects.create' },
  'src/app/api/prospects/[id]/convert/route.js':           { POST: 'prospects.update' },
  'src/app/api/followups/route.js':                        { GET: 'prospects.view', POST: 'prospects.create' },
  'src/app/api/followups/[id]/route.js':                   { GET: 'prospects.view', PUT: 'prospects.update', DELETE: 'prospects.delete' },

  // Assets / Systems / Infrastructure
  'src/app/api/assets/route.js':                           { GET: 'assets.view', POST: 'assets.manage' },
  'src/app/api/services/route.js':                         { GET: 'services.view', POST: 'services.manage' },
  'src/app/api/services/[id]/route.js':                    { GET: 'services.view', PUT: 'services.manage', DELETE: 'services.manage' },
  'src/app/api/resources/route.js':                        { GET: 'systems.view', POST: 'systems.manage' },
  'src/app/api/licenses/route.js':                         { GET: 'licenses.view', POST: 'licenses.manage' },
  'src/app/api/system-costs/route.js':                     { GET: 'systems.view' },
  'src/app/api/tech-stack/route.js':                       { GET: 'systems.view' },
  'src/app/api/systems/[id]/changes/route.js':             { GET: 'systems.view', POST: 'systems.manage' },
  'src/app/api/systems/[id]/issues/route.js':              { GET: 'systems.view', POST: 'systems.manage' },
  'src/app/api/systems/[id]/operations/route.js':          { GET: 'systems.view', POST: 'systems.manage' },
  'src/app/api/systems/[id]/plans/route.js':               { GET: 'systems.view', POST: 'systems.manage' },

  // Operations / Knowledge
  'src/app/api/operations/route.js':                       { GET: 'operations.view', POST: 'operations.manage' },
  'src/app/api/offerings/route.js':                        { GET: 'offerings.view', POST: 'offerings.manage' },
  'src/app/api/offerings/[id]/route.js':                   { GET: 'offerings.view', PUT: 'offerings.manage', DELETE: 'offerings.manage' },
  'src/app/api/knowledge/route.js':                        { GET: 'knowledge.view', POST: 'knowledge.manage' },
  'src/app/api/knowledge-base/route.js':                   { GET: 'knowledge.view', POST: 'knowledge.manage' },
  'src/app/api/knowledge-base/[id]/route.js':              { GET: 'knowledge.view', PUT: 'knowledge.manage', DELETE: 'knowledge.manage' },
  'src/app/api/items/route.js':                            { GET: 'operations.view', POST: 'operations.manage' },
  'src/app/api/documents/route.js':                        { GET: 'documents.view', POST: 'documents.manage' },
  'src/app/api/obligations/route.js':                      { GET: 'operations.view', POST: 'operations.manage' },

  // Media
  'src/app/api/media/route.js':                            { GET: 'media.view', POST: 'media.manage' },
  'src/app/api/media/upload/route.js':                     { POST: 'media.manage' },
  'src/app/api/media/stats/route.js':                      { GET: 'media.view' },

  // Departments / Org
  'src/app/api/departments/route.js':                      { GET: 'departments.view', POST: 'departments.manage' },
  'src/app/api/departments/[id]/route.js':                 { GET: 'departments.view', PUT: 'departments.manage', DELETE: 'departments.manage' },
  'src/app/api/departments/[id]/documents/route.js':       { GET: 'departments.view', POST: 'departments.manage' },
  'src/app/api/departments/[id]/kpis/route.js':            { GET: 'departments.view', POST: 'departments.manage' },
  'src/app/api/departments/[id]/policies/route.js':        { GET: 'departments.view', POST: 'departments.manage' },
  'src/app/api/departments/[id]/processes/route.js':       { GET: 'departments.view', POST: 'departments.manage' },
  'src/app/api/org/structure/route.js':                    { GET: 'departments.view' },
  'src/app/api/org/structure/[id]/route.js':               { GET: 'departments.view', PUT: 'departments.manage', DELETE: 'departments.manage' },
  'src/app/api/org/approvals/route.js':                    { GET: 'approvals.view', POST: 'approvals.manage' },

  // Approvals
  'src/app/api/approvals/route.js':                        { GET: 'approvals.view', POST: 'approvals.manage' },
  'src/app/api/approvals/[id]/route.js':                   { GET: 'approvals.view', PUT: 'approvals.manage' },

  // Staff actions
  'src/app/api/staff/actions/route.js':                    { POST: 'staff.update' },

  // Employees
  'src/app/api/employees/route.js':                        { GET: 'staff.view', POST: 'staff.create' },

  // Issue tracking
  'src/app/api/issue-intelligence/route.js':               { GET: 'intelligence.view' },

  // Users search
  'src/app/api/users/search/route.js':                     { GET: 'users.view' },

  // Backups (admin only)
  'src/app/api/backups/route.js':                          { GET: 'audit.view', POST: 'audit.view' },
  'src/app/api/backups/restore/route.js':                  { POST: 'audit.view' },
};

// Routes that need auth but no specific RBAC permission
// (utility/infrastructure routes used by all authenticated users)
const AUTH_ONLY = new Set([
  'src/app/api/presence/ping/route.js',
  'src/app/api/presence/status/route.js',
  'src/app/api/users/presence/route.js',
  'src/app/api/notifications/route.js',
  'src/app/api/notifications/stream/route.js',
  'src/app/api/comments/route.js',
  'src/app/api/events/route.js',
  'src/app/api/roles/search/route.js',
  'src/app/api/system-events/route.js',
  'src/app/api/bug-reports/route.js',
  'src/app/api/feature-requests/route.js',
]);

// ── IMPORT SNIPPETS ────────────────────────────────────────────────────────
const REQUIRE_PERM_IMPORT = `import { requirePermission } from '@/lib/permissions.js';`;
const VERIFY_AUTH_IMPORT  = `import { verifyAuth } from '@/lib/auth-utils.js';`;

// ── PATCH HELPER ───────────────────────────────────────────────────────────

/**
 * Line-based patcher: finds the verifyAuth + if-block inside the named HTTP
 * method handler and replaces it with a requirePermission guard.
 *
 * Handles both patterns:
 *   A) if (!auth) { return ...; }
 *   B) if (!auth || (auth.role !== 'superadmin' ...)) { return ...; }
 *
 * Uses brace-counting to find the end of the if-block safely.
 * Returns new file content string, or null if nothing was changed.
 */
function patchMethod(content, method, permission) {
  const lines = content.split('\n');

  // Find function definition
  const funcStartIdx = lines.findIndex(l =>
    l.includes(`export async function ${method}(`) ||
    l.includes(`export async function ${method} (`)
  );
  if (funcStartIdx === -1) return null;

  // Skip if already patched (look ahead 40 lines)
  const lookAhead = Math.min(funcStartIdx + 40, lines.length);
  for (let i = funcStartIdx; i < lookAhead; i++) {
    if (lines[i].includes('requirePermission')) return null;
  }

  // Find verifyAuth call in next 60 lines
  let verifyAuthIdx = -1;
  for (let i = funcStartIdx + 1; i < Math.min(funcStartIdx + 60, lines.length); i++) {
    if (lines[i].includes('const auth = await verifyAuth(request)')) {
      verifyAuthIdx = i;
      break;
    }
  }
  if (verifyAuthIdx === -1) return null;

  // Find the if-statement on the next 1–3 lines
  let ifIdx = -1;
  for (let i = verifyAuthIdx + 1; i < Math.min(verifyAuthIdx + 4, lines.length); i++) {
    if (lines[i].trim().startsWith('if (')) {
      ifIdx = i;
      break;
    }
  }
  if (ifIdx === -1) return null;

  // Validate: the if must reference !auth
  if (!lines[ifIdx].includes('!auth')) return null;

  // Brace-count to find the closing } of the if block
  let depth = 0;
  let ifEndIdx = -1;
  for (let i = ifIdx; i < Math.min(ifIdx + 25, lines.length); i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { ifEndIdx = i; break; }
      }
    }
    if (ifEndIdx !== -1) break;
  }
  if (ifEndIdx === -1) return null;

  // Grab indentation from the verifyAuth line
  const indent = lines[verifyAuthIdx].match(/^(\s*)/)[1];

  const replacement = [
    `${indent}const perm = await requirePermission(request, '${permission}');`,
    `${indent}if (perm instanceof NextResponse) return perm;`,
    `${indent}const { auth } = perm;`,
  ];

  const newLines = [
    ...lines.slice(0, verifyAuthIdx),
    ...replacement,
    ...lines.slice(ifEndIdx + 1),
  ];

  return newLines.join('\n');
}

function patchAuthOnly(content, method) {
  const lines = content.split('\n');
  const funcStartIdx = lines.findIndex(l =>
    l.includes(`export async function ${method}(`) ||
    l.includes(`export async function ${method} (`)
  );
  if (funcStartIdx === -1) return null;

  // Already has verifyAuth: skip
  const lookAhead = Math.min(funcStartIdx + 40, lines.length);
  for (let i = funcStartIdx; i < lookAhead; i++) {
    if (lines[i].includes('verifyAuth') || lines[i].includes('requirePermission')) return null;
  }

  // Find the opening { of the function body
  let funcBodyIdx = -1;
  for (let i = funcStartIdx; i < Math.min(funcStartIdx + 5, lines.length); i++) {
    if (lines[i].includes('{')) { funcBodyIdx = i; break; }
  }
  if (funcBodyIdx === -1) return null;

  const indent = '    '; // standard 4-space indent inside function
  const authGuard = [
    `${indent}const auth = await verifyAuth(request);`,
    `${indent}if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });`,
  ];

  // Insert after the try { or function { opening line
  const insertAfter = lines[funcBodyIdx].trim() === '{' ? funcBodyIdx : funcBodyIdx;
  // Find "try {" line within a couple lines
  let insertIdx = funcBodyIdx + 1;
  for (let i = funcBodyIdx + 1; i < Math.min(funcBodyIdx + 4, lines.length); i++) {
    if (lines[i].trim() === 'try {') { insertIdx = i + 1; break; }
  }

  const newLines = [
    ...lines.slice(0, insertIdx),
    ...authGuard,
    ...lines.slice(insertIdx),
  ];
  return newLines.join('\n');
}

function ensureImport(content, importLine) {
  if (content.includes(importLine)) return content;
  // Add after the last import statement
  const lastImportIdx = content.lastIndexOf("import ");
  if (lastImportIdx === -1) return importLine + '\n' + content;
  const lineEnd = content.indexOf('\n', lastImportIdx);
  if (lineEnd === -1) return content + '\n' + importLine;
  return content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1);
}

// ── MAIN ───────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
let patched = 0;
let skipped = 0;
let errors = 0;

function processFile(relPath, methodPermMap) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    return;
  }

  let content = fs.readFileSync(absPath, 'utf8');
  let modified = false;

  if (methodPermMap === '__auth_only__') {
    // Just ensure each handler has verifyAuth
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      if (content.includes(`export async function ${method}(`)) {
        const result = patchAuthOnly(content, method);
        if (result) { content = result; modified = true; }
      }
    }
    if (modified) {
      content = ensureImport(content, VERIFY_AUTH_IMPORT);
      content = ensureImport(content, `import { NextResponse } from 'next/server';`);
    }
  } else {
    // Permission-based patching
    for (const [method, permission] of Object.entries(methodPermMap)) {
      if (!content.includes(`export async function ${method}(`)) continue;
      const result = patchMethod(content, method, permission);
      if (result) { content = result; modified = true; }
    }
    if (modified) {
      content = ensureImport(content, REQUIRE_PERM_IMPORT);
    }
  }

  if (modified) {
    fs.writeFileSync(absPath, content, 'utf8');
    console.log(`  PATCHED: ${relPath}`);
    patched++;
  } else {
    console.log(`  OK:      ${relPath}`);
    skipped++;
  }
}

console.log('\n=== Consty Route Permission Patcher ===\n');

// Process all permission-mapped routes
for (const [relPath, permMap] of Object.entries(PERMISSION_MAP)) {
  try {
    processFile(relPath, permMap);
  } catch (e) {
    console.error(`  ERROR: ${relPath}: ${e.message}`);
    errors++;
  }
}

// Process auth-only routes
for (const relPath of AUTH_ONLY) {
  try {
    processFile(relPath, '__auth_only__');
  } catch (e) {
    console.error(`  ERROR: ${relPath}: ${e.message}`);
    errors++;
  }
}

console.log(`\n=== Done: ${patched} patched, ${skipped} already OK, ${errors} errors ===\n`);
