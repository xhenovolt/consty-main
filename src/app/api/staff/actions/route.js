import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * POST /api/staff/actions — Promote, Demote, Terminate, Reactivate staff
 * Body: { staff_id, action_type: 'promotion'|'demotion'|'termination'|'reactivation', new_role_id?, reason? }
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'staff.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { staff_id, action_type, new_role_id, reason } = await request.json();
    if (!staff_id || !action_type) {
      return NextResponse.json({ success: false, error: 'staff_id and action_type are required' }, { status: 400 });
    }

    const validActions = ['promotion', 'demotion', 'termination', 'reactivation', 'role_change'];
    if (!validActions.includes(action_type)) {
      return NextResponse.json({ success: false, error: `Invalid action_type. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    // Get current staff data
    const staff = await query(
      `SELECT s.*, r.name as current_role_name, r.hierarchy_level as current_level
       FROM staff s LEFT JOIN roles r ON s.role_id = r.id WHERE s.id = $1`, [staff_id]
    );
    if (!staff.rows[0]) return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });
    const current = staff.rows[0];

    // Get new role info if a role change
    let newRole = null;
    if (new_role_id && ['promotion', 'demotion', 'role_change'].includes(action_type)) {
      const roleRes = await query(`SELECT id, name, hierarchy_level FROM roles WHERE id = $1`, [new_role_id]);
      if (!roleRes.rows[0]) return NextResponse.json({ success: false, error: 'New role not found' }, { status: 404 });
      newRole = roleRes.rows[0];

      // Validate promotion = lower hierarchy number (higher authority), demotion = higher number
      if (action_type === 'promotion' && current.current_level && newRole.hierarchy_level >= current.current_level) {
        return NextResponse.json({ success: false, error: 'Promotion must be to a higher authority level (lower number)' }, { status: 400 });
      }
      if (action_type === 'demotion' && current.current_level && newRole.hierarchy_level <= current.current_level) {
        return NextResponse.json({ success: false, error: 'Demotion must be to a lower authority level (higher number)' }, { status: 400 });
      }
    }

    // Execute action
    switch (action_type) {
      case 'promotion':
      case 'demotion':
      case 'role_change':
        if (!new_role_id) return NextResponse.json({ success: false, error: 'new_role_id is required for role changes' }, { status: 400 });
        await query(`UPDATE staff SET role_id = $1, role = $2, updated_at = NOW() WHERE id = $3`,
          [new_role_id, newRole.name, staff_id]);
        break;

      case 'termination':
        await query(`UPDATE staff SET is_active = false, status = 'inactive', deactivated_at = NOW(), deactivation_reason = $1, updated_at = NOW() WHERE id = $2`,
          [reason || 'Terminated', staff_id]);
        break;

      case 'reactivation':
        await query(`UPDATE staff SET is_active = true, status = 'active', deactivated_at = NULL, deactivation_reason = NULL, updated_at = NOW() WHERE id = $1`,
          [staff_id]);
        break;
    }

    // Log the action
    await query(
      `INSERT INTO staff_actions (staff_id, action_type, previous_role_id, new_role_id, previous_role_name, new_role_name, previous_authority_level, new_authority_level, reason, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [staff_id, action_type, current.role_id || null, new_role_id || null,
       current.current_role_name || current.role || null, newRole?.name || null,
       current.current_level || null, newRole?.hierarchy_level || null,
       reason || null, auth.userId]
    );

    // Audit log
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, action_type.toUpperCase(), 'staff', staff_id, JSON.stringify({
        staff_name: current.name,
        action: action_type,
        previous_role: current.current_role_name || current.role,
        new_role: newRole?.name,
        reason,
      })]);

    // Dispatch system event
    const eventMap = {
      promotion: 'staff_promoted',
      demotion: 'staff_demoted',
      termination: 'staff_terminated',
      reactivation: 'staff_reactivated',
      role_change: 'staff_role_changed',
    };
    dispatch(eventMap[action_type] || 'staff_updated', {
      entityType: 'staff', entityId: staff_id,
      description: `${current.name} was ${action_type === 'termination' ? 'terminated' : action_type === 'reactivation' ? 'reactivated' : `${action_type}: ${current.current_role_name || current.role || 'N/A'} → ${newRole?.name || 'N/A'}`}`,
      actorId: auth.userId,
      metadata: { staff_name: current.name, action_type, new_role: newRole?.name, reason },
    });

    return NextResponse.json({
      success: true,
      message: `Staff ${action_type} completed`,
      data: { staff_id, action_type, previous_role: current.current_role_name, new_role: newRole?.name },
    });
  } catch (error) {
    console.error('[Staff Actions] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to perform staff action' }, { status: 500 });
  }
}

/**
 * GET /api/staff/actions?staff_id=xxx — Get action history for a staff member
 */
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const staff_id = searchParams.get('staff_id');

    let sql = `SELECT sa.*, u.name as performed_by_name
               FROM staff_actions sa
               LEFT JOIN users u ON sa.performed_by = u.id`;
    const params = [];
    if (staff_id) { params.push(staff_id); sql += ` WHERE sa.staff_id = $${params.length}`; }
    sql += ` ORDER BY sa.created_at DESC LIMIT 100`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch staff actions' }, { status: 500 });
  }
}
