/**
 * GET /api/org/structure - Get full org tree or flat list
 * POST /api/org/structure - Create new org node
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission, hasPermission } from '@/lib/permissions.js';

function buildTree(nodes) {
  const map = {};
  const roots = [];
  for (const node of nodes) {
    map[node.id] = { ...node, children: [] };
  }
  for (const node of nodes) {
    if (node.reports_to_node_id && map[node.reports_to_node_id]) {
      map[node.reports_to_node_id].children.push(map[node.id]);
    } else {
      roots.push(map[node.id]);
    }
  }
  return roots;
}

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'tree';
    const status = searchParams.get('status'); // active, vacant, suspended, all

    let where = '';
    const params = [];
    if (status && status !== 'all') {
      where = 'WHERE os.status = $1';
      params.push(status);
    }

    const result = await query(
      `SELECT os.*,
              al.name AS authority_level_name, al.rank_value, al.color_indicator,
              COALESCE(d.name, d.department_name) AS department_name,
              r.name AS role_name, r.alias AS role_alias,
              u.name AS staff_name, u.email AS staff_email
       FROM organizational_structure os
       LEFT JOIN authority_levels al ON os.authority_level_id = al.id
       LEFT JOIN departments d ON os.department_id = d.id
       LEFT JOIN roles r ON os.role_id = r.id
       LEFT JOIN users u ON os.staff_assigned_id = u.id
       ${where}
       ORDER BY al.rank_value DESC NULLS LAST, os.hierarchy_depth ASC, os.node_name ASC`,
      params
    );

    if (format === 'flat') {
      return NextResponse.json({ success: true, data: result.rows });
    }

    const tree = buildTree(result.rows);
    return NextResponse.json({ success: true, data: result.rows, tree });
  } catch (error) {
    console.error('Failed to fetch org structure:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch org structure' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Any role granted org.manage can create org-structure nodes.
    // Superadmins bypass via the perm-cache.
    const perm = await requirePermission(request, 'org.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { node_name, department_id, role_id, authority_level_id, reports_to_node_id, staff_assigned_id, title_alias, status } = body;

    if (!node_name?.trim()) {
      return NextResponse.json({ success: false, error: 'node_name is required' }, { status: 400 });
    }

    // Compute hierarchy depth from parent
    let depth = 0;
    if (reports_to_node_id) {
      const parent = await query('SELECT hierarchy_depth FROM organizational_structure WHERE id = $1', [reports_to_node_id]);
      if (parent.rows[0]) depth = (parent.rows[0].hierarchy_depth || 0) + 1;
    }

    const nodeStatus = staff_assigned_id ? (status || 'active') : (status || 'vacant');

    const result = await query(
      `INSERT INTO organizational_structure
        (node_name, department_id, role_id, authority_level_id, reports_to_node_id, hierarchy_depth, staff_assigned_id, title_alias, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [node_name.trim(), department_id || null, role_id || null, authority_level_id || null,
       reports_to_node_id || null, depth, staff_assigned_id || null, title_alias || null, nodeStatus]
    );

    await query(
      `INSERT INTO org_change_logs (changed_by, change_type, entity_type, entity_id, new_structure, description)
       VALUES ($1, 'created', 'org_node', $2, $3, $4)`,
      [auth.userId, result.rows[0].id, JSON.stringify(result.rows[0]), `Org node "${node_name}" created`]
    );

    dispatch('org_node_created', {
      entityType: 'org_node', entityId: result.rows[0].id,
      description: `Org node "${node_name}" created`,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create org node:', error);
    return NextResponse.json({ success: false, error: 'Failed to create org node' }, { status: 500 });
  }
}
