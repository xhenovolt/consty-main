import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// POST /api/documents/bulk - Bulk operations on documents
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { action, document_ids, reason } = await request.json();

    if (!action || !document_ids || !Array.isArray(document_ids)) {
      return NextResponse.json(
        { success: false, error: 'Action and document_ids array are required' },
        { status: 400 }
      );
    }

    if (document_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one document ID is required' },
        { status: 400 }
      );
    }

    const validActions = ['revoke', 'restore', 'delete'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be: revoke, restore, or delete' },
        { status: 400 }
      );
    }

    // Verify all documents exist and get their current status
    const placeholders = document_ids.map((_, i) => `$${i + 1}`).join(',');
    const docsRes = await query(
      `SELECT id, unique_id, status, title FROM generated_documents
       WHERE id IN (${placeholders})`,
      document_ids
    );

    if (docsRes.rows.length !== document_ids.length) {
      return NextResponse.json(
        { success: false, error: 'Some documents not found' },
        { status: 404 }
      );
    }

    const results = [];
    const auditLogs = [];

    for (const doc of docsRes.rows) {
      let newStatus = doc.status;
      let success = true;
      let message = '';

      switch (action) {
        case 'revoke':
          if (doc.status === 'active') {
            newStatus = 'revoked';
            message = 'Document revoked successfully';
          } else {
            success = false;
            message = `Document is already ${doc.status}`;
          }
          break;

        case 'restore':
          if (doc.status === 'revoked') {
            newStatus = 'active';
            message = 'Document restored successfully';
          } else {
            success = false;
            message = `Document is not revoked (status: ${doc.status})`;
          }
          break;

        case 'delete':
          // In a real implementation, you might soft delete or archive
          // For now, we'll mark as revoked
          if (doc.status !== 'deleted') {
            newStatus = 'deleted';
            message = 'Document marked for deletion';
          } else {
            success = false;
            message = 'Document already marked for deletion';
          }
          break;
      }

      if (success && newStatus !== doc.status) {
        // Update document status
        await query(
          `UPDATE generated_documents SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          [newStatus, doc.id]
        );
      }

      // Prepare audit log
      auditLogs.push({
        document_id: doc.id,
        action: action,
        actor_id: auth.userId,
        details: JSON.stringify({
          reason: reason || '',
          old_status: doc.status,
          new_status: newStatus,
          success
        })
      });

      results.push({
        id: doc.id,
        unique_id: doc.unique_id,
        title: doc.title,
        old_status: doc.status,
        new_status: newStatus,
        success,
        message
      });
    }

    // Insert audit logs
    if (auditLogs.length > 0) {
      const auditValues = auditLogs.map(log =>
        `(${log.document_id}, '${log.action}', ${log.actor_id ? `'${log.actor_id}'` : 'NULL'}, '${log.details}')`
      ).join(', ');

      await query(
        `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
         VALUES ${auditValues}`
      );
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      data: {
        action,
        total: results.length,
        successful,
        failed,
        results
      }
    });

  } catch (error) {
    console.error('[Documents/Bulk] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}