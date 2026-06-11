/**
 * GET /api/admin/arch-issues — List all architectural system issues
 * PATCH /api/admin/arch-issues — Update issue status/fix_summary (superadmin only)
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;

    const result = await query(
      `SELECT 
        id, title, description, root_cause, affected_modules, severity,
        status, detected_at, fixed_at, fix_summary, related_logs,
        verified_by, category, reported_at, resolved_at
       FROM system_issues
       WHERE system_id = 'c987ff73-d468-4de5-9ccb-70cd0741e4b4'
         AND category IN ('auth', 'rbac', 'docs', 'audit', 'architecture', 'security')
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         detected_at DESC`,
      []
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[API/admin/arch-issues] GET failed:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load issues' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    if (!auth.is_superadmin) {
      return NextResponse.json({ success: false, error: 'Superadmin required' }, { status: 403 });
    }

    const { id, status, fix_summary } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const validStatuses = ['open', 'fixed', 'verified'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (status) {
      updates.push(`status = $${idx}`); params.push(status); idx++;
      if (status === 'fixed' || status === 'verified') {
        updates.push(`fixed_at = NOW()`);
        updates.push(`verified_by = 'system'`);
      }
    }
    if (fix_summary !== undefined) {
      updates.push(`fix_summary = $${idx}`); params.push(fix_summary); idx++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    params.push(id);
    await query(`UPDATE system_issues SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    return NextResponse.json({ success: true, message: 'Issue updated' });
  } catch (error) {
    console.error('[API/admin/arch-issues] PATCH failed:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to update issue' }, { status: 500 });
  }
}
