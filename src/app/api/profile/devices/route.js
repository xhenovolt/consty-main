import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';

/**
 * GET /api/profile/devices — Fetch user's known devices
 */
export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    const result = await query(
      `SELECT id, device_name, browser, os, ip_address, last_active_at, is_current, created_at
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_active_at DESC
       LIMIT 20`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/devices — Remove a device
 */
export async function DELETE(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const { deviceId } = await request.json();

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    await query(
      'DELETE FROM user_devices WHERE id = $1 AND user_id = $2',
      [deviceId, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Device removed',
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to remove device' }, { status: 500 });
  }
}
