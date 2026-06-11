import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { v2 as cloudinary } from 'cloudinary';
import { requirePermission, hasPermission } from '@/lib/permissions.js';
import { denyWithApproval } from '@/lib/permission-denial.js';

// Size limits (bytes)
const LIMITS = {
  image: 10 * 1024 * 1024,   // 10MB
  video: 100 * 1024 * 1024,  // 100MB
  raw: 10 * 1024 * 1024,     // 10MB
};

// Load Cloudinary accounts from DB or env fallback
async function getCloudinaryConfig() {
  try {
    const result = await query(`SELECT * FROM cloud_accounts WHERE is_active = true ORDER BY is_primary DESC`);
    if (result.rows.length > 0) return result.rows;
  } catch {}

  // Fallback to env
  return [{
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dttdnpgwv',
    api_key: process.env.CLOUDINARY_API_KEY || '927624812139815',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'PP-OjxHj7eCSA7OyAOUIQpHkDo4',
    account_name: 'primary',
    is_primary: true,
  }];
}

function getResourceType(mimeType) {
  if (!mimeType) return 'auto';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}

// POST /api/media/upload — Upload file to Cloudinary
export async function POST(request) {
  try {
    // Soft-gated: if the user lacks media.manage, return a 403 that the
    // client can convert into an approval request rather than a silent
    // failure.
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    const entity_type = formData.get('entity_type') || null;
    const entity_id = formData.get('entity_id') || null;
    const tags = formData.get('tags') || '';
    const quality = formData.get('quality') || 'original';

    const allowed = await hasPermission(auth.userId, 'media', 'manage', auth.role);
    if (!allowed) {
      return denyWithApproval({
        required_permission: 'media.manage',
        action: `Upload "${file?.name || 'a file'}" to ${entity_type || 'media library'}`,
        target_record_type: entity_type || 'media',
        target_record_id: entity_id,
        replay_path: '/api/media/upload',
        replay_method: 'POST',
        // FormData can't be replayed as-is; capture metadata only.
        payload: { filename: file?.name, mime: file?.type, size: file?.size, entity_type, entity_id, tags, quality },
        reason: 'You need media.manage to upload to this entity.',
      });
    }

    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });

    const mimeType = file.type || '';
    const resourceType = getResourceType(mimeType);
    const fileSize = file.size;

    // Validate size limits
    const limit = LIMITS[resourceType] || LIMITS.raw;
    if (fileSize > limit) {
      return NextResponse.json({
        success: false,
        error: `File too large. ${resourceType} max is ${Math.round(limit / 1024 / 1024)}MB, got ${(fileSize / 1024 / 1024).toFixed(1)}MB`
      }, { status: 413 });
    }

    // Get Cloudinary config (try primary, fallback to secondary)
    const accounts = await getCloudinaryConfig();
    let uploadResult = null;
    let usedAccount = null;

    for (const account of accounts) {
      try {
        cloudinary.config({
          cloud_name: account.cloud_name,
          api_key: account.api_key,
          api_secret: account.api_secret,
        });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadOptions = {
          resource_type: resourceType === 'auto' ? 'auto' : resourceType,
          folder: `consty/${entity_type || 'general'}`,
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
        };

        // Apply optimization if requested
        if (quality === 'optimized') {
          uploadOptions.transformation = [{ quality: 'auto:good', fetch_format: 'auto' }];
        }

        uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
          stream.end(buffer);
        });

        usedAccount = account.account_name || account.cloud_name;
        break; // Success, stop trying
      } catch (err) {
        console.error(`[Upload] Cloudinary account ${account.account_name || account.cloud_name} failed:`, err.message);
        continue; // Try next account
      }
    }

    if (!uploadResult) {
      return NextResponse.json({ success: false, error: 'Upload failed on all Cloudinary accounts' }, { status: 502 });
    }

    // Save metadata to database
    const tagArray = tags ? `{${tags.split(',').map(t => `"${t.trim()}"`).join(',')}}` : '{}';
    const mediaResult = await query(
      `INSERT INTO media (filename, original_filename, mime_type, file_size, storage_provider, cloudinary_account,
        public_id, url, secure_url, thumbnail_url, width, height, format,
        entity_type, entity_id, tags, quality, uploaded_by)
       VALUES ($1,$2,$3,$4,'cloudinary',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        uploadResult.public_id.split('/').pop(), file.name, mimeType, fileSize,
        usedAccount, uploadResult.public_id, uploadResult.url, uploadResult.secure_url,
        uploadResult.eager?.[0]?.secure_url || null,
        uploadResult.width || null, uploadResult.height || null, uploadResult.format || null,
        entity_type, entity_id, tagArray, quality, auth.userId,
      ]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'media', mediaResult.rows[0].id, JSON.stringify({ filename: file.name, entity_type })]);

    return NextResponse.json({ success: true, data: mediaResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Upload] error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed: ' + error.message }, { status: 500 });
  }
}
