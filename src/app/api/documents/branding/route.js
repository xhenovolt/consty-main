import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getActiveBranding, updateBranding } from '@/lib/company-branding.js';

// GET /api/documents/branding - Get active branding.
//
// Returns the MERGED shape from getActiveBranding() — company_settings
// (canonical for name, logo, address, phone, email, website) layered on
// top of the documents-only branding row (signatures, colors, etc.).
// This is what fixes "documents settings shows Consty Technologies" — the
// page used to read straight from document_branding (a stale internal
// table) which never matched what /app/settings/company displayed.
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const merged = await getActiveBranding(true);
    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    console.error('[Documents/Branding] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}

// PUT /api/documents/branding - Update branding.
//
// Writes to the canonical `company_branding` table via updateBranding(),
// which also busts the in-process branding cache so the next document
// generation picks up the change immediately. The previous version wrote
// to `document_branding` (an older/divergent table name) which is why
// edits never showed up where it mattered.
export async function PUT(request) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const brandingData = await request.json();
    const saved = await updateBranding(brandingData, auth.userId);

    // Return the freshly-merged shape (company_settings overlay on top of
    // the saved row) so the UI immediately reflects what generation will
    // actually use.
    const merged = await getActiveBranding(true);
    return NextResponse.json({ success: true, data: merged, saved });
  } catch (error) {
    console.error('[Documents/Branding] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update branding: ' + error.message },
      { status: 500 }
    );
  }
}