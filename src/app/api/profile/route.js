import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';

// Sensitive identity fields require an approval workflow rather than
// direct mutation. Editing these from the profile page creates an
// approval_requests row that a manager must approve before the change
// is applied. Free-edit fields are cosmetic / preference only.
const FREE_EDIT_FIELDS      = ['profile_image_url', 'avatar_id', 'cover_image_url', 'bio', 'timezone'];
const APPROVAL_NEEDED_FIELDS = ['full_name', 'phone'];

/**
 * GET /api/profile — Fetch current user's full profile
 */
export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    const result = await query(
      `SELECT 
        u.id, u.email, u.full_name, u.role, u.status,
        u.profile_image_url, u.avatar_id, u.cover_image_url,
        u.department, u.hierarchy_level, u.bio, u.phone, u.timezone,
        u.last_active_device, u.created_at, u.updated_at, u.last_login,
        s.full_name as staff_name, s.id as staff_id
      FROM users u
      LEFT JOIN staff s ON s.user_id = u.id
      WHERE u.id = $1`,
      [user.id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = result.rows[0];

    // Fetch permissions summary
    const permsResult = await query(
      `SELECT p.name, p.description 
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = $1
       ORDER BY p.name`,
      [profile.role]
    );

    // Fetch recent activity
    const activityResult = await query(
      `SELECT action, entity_type, entity_id, details, created_at
       FROM user_activity_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.id]
    );

    // Fetch devices
    const devicesResult = await query(
      `SELECT id, device_name, browser, os, ip_address, last_active_at, is_current
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_active_at DESC
       LIMIT 10`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        permissions: permsResult.rows,
        activity: activityResult.rows,
        devices: devicesResult.rows,
      },
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Profile fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/profile — Update current user's profile
 */
export async function PATCH(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = await request.json();

    // Split incoming edits into free vs. needs-approval.
    const freeChanges    = {};
    const pendingChanges = {};
    for (const k of Object.keys(body)) {
      if (FREE_EDIT_FIELDS.includes(k))       freeChanges[k]    = body[k];
      else if (APPROVAL_NEEDED_FIELDS.includes(k)) pendingChanges[k] = body[k];
    }

    if (Object.keys(freeChanges).length === 0 && Object.keys(pendingChanges).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    let updated = null;

    // Apply the free changes immediately.
    if (Object.keys(freeChanges).length > 0) {
      const sets = [];
      const values = [];
      let i = 1;
      for (const f of Object.keys(freeChanges)) {
        sets.push(`${f} = $${i++}`);
        values.push(freeChanges[f]);
      }
      sets.push('updated_at = NOW()');
      values.push(user.id);
      const r = await query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING
           id, email, full_name, role, status, profile_image_url, avatar_id,
           cover_image_url, department, bio, phone, timezone, updated_at`,
        values
      );
      updated = r.rows[0];

      await query(
        `INSERT INTO user_activity_log (user_id, action, entity_type, details)
         VALUES ($1, 'profile_updated', 'user', $2)`,
        [user.id, JSON.stringify({ fields: Object.keys(freeChanges) })]
      ).catch(() => {});
    }

    // For sensitive changes, create an approval request rather than mutating.
    let approval = null;
    if (Object.keys(pendingChanges).length > 0) {
      const r = await query(
        `INSERT INTO approval_requests
           (requester_user_id, target_record_type, target_record_id,
            action_requested, reason, required_permission,
            replay_path, replay_method, payload)
         VALUES ($1,'user',$1,$2,$3,'profile.edit_sensitive','/api/profile','PATCH',$4)
         RETURNING *`,
        [
          user.id,
          'Edit sensitive profile fields',
          'Self-service profile edit requiring approval',
          JSON.stringify(pendingChanges),
        ]
      );
      approval = r.rows[0];

      await query(
        `INSERT INTO user_activity_log (user_id, action, entity_type, entity_id, details)
         VALUES ($1, 'profile_edit_requested', 'approval_request', $2, $3)`,
        [user.id, approval.id, JSON.stringify({ fields: Object.keys(pendingChanges) })]
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: updated,
      pending_approval: approval ? {
        id: approval.id,
        fields: Object.keys(pendingChanges),
        message: 'Sensitive changes were submitted for approval. They will apply once a manager approves.',
      } : null,
      message: updated ? 'Profile updated.' : 'Sensitive changes submitted for approval.',
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
