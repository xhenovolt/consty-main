import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const r = await query(
    `SELECT p.*, b.name AS brandkit_name,
            (SELECT COUNT(*) FROM design_project_items pi WHERE pi.project_id = p.id) AS item_count
     FROM design_projects p
     LEFT JOIN design_brandkits b ON p.brandkit_id = b.id
     WHERE p.is_archived = FALSE
     ORDER BY p.updated_at DESC LIMIT 100`
  );
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'designs.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const body = await request.json().catch(() => ({}));
  const { name, description, brandkit_id } = body;
  if (!name) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });
  const r = await query(
    `INSERT INTO design_projects (name, description, brandkit_id, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, description || null, brandkit_id || null, auth.userId]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
