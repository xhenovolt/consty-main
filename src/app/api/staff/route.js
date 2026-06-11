import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';
import { hashPassword } from '@/lib/auth.js';
import { logError } from '@/lib/system-logs.js';

// GET /api/staff — staff.view
export async function GET(request) {
  const perm = await requirePermission(request, 'staff.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');

    let sql = `SELECT s.*, m.name as manager_name, a.name as salary_account_name,
                      r.name as role_name, r.hierarchy_level, r.alias as role_alias,
                      d.name as dept_name,
                      CASE
                        WHEN up.last_ping > NOW() - INTERVAL '60 seconds' THEN 'online'
                        WHEN up.last_ping > NOW() - INTERVAL '5 minutes' THEN 'away'
                        ELSE 'offline'
                      END AS presence_status,
                      up.last_ping AS last_seen_at,
                      (SELECT COALESCE(json_agg(json_build_object(
                        'id', sr_r.id, 'name', sr_r.name,
                        'authority_level', sr_r.authority_level,
                        'department_name', COALESCE(sr_d.name, sr_d.department_name)
                      )), '[]'::json)
                       FROM staff_roles sr2
                       JOIN roles sr_r ON sr2.role_id = sr_r.id
                       LEFT JOIN departments sr_d ON sr_r.department_id = sr_d.id
                       WHERE sr2.staff_id = s.id) AS assigned_roles
               FROM staff s
               LEFT JOIN staff m ON s.manager_id = m.id
               LEFT JOIN accounts a ON s.salary_account_id = a.id
               LEFT JOIN roles r ON s.role_id = r.id
               LEFT JOIN departments d ON s.department_id = d.id
               LEFT JOIN users u ON s.user_id = u.id OR (s.email IS NOT NULL AND s.email = u.email)
               LEFT JOIN user_presence up ON u.id = up.user_id
               WHERE 1=1`;
    const params = [];
    if (department) { params.push(department); sql += ` AND (s.department = $${params.length} OR d.name = $${params.length})`; }
    if (status) { params.push(status); sql += ` AND s.status = $${params.length}`; }
    sql += ` ORDER BY s.joined_at DESC NULLS LAST, s.created_at DESC`;
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Staff] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST /api/staff — ATOMIC: creates user + staff in ONE transaction.
// username, password, email, role_id, and department_id are ALL required.
export async function POST(request) {
  const perm = await requirePermission(request, 'staff.create');
  if (perm instanceof NextResponse) return perm;
  const auth = perm.auth;

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 }); }

  const {
    name, email, phone, department, department_id,
    role_id, status = 'active', joined_at, notes, position,
    salary, salary_currency = 'UGX', salary_account_id,
    manager_id, hire_date, photo_url,
    username, password,
    // Legacy nested wrapper still accepted
    account,
  } = body;

  const resolvedUsername = (username || account?.username || '').trim();
  const resolvedPassword = password || account?.password || '';

  // ── Validation ─────────────────────────────────────────────────────────────
  const errors = [];
  if (!name?.trim())                           errors.push('Full name is required');
  if (!email?.trim())                          errors.push('Email is required');
  if (!resolvedUsername)                       errors.push('Username is required');
  else if (resolvedUsername.length < 3)        errors.push('Username must be at least 3 characters');
  if (!resolvedPassword)                       errors.push('Temporary password is required');
  else if (resolvedPassword.length < 8)        errors.push('Password must be at least 8 characters');
  if (!role_id)                                errors.push('Role is required');
  if (!department_id)                          errors.push('Department is required');

  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors.join('; ') }, { status: 400 });
  }

  const cleanEmail    = email.trim().toLowerCase();
  const cleanUsername = resolvedUsername.toLowerCase();

  // ── Pre-flight DB checks (before opening transaction) ─────────────────────
  const [emailCheck, usernameCheck, roleCheck, deptCheck] = await Promise.all([
    query('SELECT id FROM users WHERE email = $1', [cleanEmail]),
    query('SELECT id FROM users WHERE username = $1', [cleanUsername]),
    query('SELECT id, name, authority_level FROM roles WHERE id = $1', [role_id]),
    query('SELECT id, name FROM departments WHERE id = $1', [department_id]),
  ]);

  if (emailCheck.rows.length > 0)
    return NextResponse.json({ success: false, error: 'A user account with this email already exists.' }, { status: 409 });
  if (usernameCheck.rows.length > 0)
    return NextResponse.json({ success: false, error: 'Username is already taken.' }, { status: 409 });
  if (roleCheck.rows.length === 0)
    return NextResponse.json({ success: false, error: 'Selected role not found.' }, { status: 400 });
  if (deptCheck.rows.length === 0)
    return NextResponse.json({ success: false, error: 'Selected department not found.' }, { status: 400 });

  const role = roleCheck.rows[0];
  const dept = deptCheck.rows[0];

  // Hash password before the transaction (CPU work)
  const passwordHash = await hashPassword(resolvedPassword);

  // ── Atomic transaction ─────────────────────────────────────────────────────
  const client = await getPool().connect();
  let newUser  = null;
  let newStaff = null;

  try {
    await client.query('BEGIN');

    // Step 1: Create user account.
    //
    // CRITICAL: `users.role` is a coarse class enum
    // ('superadmin','admin','staff','user','viewer','customer','system') —
    // it is NOT the role name. Writing the dynamic role name here used to
    // violate users_role_check and roll back the entire transaction.
    // The actual role lives in role_id; we write 'staff' here.
    const userClass = role.authority_level && role.authority_level <= 10 ? 'admin' : 'staff';
    const userResult = await client.query(
      `INSERT INTO users
         (email, username, name, password_hash, role, role_id,
          status, is_active, must_reset_password, first_login_completed, authority_level)
       VALUES ($1,$2,$3,$4,$5,$6,'active',true,true,false,$7)
       RETURNING id, email, username, name, role, authority_level`,
      [cleanEmail, cleanUsername, name.trim(), passwordHash,
       userClass, role_id, role.authority_level ?? 10]
    );
    newUser = userResult.rows[0];

    // Step 2: Create staff record linked to user
    const staffResult = await client.query(
      `INSERT INTO staff
         (name, role, role_id, status, joined_at, notes, email, phone,
          department, department_id, position, salary, salary_currency,
          salary_account_id, manager_id, hire_date, photo_url,
          user_id, linked_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
       RETURNING *`,
      [
        name.trim(), role.name, role_id, status,
        joined_at || null, notes || null,
        cleanEmail, phone || null,
        dept.name, department_id,
        position || null,
        salary ? parseFloat(salary) : null, salary_currency,
        salary_account_id || null, manager_id || null,
        hire_date || null, photo_url || null,
        newUser.id,
      ]
    );
    newStaff = staffResult.rows[0];

    // Step 3: Back-link user → staff
    await client.query('UPDATE users SET staff_id = $1 WHERE id = $2', [newStaff.id, newUser.id]);

    // Step 4: staff_roles junction entry
    await client.query(
      `INSERT INTO staff_roles (staff_id, role_id) VALUES ($1,$2) ON CONFLICT (staff_id, role_id) DO NOTHING`,
      [newStaff.id, role_id]
    );

    await client.query('COMMIT');
  } catch (txError) {
    await client.query('ROLLBACK');
    client.release();
    await logError('staff', 'create',
      'Atomic staff+user creation failed (transaction rolled back)',
      { error: txError.message, name, email: cleanEmail },
      auth.userId
    );
    console.error('[Staff] POST transaction error:', txError);
    if (txError.code === '23505') {
      const detail = txError.detail || '';
      if (detail.includes('username')) return NextResponse.json({ success: false, error: 'Username is already taken.' }, { status: 409 });
      if (detail.includes('email'))    return NextResponse.json({ success: false, error: 'Email is already in use.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create staff member. Transaction rolled back.' }, { status: 500 });
  }

  client.release();

  // ── Audit trail (non-fatal, outside transaction) ────────────────────────────
  try {
    await Promise.all([
      query(
        `INSERT INTO staff_actions (staff_id, action_type, new_role_id, new_role_name, new_authority_level, performed_by)
         VALUES ($1,'hire',$2,$3,$4,$5)`,
        [newStaff.id, role_id, role.name, role.authority_level ?? 10, auth.userId]
      ),
      query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,'CREATE','staff',$2,$3)`,
        [auth.userId, newStaff.id,
         JSON.stringify({ name: name.trim(), department: dept.name, position: position || null, accountCreated: true })]
      ),
    ]);
    dispatch('staff_created', {
      entityType: 'staff', entityId: newStaff.id,
      description: `Staff member "${name.trim()}" was added with user account`,
      actorId: auth.userId,
      metadata: { name: name.trim(), department: dept.name, position: position || null },
    });
  } catch { /* audit failures are non-fatal */ }

  return NextResponse.json(
    {
      success: true,
      data: newStaff,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        mustResetPassword: true,
      },
    },
    { status: 201 }
  );
}

// PATCH /api/staff — staff.update
export async function PATCH(request) {
  const perm = await requirePermission(request, 'staff.update');
  if (perm instanceof NextResponse) return perm;
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    const allowed = ['name','role','role_id','status','joined_at','notes','email','phone','department','department_id','position','salary','salary_currency','salary_account_id','manager_id','hire_date','photo_url','is_active','account_status','user_id'];
    const updates = [];
    const values = [];
    allowed.forEach(f => {
      if (fields[f] !== undefined) { values.push(fields[f]); updates.push(`${f} = $${values.length}`); }
    });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    updates.push('updated_at = NOW()');
    values.push(id);
    const result = await query(`UPDATE staff SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });

    // Sync role to the linked user account when role_id changes
    if (fields.role_id && result.rows[0].user_id) {
      try {
        const roleRes = await query('SELECT name, authority_level FROM roles WHERE id = $1', [fields.role_id]);
        if (roleRes.rows[0]) {
          await query(
            'UPDATE users SET role = $1, role_id = $2, authority_level = $3 WHERE id = $4',
            [roleRes.rows[0].name, fields.role_id, roleRes.rows[0].authority_level ?? 10, result.rows[0].user_id]
          );
        }
      } catch (syncErr) {
        console.warn('[Staff] role sync to user failed:', syncErr.message);
      }
    }

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'staff', id, JSON.stringify(fields)]);
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Staff] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update staff member' }, { status: 500 });
  }
}

// DELETE /api/staff?id=...&cascade_user=true|false
//
// When cascade_user is true (default), the linked user account is also
// disabled (status=disabled, is_active=false), all sessions are revoked,
// and an identity_audit_logs row is written. The user row is NOT hard-deleted
// to preserve audit trails — use /api/users DELETE for that.
export async function DELETE(request) {
  const perm = await requirePermission(request, 'staff.delete');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const cascadeUser = searchParams.get('cascade_user') !== 'false';
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const reports = await query(`SELECT COUNT(*)::int AS n FROM staff WHERE manager_id = $1`, [id]);
  if (reports.rows[0].n > 0) {
    return NextResponse.json({ success: false, error: 'Cannot delete: other staff members report to this person' }, { status: 409 });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const staffRow = await client.query('SELECT * FROM staff WHERE id = $1', [id]);
    if (!staffRow.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });
    }
    const staffSnapshot = staffRow.rows[0];
    const linkedUserId = staffSnapshot.user_id || staffSnapshot.linked_user_id || null;

    let userSnapshot = null;
    if (cascadeUser && linkedUserId) {
      const u = await client.query('SELECT * FROM users WHERE id = $1', [linkedUserId]);
      userSnapshot = u.rows[0] || null;
      if (userSnapshot) {
        await client.query(
          `UPDATE users SET status = 'disabled', is_active = FALSE, staff_id = NULL WHERE id = $1`,
          [linkedUserId]
        );
        // Revoke sessions
        try { await client.query('DELETE FROM user_sessions WHERE user_id = $1', [linkedUserId]); } catch {}
      }
    }

    await client.query('DELETE FROM staff WHERE id = $1', [id]);

    await client.query(
      `INSERT INTO identity_audit_logs (action, user_id, staff_id, actor_id, before_state, metadata)
       VALUES ('delete_staff', $1, $2, $3, $4, $5)`,
      [
        linkedUserId, id, auth.userId,
        JSON.stringify({ staff: staffSnapshot, user: userSnapshot }),
        JSON.stringify({ cascade_user: cascadeUser }),
      ]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, cascaded_user: cascadeUser && !!linkedUserId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Staff] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete staff: ' + error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
