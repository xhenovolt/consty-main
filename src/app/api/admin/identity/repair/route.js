import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// POST /api/admin/identity/repair
//
// Body: { action, ...params }
//
//   action='link_phantom_user_to_staff' { user_id, staff_id }
//     — sets users.staff_id and staff.user_id together (transactional).
//
//   action='delete_phantom_user' { user_id }
//     — hard-deletes a user that has no staff link. Refuses if user has
//       a staff_id (use /api/users DELETE with force=true instead).
//
//   action='clear_pointer_mismatch' { staff_id }
//     — sets staff.linked_user_id = staff.user_id.
//
//   action='clear_orphan_sessions'
//     — deletes user_sessions rows pointing at non-existent users.
//
//   action='detach_dangling_staff_ref' { user_id }
//     — clears users.staff_id when the staff row no longer exists.
export async function POST(request) {
  const perm = await requirePermission(request, 'identity.repair');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  const body = await request.json().catch(() => ({}));
  const { action } = body;
  if (!action)
    return NextResponse.json({ success: false, error: 'action required' }, { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    let result;

    switch (action) {
      case 'link_phantom_user_to_staff': {
        const { user_id, staff_id } = body;
        if (!user_id || !staff_id) throw new Error('user_id and staff_id required');
        const u = await client.query('SELECT * FROM users WHERE id = $1', [user_id]);
        const s = await client.query('SELECT * FROM staff WHERE id = $1', [staff_id]);
        if (!u.rows.length) throw new Error('User not found');
        if (!s.rows.length) throw new Error('Staff not found');

        // Make sure neither side is already taken
        const otherUser = await client.query('SELECT id FROM users WHERE staff_id = $1 AND id <> $2', [staff_id, user_id]);
        if (otherUser.rows.length) throw new Error('Another user is already linked to this staff');
        const otherStaff = await client.query('SELECT id FROM staff WHERE user_id = $1 AND id <> $2', [user_id, staff_id]);
        if (otherStaff.rows.length) throw new Error('Another staff is already linked to this user');

        await client.query('UPDATE staff SET user_id = $1, linked_user_id = $1 WHERE id = $2', [user_id, staff_id]);
        await client.query('UPDATE users SET staff_id = $1, role = CASE WHEN role IN (\'superadmin\',\'admin\',\'staff\') THEN role ELSE \'staff\' END WHERE id = $2', [staff_id, user_id]);
        result = { user_id, staff_id, linked: true };
        break;
      }

      case 'delete_phantom_user': {
        const { user_id } = body;
        if (!user_id) throw new Error('user_id required');
        const u = await client.query('SELECT * FROM users WHERE id = $1', [user_id]);
        if (!u.rows.length) throw new Error('User not found');
        if (u.rows[0].staff_id) throw new Error('Not a phantom — has staff_id; use /api/users DELETE with force=true');
        if (u.rows[0].role === 'superadmin') throw new Error('Refusing to delete superadmin');

        await client.query('DELETE FROM user_sessions WHERE user_id = $1', [user_id]).catch(() => {});
        await client.query(
          `INSERT INTO identity_audit_logs (action, user_id, actor_id, before_state)
           VALUES ('delete_phantom_user', $1, $2, $3)`,
          [user_id, auth.userId, JSON.stringify(u.rows[0])]
        );
        await client.query('DELETE FROM users WHERE id = $1', [user_id]);
        result = { user_id, deleted: true };
        break;
      }

      case 'clear_pointer_mismatch': {
        const { staff_id } = body;
        if (!staff_id) throw new Error('staff_id required');
        await client.query('UPDATE staff SET linked_user_id = user_id WHERE id = $1', [staff_id]);
        result = { staff_id, cleared: true };
        break;
      }

      case 'clear_orphan_sessions': {
        const r = await client.query(
          `DELETE FROM user_sessions WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = user_id)`
        ).catch(() => ({ rowCount: 0 }));
        result = { orphan_sessions_cleared: r.rowCount };
        break;
      }

      case 'detach_dangling_staff_ref': {
        const { user_id } = body;
        if (!user_id) throw new Error('user_id required');
        await client.query('UPDATE users SET staff_id = NULL WHERE id = $1', [user_id]);
        result = { user_id, detached: true };
        break;
      }

      default:
        throw new Error('Unknown action: ' + action);
    }

    if (action !== 'delete_phantom_user') {
      await client.query(
        `INSERT INTO identity_audit_logs (action, actor_id, metadata)
         VALUES ($1, $2, $3)`,
        [`repair_${action}`, auth.userId, JSON.stringify(body)]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, result });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Identity Repair] error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  } finally { client.release(); }
}
