import { NextResponse } from 'next/server';
import { getCurrentUserOrThrow } from '@/lib/current-user';
import { getCloudinaryConfig } from '@/lib/cloudinary-utils';
import { query } from '@/lib/db';

/**
 * POST /api/communication/upload — Upload media for chat
 * Returns Cloudinary upload config for client-side upload
 * Enforces admin file restrictions
 */
export async function POST(request) {
  try {
    const user = await getCurrentUserOrThrow();

    const body = await request.json();
    const { fileName, fileType, fileSize } = body;

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }

    // Check admin restrictions
    const maxSizeResult = await query(
      "SELECT setting_value FROM communication_settings WHERE setting_key = 'max_file_size_mb'"
    ).catch(() => ({ rows: [] }));
    const maxSizeMB = maxSizeResult.rows[0]?.setting_value?.value || 25;

    if (fileSize && fileSize > maxSizeMB * 1024 * 1024) {
      return NextResponse.json({
        error: `File too large. Maximum size is ${maxSizeMB}MB`,
      }, { status: 413 });
    }

    // Check if file sharing is enabled
    const fileSharingResult = await query(
      "SELECT setting_value FROM communication_settings WHERE setting_key = 'file_sharing_enabled'"
    ).catch(() => ({ rows: [] }));
    const fileSharingEnabled = fileSharingResult.rows[0]?.setting_value?.enabled !== false;

    if (!fileSharingEnabled) {
      return NextResponse.json({ error: 'File sharing is currently disabled' }, { status: 403 });
    }

    // Check allowed file types
    const allowedTypesResult = await query(
      "SELECT setting_value FROM communication_settings WHERE setting_key = 'allowed_file_types'"
    ).catch(() => ({ rows: [] }));
    const allowedTypes = allowedTypesResult.rows[0]?.setting_value?.types || ['image/*', 'video/*', 'audio/*', 'application/pdf'];

    const isAllowed = allowedTypes.some(pattern => {
      if (pattern.endsWith('/*')) {
        return fileType.startsWith(pattern.replace('/*', '/'));
      }
      return fileType === pattern;
    });

    if (!isAllowed) {
      return NextResponse.json({ error: 'This file type is not allowed' }, { status: 403 });
    }

    const config = getCloudinaryConfig();

    // Determine resource type
    let resourceType = 'auto';
    if (fileType.startsWith('image/')) resourceType = 'image';
    else if (fileType.startsWith('video/')) resourceType = 'video';
    else if (fileType.startsWith('audio/')) resourceType = 'video'; // Cloudinary uses 'video' for audio

    return NextResponse.json({
      success: true,
      data: {
        cloudName: config.cloudName,
        uploadPreset: config.uploadPreset,
        folder: `consty-communication/${user.id}`,
        resourceType,
        maxFileSize: maxSizeMB * 1024 * 1024,
      },
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Upload config error:', err);
    return NextResponse.json({ error: 'Failed to get upload config' }, { status: 500 });
  }
}
