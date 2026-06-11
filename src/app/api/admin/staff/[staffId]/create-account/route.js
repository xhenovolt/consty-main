/**
 * POST /api/admin/staff/[staffId]/create-account
 *
 * Creates a linked user account for an existing staff member who has none yet.
 * Admin/superadmin sets a temporary password; the user must change it on first login.
 *
 * Body: { username, password (temporary), email? }
 * Returns: { success, user: { id, email, username } }
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, assertAuthorityOver } from '@/lib/permissions.js';
import { hashPassword } from '@/lib/auth.js';

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'staff.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  const { staffId } = await params;

  try {
    // --- 1. Load the staff record -------------------------------------------
    const staffResult = await query(
      `SELECT s.*, r.authority_level AS role_authority_level, r.id AS role_id_from_role
         FROM staff s
         LEFT JOIN roles r ON s.role_id = r.id
        WHERE s.id = $1`,
      [staffId]
    );
    if (staffResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }
    const staff = staffResult.rows[0];

    // --- 2. Check that the acting user has authority >= staff's role ---------
    const block = await assertAuthorityOver(auth, staff.role_authority_level ?? 0);
    if (block) return block;

    // --- 3. Check no user account is already linked --------------------------
    // Check both linked_user_id (canonical) and users.staff_id (bi-directional)
    if (staff.linked_user_id) {
      return NextResponse.json(
        { success: false, error: 'This staff member already has a linked user account.' },
        { status: 409 }
      );
    }

    // Belt-and-suspenders: check via users table
    const existingLink = await query(
      'SELECT id FROM users WHERE staff_id = $1',
      [staffId]
    );
    if (existingLink.rows.length > 0) {
      // Repair the link pointer and return the existing user
      await query(
        'UPDATE staff SET linked_user_id = $1, user_id = $1 WHERE id = $2',
        [existingLink.rows[0].id, staffId]
      );
      return NextResponse.json(
        { success: false, error: 'Staff already has a linked user account (link now repaired).' },
        { status: 409 }
      );
    }

    // --- 4. Parse and validate body -----------------------------------------
    const body = await request.json();
    const { username, password, email: bodyEmail } = body;

    const email = bodyEmail || staff.email;
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'email is required (set on staff or provide in body)' },
        { status: 400 }
      );
    }
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'username must be at least 3 characters' },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Temporary password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // --- 5. Uniqueness checks ------------------------------------------------
    const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A user account with this email already exists.' },
        { status: 409 }
      );
    }
    const usernameCheck = await query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if (usernameCheck.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken.' },
        { status: 409 }
      );
    }

    // --- 6. Determine the role to assign ------------------------------------
    // Use the staff's primary role_id; fall back to the first staff_role
    let roleId = staff.role_id;
    if (!roleId) {
      const staffRoleRes = await query(
        `SELECT sr.role_id FROM staff_roles sr WHERE sr.staff_id = $1 ORDER BY sr.assigned_at LIMIT 1`,
        [staffId]
      );
      roleId = staffRoleRes.rows[0]?.role_id ?? null;
    }

    // Derive authority_level from role
    let authorityLevel = 10;
    if (roleId) {
      const roleRes = await query('SELECT authority_level FROM roles WHERE id = $1', [roleId]);
      authorityLevel = roleRes.rows[0]?.authority_level ?? 10;
    }

    // --- 7. Create the user account -----------------------------------------
    const passwordHash = await hashPassword(password);

    // Determine the role name from roleId (fall back to 'user')
    let roleName = 'user';
    if (roleId) {
      const rn = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
      roleName = rn.rows[0]?.name ?? 'user';
    }

    const insertResult = await query(
      `INSERT INTO users
         (email, username, name, password_hash, role, staff_id,
          status, is_active, must_reset_password, first_login_completed, authority_level)
       VALUES ($1, $2, $3, $4, $5, $6,
               'active', true, true, false, $7)
       RETURNING id, email, username, name, authority_level`,
      [
        email.toLowerCase(),
        username.trim(),
        staff.name,
        passwordHash,
        roleName,
        staffId,
        authorityLevel,
      ]
    );
    const newUser = insertResult.rows[0];

    // --- 8. Link the user back to the staff record (both columns) -----------
    await query(
      'UPDATE staff SET linked_user_id = $1, user_id = $1 WHERE id = $2',
      [newUser.id, staffId]
    );

    // --- 9. Ensure staff_roles entry exists for the role --------------------
    if (roleId) {
      await query(
        `INSERT INTO staff_roles (staff_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (staff_id, role_id) DO NOTHING`,
        [staffId, roleId]
      );
    }

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error('[create-account] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create account' }, { status: 500 });
  }
}
