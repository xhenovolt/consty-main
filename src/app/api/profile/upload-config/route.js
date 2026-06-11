import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';
import { getCloudinaryConfig } from '@/lib/cloudinary-utils';

/**
 * GET /api/profile/upload-config — Get Cloudinary upload config for client-side uploads
 */
export async function GET() {
  try {
    await getCurrentUserOrThrow();
    const config = getCloudinaryConfig();

    return NextResponse.json({
      success: true,
      data: {
        cloudName: config.cloudName,
        uploadPreset: config.uploadPreset,
        folder: 'consty-profiles',
      },
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to get upload config' }, { status: 500 });
  }
}

/**
 * POST /api/profile/upload-config — Save uploaded image URL to profile
 */
export async function POST(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const { imageUrl, imageType } = await request.json();

    if (!imageUrl || !imageType) {
      return NextResponse.json({ error: 'imageUrl and imageType are required' }, { status: 400 });
    }

    const validTypes = ['profile', 'cover'];
    if (!validTypes.includes(imageType)) {
      return NextResponse.json({ error: 'Invalid imageType. Must be "profile" or "cover"' }, { status: 400 });
    }

    const field = imageType === 'profile' ? 'profile_image_url' : 'cover_image_url';

    await query(
      `UPDATE users SET ${field} = $1, updated_at = NOW() WHERE id = $2`,
      [imageUrl, user.id]
    );

    await query(
      `INSERT INTO user_activity_log (user_id, action, entity_type, details)
       VALUES ($1, $2, 'user', $3)`,
      [user.id, `${imageType}_image_updated`, JSON.stringify({ url: imageUrl })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `${imageType === 'profile' ? 'Profile' : 'Cover'} image updated`,
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
  }
}
