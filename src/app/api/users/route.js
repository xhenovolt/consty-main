import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/users — full registry, with linkage status. RBAC: users.view OR staff.view.
export async function GET(request) {
  let perm = await requirePermission(request, 'users.view');
  if (perm instanceof NextResponse) {
    perm = await requirePermission(request, 'staff.view');
    if (perm instanceof NextResponse) return perm;
  }

  try {
    const { searchParams } = new URL(request.url);
    const onlyOrphans = searchParams.get('orphans') === 'true';

    let sql = `
      SELECT u.id, u.email, u.username, u.name, u.full_name,
             u.role, u.role_id, u.authority_level, u.status, u.is_active,
             u.staff_id, u.created_at, u.last_login, u.last_seen_at,
             r.name AS role_name,
             s.name AS staff_name,
             CASE
               WHEN u.role = 'superadmin'                                       THEN 'superadmin'
               WHEN u.role IN ('viewer','customer','system')                    THEN 'allowed'
               WHEN u.staff_id IS NULL                                          THEN 'phantom'
               WHEN s.id IS NULL                                                THEN 'dangling'
               ELSE 'linked'
             END AS link_status
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff s ON u.staff_id = s.id
      WHERE 1=1
    `;
    if (onlyOrphans) {
      sql += ` AND u.role NOT IN ('superadmin','viewer','customer','system')
               AND (u.staff_id IS NULL OR NOT EXISTS (SELECT 1 FROM staff s2 WHERE s2.id = u.staff_id))`;
    }
    sql += ' ORDER BY u.created_at DESC';
    const r = await query(sql);
    return NextResponse.json({ success: true, data: r.rows });
  } catch (e) {
    console.error('[Users] GET error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load users' }, { status: 500 });
  }
}

// PATCH /api/users — { id, action: 'archive'|'restore'|'disable' }
export async function PATCH(request) {
  const perm = await requirePermission(request, 'users.archive');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  const body = await request.json().catch(() => ({}));
  const { id, action, reason } = body;
  if (!id || !action)
    return NextResponse.json({ success: false, error: 'id and action required' }, { status: 400 });

  const map = {
    archive: { status: 'disabled', is_active: false },
    disable: { status: 'disabled', is_active: false },
    restore: { status: 'active',   is_active: true  },
    suspend: { status: 'suspended', is_active: false },
  };
  if (!map[action])
    return NextResponse.json({ success: false, error: 'invalid action' }, { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const before = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!before.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const r = await client.query(
      `UPDATE users SET status = $1, is_active = $2 WHERE id = $3 RETURNING *`,
      [map[action].status, map[action].is_active, id]
    );

    if (action !== 'restore') {
      try { await client.query('DELETE FROM user_sessions WHERE user_id = $1', [id]); } catch {}
    }

    await client.query(
      `INSERT INTO identity_audit_logs (action, user_id, actor_id, reason, before_state, after_state)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [`${action}_user`, id, auth.userId, reason || null,
       JSON.stringify(before.rows[0]), JSON.stringify(r.rows[0])]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Users] PATCH error:', e);
    return NextResponse.json({ success: false, error: 'Failed: ' + e.message }, { status: 500 });
  } finally { client.release(); }
}

// DELETE /api/users?id=...&force=true
//
// Hard-deletes a user. By default refuses if the user is linked to staff.
// `force=true` will detach the staff link first (audit-logged).
// Sessions are always revoked.
export async function DELETE(request) {
  const perm = await requirePermission(request, 'users.delete');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const force = searchParams.get('force') === 'true';
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const u = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!u.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const userSnap = u.rows[0];

    if (userSnap.role === 'superadmin' && !force) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Refusing to delete a superadmin without force=true' }, { status: 409 });
    }

    if (userSnap.staff_id && !force) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'User is linked to a staff member. Delete the staff member first, or pass force=true to detach.',
        staff_id: userSnap.staff_id,
      }, { status: 409 });
    }

    // Detach staff link if force
    if (userSnap.staff_id) {
      await client.query('UPDATE staff SET user_id = NULL, linked_user_id = NULL WHERE id = $1', [userSnap.staff_id]);
    }

    // Revoke sessions
    try { await client.query('DELETE FROM user_sessions WHERE user_id = $1', [id]); } catch {}

    await client.query(
      `INSERT INTO identity_audit_logs (action, user_id, actor_id, before_state, metadata)
       VALUES ('delete_user', $1, $2, $3, $4)`,
      [id, auth.userId, JSON.stringify(userSnap), JSON.stringify({ force })]
    );

    // We rely on FK ON DELETE SET NULL / CASCADE for the rest.
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Users] DELETE error:', e);
    return NextResponse.json({ success: false, error: 'Failed: ' + e.message }, { status: 500 });
  } finally { client.release(); }
}
