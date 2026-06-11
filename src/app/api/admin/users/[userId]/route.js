import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'users.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = await params;
    const result = await query(`SELECT id, email, name, role, status, is_active, last_login, created_at, updated_at FROM users WHERE id = $1`, [userId]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'users.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = await params;
    const body = await request.json();
    const fields = ['name','role','status','is_active'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    values.push(userId);
    const result = await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id, email, name, role, status, is_active`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'users.delete');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = await params;

    // Verify user exists and check staff linkage
    const userResult = await query(
      'SELECT id, email, name, role, staff_id FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Prevent deletion of superadmin users
    if (user.role === 'superadmin') {
      return NextResponse.json({ success: false, error: 'Cannot delete superadmin users' }, { status: 403 });
    }

    // Delete user (cascade will handle sessions and audit logs via database FK constraints)
    const deleteResult = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [userId]
    );

    if (!deleteResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${user.email} deleted successfully`,
      data: { id: deleteResult.rows[0].id, email: deleteResult.rows[0].email }
    });
  } catch (error) {
    console.error('[admin/users/[userId]] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
}
