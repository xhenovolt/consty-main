import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/admin/identity/health — returns a fresh report (does not persist)
export async function GET(request) {
  const perm = await requirePermission(request, 'identity.view_health');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'audit.view');
    if (fb instanceof NextResponse) return fb;
  }
  return NextResponse.json({ success: true, report: await computeReport() });
}

// POST /api/admin/identity/health — generates and stores a report
export async function POST(request) {
  const perm = await requirePermission(request, 'identity.view_health');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'audit.view');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'audit.view')
    : perm).auth;

  const report = await computeReport();
  const passed = report.phantom_users === 0 && report.staff_no_user === 0 &&
                 report.dangling_refs === 0 && report.pointer_mismatches === 0;

  const r = await query(
    `INSERT INTO identity_health_reports
       (generated_by, total_users, total_staff,
        phantom_users, staff_no_user, pointer_mismatches, dangling_refs,
        orphan_sessions, details, passed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      auth.userId,
      report.total_users, report.total_staff,
      report.phantom_users, report.staff_no_user, report.pointer_mismatches,
      report.dangling_refs, report.orphan_sessions,
      JSON.stringify(report.details), passed,
    ]
  );
  return NextResponse.json({ success: true, report, persisted: r.rows[0], passed });
}

async function computeReport() {
  const [
    totalUsers, totalStaff,
    phantoms, staffNoUser, pointerMismatch, danglingUserRefs, danglingStaffRefs,
    orphanSessions, phantomList, staffNoUserList,
  ] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM users'),
    query('SELECT COUNT(*)::int AS n FROM staff'),
    query(`SELECT COUNT(*)::int AS n FROM v_identity_orphans WHERE issue = 'phantom_user'`),
    query(`SELECT COUNT(*)::int AS n FROM v_staff_orphans   WHERE issue = 'staff_without_user'`),
    query(`SELECT COUNT(*)::int AS n FROM v_staff_orphans   WHERE issue = 'pointer_mismatch'`),
    query(`SELECT COUNT(*)::int AS n FROM v_staff_orphans   WHERE issue = 'dangling_user_ref'`),
    query(`SELECT COUNT(*)::int AS n FROM v_identity_orphans WHERE issue = 'dangling_staff_ref'`),
    query(`SELECT COUNT(*)::int AS n FROM user_sessions s
           WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id)`).catch(() => ({ rows: [{ n: 0 }] })),
    query(`SELECT user_id, email, username, role, staff_id, created_at FROM v_identity_orphans WHERE issue = 'phantom_user' LIMIT 50`),
    query(`SELECT staff_id, name, email, user_id, linked_user_id FROM v_staff_orphans WHERE issue = 'staff_without_user' LIMIT 50`),
  ]);

  return {
    total_users:       totalUsers.rows[0].n,
    total_staff:       totalStaff.rows[0].n,
    phantom_users:     phantoms.rows[0].n,
    staff_no_user:     staffNoUser.rows[0].n,
    pointer_mismatches: pointerMismatch.rows[0].n,
    dangling_refs:     danglingUserRefs.rows[0].n + danglingStaffRefs.rows[0].n,
    orphan_sessions:   orphanSessions.rows[0].n,
    details: {
      phantom_users:   phantomList.rows,
      staff_without_user: staffNoUserList.rows,
    },
  };
}
