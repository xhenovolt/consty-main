import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/media/[id]/preview — inline-served version of the file.
//
// Same upstream as /download but with Content-Disposition: inline, so the
// browser will render it (image, pdf, audio, video) instead of forcing
// a save dialog. This is used by the Preview modal in the media page.
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'media.view');
  if (perm instanceof NextResponse) return perm;

  const { id } = await params;
  const row = await query('SELECT id, secure_url, url, mime_type, original_filename, filename FROM media WHERE id = $1', [id]);
  if (!row.rows.length)
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const m = row.rows[0];
  const sourceUrl = m.secure_url || m.url;
  if (!sourceUrl)
    return NextResponse.json({ success: false, error: 'No storage URL on record' }, { status: 409 });

  const upstream = await fetch(sourceUrl);
  if (!upstream.ok)
    return NextResponse.json({ success: false, error: `Upstream ${upstream.status}` }, { status: 502 });

  const filename = (m.original_filename || m.filename || `media-${id}`).replace(/[^A-Za-z0-9_.\-() ]/g, '_');
  const headers = new Headers();
  headers.set('Content-Type', m.mime_type || upstream.headers.get('content-type') || 'application/octet-stream');
  headers.set('Content-Disposition', `inline; filename="${filename}"`);
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);

  return new NextResponse(upstream.body, { status: 200, headers });
}
