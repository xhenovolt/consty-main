import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/departments/:id — fetch department with all related data
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;

    const dept = await query(
      `SELECT d.*, COALESCE(d.name, d.department_name) AS display_name,
              p.name AS parent_name, COALESCE(hu.full_name, hu.name) AS head_name
       FROM departments d
       LEFT JOIN departments p ON d.parent_department_id = p.id
       LEFT JOIN users hu ON d.head_user_id = hu.id
       WHERE d.id = $1`,
      [id]
    );

    if (dept.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    // Fetch related data in parallel
    const [roles, policies, kpis, processes, documents, staff] = await Promise.all([
      query(
        `SELECT r.*, dr.is_lead
         FROM department_roles dr
         JOIN roles r ON dr.role_id = r.id
         WHERE dr.department_id = $1
         ORDER BY r.name ASC`,
        [id]
      ),
      query(
        `SELECT * FROM department_policies WHERE department_id = $1 ORDER BY created_at DESC`,
        [id]
      ),
      query(
        `SELECT * FROM department_kpis WHERE department_id = $1 ORDER BY created_at DESC`,
        [id]
      ),
      query(
        `SELECT * FROM department_processes WHERE department_id = $1 ORDER BY created_at DESC`,
        [id]
      ),
      query(
        `SELECT dd.*, m.file_url, m.file_name, m.file_type
         FROM department_documents dd
         LEFT JOIN media m ON dd.media_id = m.id
         WHERE dd.department_id = $1
         ORDER BY dd.created_at DESC`,
        [id]
      ),
      query(
        `SELECT s.id, s.name, s.position, s.role, s.status
         FROM staff s
         WHERE (s.department_id = $1 OR s.department = (SELECT COALESCE(name, department_name) FROM departments WHERE id = $1))
         ORDER BY s.name ASC`,
        [id]
      ),
    ]);

    const data = {
      ...dept.rows[0],
      roles: roles.rows,
      policies: policies.rows,
      kpis: kpis.rows,
      processes: processes.rows,
      documents: documents.rows,
      staff: staff.rows,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Departments] GET [id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch department' }, { status: 500 });
  }
}

// PUT /api/departments/:id — update department
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();
    const { name, description, alias, parent_department_id, head_user_id, color, icon, is_active } = body;

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ success: false, error: 'name cannot be empty' }, { status: 400 });
    }

    // Build dynamic update
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name.trim()); fields.push(`department_name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (alias !== undefined) { fields.push(`alias = $${idx++}`); values.push(alias); }
    if (parent_department_id !== undefined) { fields.push(`parent_department_id = $${idx++}`); values.push(parent_department_id || null); }
    if (head_user_id !== undefined) { fields.push(`head_user_id = $${idx++}`); values.push(head_user_id || null); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (icon !== undefined) { fields.push(`icon = $${idx++}`); values.push(icon); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE departments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'department', id, JSON.stringify({ name: result.rows[0].name })]);

    dispatch('department_updated', {
      entityType: 'department', entityId: id,
      description: `Department "${result.rows[0].name}" was updated`, actorId: auth.userId,
      metadata: { name: result.rows[0].name },
    });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return NextResponse.json({ success: false, error: 'Department name already exists' }, { status: 409 });
    console.error('[Departments] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update department' }, { status: 500 });
  }
}

// DELETE /api/departments/:id — soft-delete (deactivate) department
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;

    // Safety check: warn if department has active staff
    const staffCount = await query(
      `SELECT COUNT(*) FROM staff
       WHERE (department_id = $1 OR department = (SELECT COALESCE(name, department_name) FROM departments WHERE id = $1))
         AND status = 'active'`,
      [id]
    );
    const activeStaffCount = parseInt(staffCount.rows[0]?.count || '0');

    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    if (activeStaffCount > 0 && !forceDelete) {
      return NextResponse.json({
        success: false,
        error: `This department has ${activeStaffCount} active staff member${activeStaffCount !== 1 ? 's' : ''}. Pass ?force=true to confirm deletion.`,
        staff_count: activeStaffCount,
        requires_confirmation: true,
      }, { status: 409 });
    }

    const result = await query(
      `UPDATE departments
       SET is_active       = false,
           deactivated_at  = NOW(),
           deactivated_by  = $2,
           updated_at      = NOW()
       WHERE id = $1 RETURNING name`,
      [id, auth.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'DELETE', 'department', id, JSON.stringify({ name: result.rows[0].name })]);

    dispatch('department_deleted', {
      entityType: 'department', entityId: id,
      description: `Department "${result.rows[0].name}" was deactivated`, actorId: auth.userId,
      metadata: { name: result.rows[0].name },
    });

    return NextResponse.json({ success: true, message: 'Department deactivated' });
  } catch (error) {
    console.error('[Departments] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete department' }, { status: 500 });
  }
}
