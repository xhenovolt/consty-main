import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';
import { hasPermission } from '@/lib/permissions.js';

/**
 * GET /api/communication/admin/settings — Get all communication settings
 * (Admin/superadmin only)
 */
export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    // Permission-driven: any role granted communication.admin works.
    // Superadmins bypass via hasPermission's internal check.
    if (!(await hasPermission(user.id, 'communication', 'admin', user.role))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = await query(
      'SELECT * FROM communication_settings ORDER BY setting_key'
    );

    // Transform to key-value map
    const settings = {};
    for (const row of result.rows) {
      settings[row.setting_key] = {
        ...row.setting_value,
        id: row.id,
        updated_at: row.updated_at,
      };
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/communication/admin/settings — Update communication settings
 */
export async function PATCH(request) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!(await hasPermission(user.id, 'communication', 'admin', user.role))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body; // { setting_key: value_object }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 });
    }

    const validKeys = [
      'audio_calls_enabled', 'video_calls_enabled', 'file_sharing_enabled',
      'max_file_size_mb', 'allowed_file_types', 'rate_limit_messages',
      'rate_limit_calls', 'recording_enabled', 'screen_sharing_enabled',
    ];

    for (const [key, value] of Object.entries(settings)) {
      if (!validKeys.includes(key)) continue;

      await query(
        `INSERT INTO communication_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (setting_key) DO UPDATE SET
           setting_value = $2::jsonb,
           updated_by = $3,
           updated_at = NOW()`,
        [key, JSON.stringify(value), user.id]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated',
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Settings update error:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
