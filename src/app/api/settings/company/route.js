import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { invalidateBrandingCache } from '@/lib/company-branding.js';

const ALLOWED_KEYS = [
  'company_name',
  'company_tagline',
  'company_address',
  'company_phone_1',
  'company_phone_2',
  'company_phone_3',
  'company_email',
  'company_website',
  'company_logo',
  'company_tin',
  'company_registration',
];

/**
 * GET /api/settings/company
 * Returns all company settings as a flat object.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'users.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const res = await query('SELECT key, value FROM company_settings ORDER BY key');
    const data = {};
    for (const row of res.rows) data[row.key] = row.value ?? '';
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[Company Settings] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch company settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/company
 * Upserts one or more company settings keys.
 * Body: { company_name: "...", company_phone_1: "...", ... }
 * The company_logo key accepts a base64 data URL (max ~2MB).
 */
export async function PATCH(request) {
  const perm = await requirePermission(request, 'users.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const body = await request.json();

    // Validate logo size if provided (base64 ≈ 1.37× raw; 2MB raw ≈ 2.74MB base64)
    if (body.company_logo && body.company_logo.length > 3_000_000) {
      return NextResponse.json(
        { success: false, error: 'Logo too large — please use an image under 2 MB' },
        { status: 413 }
      );
    }

    const entries = Object.entries(body).filter(([k]) => ALLOWED_KEYS.includes(k));
    if (!entries.length) {
      return NextResponse.json({ success: false, error: 'No valid keys provided' }, { status: 400 });
    }

    for (const [key, value] of entries) {
      await query(
        `INSERT INTO company_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value ?? '']
      );
    }

    // Bust the documents-module branding cache so the new name/logo show up
    // on the next generation without a process restart.
    invalidateBrandingCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Company Settings] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
  }
}
