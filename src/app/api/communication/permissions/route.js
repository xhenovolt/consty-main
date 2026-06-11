import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  getMediaPermissions,
  updateMediaPermission,
  getCallPermissionsForRole,
} from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * GET /api/communication/permissions/media
 * Get media type permissions (user view)
 */
export async function GET(req) {
  try {
    const auth = await requirePermission(req, 'communication.view_conversations');
    if (auth.status === 403) return auth;
    
    const permissions = await getMediaPermissions();
    
    return NextResponse.json({
      success: true,
      mediaPermissions: permissions,
    });
  } catch (error) {
    console.error('Error fetching media permissions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/communication/permissions/media
 * Update media permissions (admin only)
 */
export async function PUT(req) {
  try {
    const auth = await requirePermission(req, 'communication.manage_media_permissions');
    if (auth.status === 403) return auth;
    
    const { userId } = auth;
    const body = await req.json();
    const { fileType, allowed, maxSizeMb } = body;
    
    if (!fileType) {
      return NextResponse.json(
        { success: false, error: 'fileType is required' },
        { status: 400 }
      );
    }
    
    const result = await updateMediaPermission(fileType, allowed, maxSizeMb);
    
    // Log audit
    await query(
      `INSERT INTO communication_audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'media_permission_updated', 'media_permission', $2, $3)`,
      [userId, fileType, JSON.stringify({ allowed, maxSizeMb })]
    );
    
    return NextResponse.json({
      success: true,
      mediaPermission: result,
    });
  } catch (error) {
    console.error('Error updating media permissions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
