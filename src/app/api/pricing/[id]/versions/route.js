import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/pricing/[id]/versions — full version history
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'pricing.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const versions = await query(
      `SELECT v.*, u.full_name AS created_by_name
       FROM pricing_plan_versions v
       LEFT JOIN users u ON v.created_by = u.id
       WHERE v.plan_id = $1
       ORDER BY v.version DESC`,
      [id]
    );
    const changes = await query(
      `SELECT c.*, u.full_name AS actor_name
       FROM pricing_plan_changes c
       LEFT JOIN users u ON c.actor_id = u.id
       WHERE c.plan_id = $1
       ORDER BY c.created_at DESC LIMIT 100`,
      [id]
    );
    return NextResponse.json({ success: true, versions: versions.rows, changes: changes.rows });
  } catch (e) {
    console.error('[Pricing] versions error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load version history' }, { status: 500 });
  }
}
