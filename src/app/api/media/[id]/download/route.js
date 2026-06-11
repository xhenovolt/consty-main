import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/media/[id]/download
//
// Fetches the file from the configured storage (Cloudinary today) and
// re-streams it back with Content-Disposition: attachment, preserving the
// original filename and extension. This is what enables the dedicated
// "Download" button on the media page — direct Cloudinary links open inline
// in the browser for many MIME types, which is the user complaint.
//
// Records the download in audit_logs.
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'media.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  const { id } = await params;
  const row = await query('SELECT * FROM media WHERE id = $1', [id]);
  if (!row.rows.length)
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const m = row.rows[0];
  const sourceUrl = m.secure_url || m.url;
  if (!sourceUrl)
    return NextResponse.json({ success: false, error: 'No storage URL on record' }, { status: 409 });

  const upstream = await fetch(sourceUrl);
  if (!upstream.ok)
    return NextResponse.json({ success: false, error: `Upstream ${upstream.status}` }, { status: 502 });

  // Pick a safe filename. Preserve extension by inferring from filename or format.
  const filename = m.original_filename
    || m.filename
    || (m.format ? `media-${id}.${m.format}` : `media-${id}`);
  const safe = String(filename).replace(/[^A-Za-z0-9_.\-() ]/g, '_');

  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOWNLOAD','media',$2,$3)`,
      [auth.userId, id, JSON.stringify({ filename: safe })]
    );
  } catch {}

  const headers = new Headers();
  headers.set('Content-Type', m.mime_type || upstream.headers.get('content-type') || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${safe}"`);
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);

  return new NextResponse(upstream.body, { status: 200, headers });
}
