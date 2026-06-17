import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { projectVisibilityFilter } from '@/lib/project-access.js';

// GET /api/activity/feed — a real project activity feed, synthesised from recent
// events across the project domain (no dependence on legacy activity_logs).
// Scoped to the projects the caller can see.
export async function GET(request) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') || '60'), 200);

  try {
    const vis = projectVisibilityFilter(auth);
    const sql = `
      WITH vp AS (SELECT id, name FROM projects p WHERE 1=1 ${vis.clause})
      SELECT x.*, u.name AS actor_name FROM (
        SELECT p.created_at AS ts, p.created_by AS actor, 'created' AS action, 'project' AS entity_type,
               'Project created: ' || p.name AS description, p.id AS project_id, p.name AS project_name
          FROM projects p JOIN vp ON vp.id = p.id
        UNION ALL
        SELECT wi.updated_at, wi.created_by, wi.status, 'work_item',
               initcap(replace(wi.type,'_',' ')) || ': ' || wi.name || ' — ' || replace(wi.status,'_',' '), wi.project_id, vp.name
          FROM work_items wi JOIN vp ON vp.id = wi.project_id
        UNION ALL
        SELECT pr.updated_at, pr.requested_by, pr.status, 'procurement',
               'Procurement "' || pr.title || '" — ' || replace(pr.status,'_',' '), pr.project_id, vp.name
          FROM procurement_requests pr JOIN vp ON vp.id = pr.project_id
        UNION ALL
        SELECT g.received_at, g.received_by, 'received', 'goods_receipt',
               'Goods received' || COALESCE(' (DN ' || g.delivery_note_number || ')',''), g.project_id, vp.name
          FROM goods_receipts g JOIN vp ON vp.id = g.project_id
        UNION ALL
        SELECT e.created_at, e.created_by, 'expense', 'expense',
               'Expense — ' || e.category || ' ' || e.amount::text, e.project_id, vp.name
          FROM expenses e JOIN vp ON vp.id = e.project_id
        UNION ALL
        SELECT b.detected_at, b.created_by, b.status, 'blocker',
               'Blocker: ' || replace(b.blocker_type,'_',' ') || ' (' || b.severity || ')', b.project_id, vp.name
          FROM blockers b JOIN vp ON vp.id = b.project_id
        UNION ALL
        SELECT co.updated_at, co.requested_by, co.status, 'change_order',
               'Change order "' || co.title || '" — ' || co.status, co.project_id, vp.name
          FROM change_orders co JOIN vp ON vp.id = co.project_id
      ) x
      LEFT JOIN users u ON u.id = x.actor
      ORDER BY x.ts DESC NULLS LAST
      LIMIT $${vis.params.length + 1}`;
    const result = await query(sql, [...vis.params, limit]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Activity/feed] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load activity' }, { status: 500 });
  }
}
