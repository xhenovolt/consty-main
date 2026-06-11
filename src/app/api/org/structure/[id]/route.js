/**
 * GET /api/org/structure/[id] - Get single org node
 * PUT /api/org/structure/[id] - Update org node
 * DELETE /api/org/structure/[id] - Delete org node (archive)
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(
      `SELECT os.*,
              al.name AS authority_level_name, al.rank_value, al.color_indicator,
              COALESCE(d.name, d.department_name) AS department_name,
              r.name AS role_name,
              u.name AS staff_name, u.email AS staff_email
       FROM organizational_structure os
       LEFT JOIN authority_levels al ON os.authority_level_id = al.id
       LEFT JOIN departments d ON os.department_id = d.id
       LEFT JOIN roles r ON os.role_id = r.id
       LEFT JOIN users u ON os.staff_assigned_id = u.id
       WHERE os.id = $1`,
      [id]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });

    // Also get direct children
    const children = await query(
      `SELECT os.id, os.node_name, os.status, os.title_alias,
              al.name AS authority_level_name, al.color_indicator,
              u.name AS staff_name
       FROM organizational_structure os
       LEFT JOIN authority_levels al ON os.authority_level_id = al.id
       LEFT JOIN users u ON os.staff_assigned_id = u.id
       WHERE os.reports_to_node_id = $1
       ORDER BY al.rank_value DESC NULLS LAST`,
      [id]
    );

    return NextResponse.json({ success: true, data: { ...result.rows[0], children: children.rows } });
  } catch (error) {
    console.error('Failed to fetch org node:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch org node' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const old = await query('SELECT * FROM organizational_structure WHERE id = $1', [id]);
    if (!old.rows[0]) return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });

    const body = await request.json();
    const { node_name, department_id, role_id, authority_level_id, reports_to_node_id, staff_assigned_id, title_alias, status } = body;

    // Prevent circular reference
    if (reports_to_node_id === id) {
      return NextResponse.json({ success: false, error: 'A node cannot report to itself' }, { status: 400 });
    }

    // Recompute hierarchy depth if parent changed
    let depth = old.rows[0].hierarchy_depth;
    if (reports_to_node_id !== undefined && reports_to_node_id !== old.rows[0].reports_to_node_id) {
      if (reports_to_node_id) {
        const parent = await query('SELECT hierarchy_depth FROM organizational_structure WHERE id = $1', [reports_to_node_id]);
        depth = parent.rows[0] ? (parent.rows[0].hierarchy_depth || 0) + 1 : 0;
      } else {
        depth = 0;
      }
    }

    const result = await query(
      `UPDATE organizational_structure SET
        node_name = COALESCE($1, node_name),
        department_id = $2,
        role_id = $3,
        authority_level_id = $4,
        reports_to_node_id = $5,
        hierarchy_depth = $6,
        staff_assigned_id = $7,
        title_alias = $8,
        status = COALESCE($9, status),
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        node_name || null,
        department_id !== undefined ? (department_id || null) : old.rows[0].department_id,
        role_id !== undefined ? (role_id || null) : old.rows[0].role_id,
        authority_level_id !== undefined ? (authority_level_id || null) : old.rows[0].authority_level_id,
        reports_to_node_id !== undefined ? (reports_to_node_id || null) : old.rows[0].reports_to_node_id,
        depth,
        staff_assigned_id !== undefined ? (staff_assigned_id || null) : old.rows[0].staff_assigned_id,
        title_alias !== undefined ? (title_alias || null) : old.rows[0].title_alias,
        status || null,
        id,
      ]
    );

    await query(
      `INSERT INTO org_change_logs (changed_by, change_type, entity_type, entity_id, old_structure, new_structure, description)
       VALUES ($1, 'updated', 'org_node', $2, $3, $4, $5)`,
      [auth.userId, id, JSON.stringify(old.rows[0]), JSON.stringify(result.rows[0]), `Org node "${result.rows[0].node_name}" updated`]
    );

    dispatch('org_node_updated', {
      entityType: 'org_node', entityId: id,
      description: `Org node "${result.rows[0].node_name}" updated`,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Failed to update org node:', error);
    return NextResponse.json({ success: false, error: 'Failed to update org node' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const old = await query('SELECT * FROM organizational_structure WHERE id = $1', [id]);
    if (!old.rows[0]) return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });

    // Check for children — prevent orphans
    const children = await query('SELECT COUNT(*) AS cnt FROM organizational_structure WHERE reports_to_node_id = $1 AND status != $2', [id, 'archived']);
    if (parseInt(children.rows[0].cnt) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete node with active children. Reassign or archive children first.' }, { status: 400 });
    }

    // Archive instead of hard-delete
    await query("UPDATE organizational_structure SET status = 'archived', updated_at = NOW() WHERE id = $1", [id]);

    await query(
      `INSERT INTO org_change_logs (changed_by, change_type, entity_type, entity_id, old_structure, description)
       VALUES ($1, 'archived', 'org_node', $2, $3, $4)`,
      [auth.userId, id, JSON.stringify(old.rows[0]), `Org node "${old.rows[0].node_name}" archived`]
    );

    dispatch('org_node_deleted', {
      entityType: 'org_node', entityId: id,
      description: `Org node "${old.rows[0].node_name}" archived`,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: 'Node archived' });
  } catch (error) {
    console.error('Failed to delete org node:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete org node' }, { status: 500 });
  }
}
