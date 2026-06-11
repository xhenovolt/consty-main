import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';
import crypto from 'crypto';

/**
 * POST /api/intelligence/ingest
 * Ingest markdown files into system intelligence
 * Can accept either:
 * 1. Single file: { filename, filePath, content, systemId, category }
 * 2. Batch: { files: [...], systemId }
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'systems.edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { filename, filePath, content, systemId, category, files, autoDetectCategory } = body;

    // Validate system exists
    const systemCheck = await query('SELECT id, name FROM systems WHERE id = $1', [systemId]);
    if (!systemCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }
    const systemName = systemCheck.rows[0].name;

    // Handle single file or batch
    let filesToIngest = [];
    if (files && Array.isArray(files)) {
      filesToIngest = files;
    } else if (filename && content) {
      filesToIngest = [{ filename, filePath, content, category }];
    } else {
      return NextResponse.json(
        { success: false, error: 'Either provide single file (filename, content) or batch (files array)' },
        { status: 400 }
      );
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const file of filesToIngest) {
      try {
        const { filename: fname, filePath: fpath, content: fcontent, category: fcat } = file;

        if (!fname || !fcontent) {
          results.push({
            file: fname,
            success: false,
            error: 'filename and content required',
          });
          errorCount++;
          continue;
        }

        // Detect category if not provided
        let detectedCategory = fcat || 'guide';
        if (autoDetectCategory || !fcat) {
          if (fname.includes('architecture') || fname.includes('design')) {
            detectedCategory = 'architecture';
          } else if (fname.includes('guide') || fname.includes('quick')) {
            detectedCategory = 'guide';
          } else if (fname.includes('bug') || fname.includes('fix')) {
            detectedCategory = 'bug_fix';
          } else if (fname.includes('deploy') || fname.includes('release')) {
            detectedCategory = 'deployment';
          } else if (fname.includes('security')) {
            detectedCategory = 'security';
          } else if (fname.includes('api')) {
            detectedCategory = 'api';
          }
        }

        // Extract title from filename
        const title = fname.replace(/\.(md|txt)$/i, '').replace(/[-_]/g, ' ');

        // Create content hash for deduplication
        const contentHash = crypto.createHash('sha256').update(fcontent).digest('hex');

        // Check for duplicates
        const existingDuplicate = await query(
          'SELECT id FROM markdown_ingestion_jobs WHERE system_id = $1 AND content_hash = $2 AND job_status = $3',
          [systemId, contentHash, 'completed']
        );

        if (existingDuplicate.rows[0]) {
          results.push({
            file: fname,
            success: false,
            error: 'Duplicate content - already ingested',
          });
          errorCount++;
          continue;
        }

        // Create intelligence entry
        const intelligenceResult = await query(
          `INSERT INTO system_intelligence
           (system_id, title, category, content, summary, version_tag, created_by, is_public)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            systemId,
            title,
            detectedCategory,
            fcontent,
            fcontent.substring(0, 1000), // First 1000 chars as summary
            `ingested_${new Date().toISOString().split('T')[0]}`,
            auth.userId,
            true, // Markdown files are public by default
          ]
        );

        const intelligenceId = intelligenceResult.rows[0].id;

        // Log ingestion job
        await query(
          `INSERT INTO markdown_ingestion_jobs
           (system_id, job_status, file_path, filename, content, category_assigned, intelligence_id, created_by, content_hash, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            systemId,
            'completed',
            fpath || fname,
            fname,
            fcontent,
            detectedCategory,
            intelligenceId,
            auth.userId,
            contentHash,
            new Date(),
          ]
        );

        results.push({
          file: fname,
          success: true,
          intelligenceId,
          category: detectedCategory,
          title,
        });
        successCount++;
      } catch (fileError) {
        console.error(`Error ingesting ${file.filename}:`, fileError);
        results.push({
          file: file.filename,
          success: false,
          error: fileError.message,
        });
        errorCount++;
      }
    }

    // Update system intelligence score and metadata
    if (successCount > 0) {
      await query(
        `UPDATE systems 
         SET has_intelligence = true, 
             last_intelligence_update = NOW(),
             intelligence_score = LEAST(100, intelligence_score + CASE WHEN intelligence_score < 50 THEN 10 ELSE 5 END)
         WHERE id = $1`,
        [systemId]
      );

      // Log event
      Events.log('intelligence.batch_ingested', {
        userId: auth.userId,
        systemId,
        count: successCount,
        filenames: filesToIngest.map(f => f.filename),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ingested ${successCount}/${filesToIngest.length} files`,
      results,
      summary: {
        total: filesToIngest.length,
        successful: successCount,
        failed: errorCount,
      },
    }, { status: successCount > 0 ? 200 : 400 });
  } catch (error) {
    console.error('[Intelligence Ingest] POST error:', error);
    return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
  }
}
