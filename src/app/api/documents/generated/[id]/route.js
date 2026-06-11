import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { substitutePlaceholders } from '@/lib/document-generation.js';
import { getActiveBranding } from '@/lib/company-branding.js';

/**
 * /api/documents/generated/[id]
 *
 * Admin CRUD for a single generated document. Lookup accepts either the
 * UUID primary key OR the human unique_id (e.g. XTN-INT-2026-0001) so
 * callers can use whichever they have on hand.
 *
 * Editable fields: title, recipient_name, recipient_email, recipient_phone,
 * expires_at, placeholder_data, metadata. Revocation goes through PATCH
 * with is_revoked:true (plus a revocation_reason); see also the existing
 * POST /api/documents/verify which does the same thing.
 *
 * NOT editable: unique_id, verification_token, verification_hash,
 * template_id, generated_at, generated_by — those are the cryptographic
 * identity of the document and changing them would invalidate every
 * existing QR code in circulation.
 */

const EDITABLE = ['title', 'recipient_name', 'recipient_email', 'recipient_phone', 'expires_at', 'metadata', 'placeholder_data'];

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
}

async function loadDocument(idOrUniqueId) {
  const where = isUuid(idOrUniqueId) ? 'g.id = $1' : 'g.unique_id = $1';
  const r = await query(
    `SELECT g.*, t.body AS template_body, t.body_format AS template_body_format, t.name AS template_name,
            u.full_name AS generated_by_name
     FROM generated_documents g
     LEFT JOIN document_templates t ON g.template_id = t.id
     LEFT JOIN users u ON g.generated_by = u.id
     WHERE ${where} LIMIT 1`,
    [idOrUniqueId]
  );
  return r.rows[0] || null;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const doc = await loadDocument(id);
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Render body for the admin detail page (same pipeline as the public
    // verify route — placeholders substituted server-side).
    let rendered_body = null;
    if (doc.template_body) {
      const pdata = (typeof doc.placeholder_data === 'string')
        ? (() => { try { return JSON.parse(doc.placeholder_data); } catch { return {}; } })()
        : (doc.placeholder_data || {});
      rendered_body = substitutePlaceholders(doc.template_body, pdata);
    }

    let branding = null;
    try { branding = await getActiveBranding(); } catch {/* non-fatal */}

    // Strip cryptographic secrets from the response. The admin needs to
    // see almost everything but never the raw verification token.
    const { verification_token, verification_hash, ...safe } = doc;
    return NextResponse.json({
      success: true,
      data: {
        ...safe,
        rendered_body,
        body_format: doc.template_body_format || 'html',
        branding,
      },
    });
  } catch (err) {
    console.error('[Generated/[id]] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const doc = await loadDocument(id);
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const sets = [];
    const values = [];

    for (const field of EDITABLE) {
      if (body[field] === undefined) continue;
      let value = body[field];
      if (field === 'placeholder_data' || field === 'metadata') {
        // Allow either an object (preferred) or a JSON string.
        if (typeof value === 'string') {
          try { value = JSON.parse(value); }
          catch { return NextResponse.json({ success: false, error: `${field} must be valid JSON` }, { status: 400 }); }
        }
        value = JSON.stringify(value);
      }
      if (field === 'expires_at') {
        // Accept '' or null to mean "no expiry" (NULL in DB).
        value = (value === '' || value === null) ? null : value;
      }
      sets.push(`${field} = $${values.length + 1}`);
      values.push(value);
    }

    // Revocation lifecycle: setting is_revoked on the body flips the
    // revocation columns transactionally so the public verify page picks
    // it up immediately.
    if (body.is_revoked === true && !doc.is_revoked) {
      sets.push(`is_revoked = TRUE`);
      sets.push(`revoked_at = NOW()`);
      sets.push(`revoked_by = $${values.length + 1}`);
      values.push(auth.userId);
      if (body.revocation_reason !== undefined) {
        sets.push(`revocation_reason = $${values.length + 1}`);
        values.push(body.revocation_reason || null);
      }
      sets.push(`status = 'revoked'`);
    } else if (body.is_revoked === false && doc.is_revoked) {
      // Allow un-revoke (rare but useful for accidentally-revoked docs).
      sets.push(`is_revoked = FALSE`);
      sets.push(`revoked_at = NULL`);
      sets.push(`revoked_by = NULL`);
      sets.push(`revocation_reason = NULL`);
      sets.push(`status = 'issued'`);
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: 'No editable fields supplied' }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    values.push(doc.id);

    const r = await query(
      `UPDATE generated_documents SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    // Audit log entry — best-effort, table may not exist on older deploys.
    try {
      await query(
        `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
         VALUES ($1, 'edited', $2, $3)`,
        [
          doc.id,
          auth.userId,
          JSON.stringify({
            fields: Object.keys(body).filter(k => EDITABLE.includes(k) || k === 'is_revoked' || k === 'revocation_reason'),
            revoked: body.is_revoked === true ? true : body.is_revoked === false ? false : undefined,
          }),
        ]
      );
    } catch {}

    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('[Generated/[id]] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update: ' + err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.delete');
  if (perm instanceof NextResponse) {
    // Fall back to documents.manage if delete isn't separately granted.
    const fb = await requirePermission(request, 'documents.manage');
    if (fb instanceof NextResponse) return fb;
  }
  try {
    const { id } = await params;
    const doc = await loadDocument(id);
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    await query('DELETE FROM generated_documents WHERE id = $1', [doc.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Generated/[id]] DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
