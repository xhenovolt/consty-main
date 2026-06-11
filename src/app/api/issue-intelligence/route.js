import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

const ROOT_CAUSE_CATEGORIES = [
  'code_bug', 'design_flaw', 'missing_validation', 'integration',
  'performance', 'security', 'configuration', 'data_issue',
  'third_party', 'infrastructure', 'unknown',
];
const RESOLUTION_TYPES = ['fix', 'workaround', 'wont_fix', 'duplicate', 'by_design', 'config_change'];

/**
 * GET /api/issue-intelligence — Aggregated bug intelligence metrics + list
 */
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'intelligence.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    // Check if required tables exist before querying
    const tableCheck = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bug_reports') as has_bugs,
              EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue_root_causes') as has_root_causes,
              EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue_resolutions') as has_resolutions`
    );
    const { has_bugs, has_root_causes, has_resolutions } = tableCheck.rows[0];

    if (!has_bugs || !has_root_causes || !has_resolutions) {
      return NextResponse.json({
        success: true,
        data: {
          metrics: { open_bugs: 0, critical_bugs: 0, total_root_causes: 0, total_resolutions: 0, avg_resolve_hours: null, verified_fixes: 0 },
          top_root_cause_categories: [],
          recent_resolutions: [],
        },
        setup_required: true,
        message: 'Issue intelligence tables not yet created. Run migration 910_issue_intelligence_tables.sql.',
      });
    }

    const { searchParams } = new URL(request.url);
    const bugId = searchParams.get('bug_id');

    if (bugId) {
      // Get root causes & resolutions for a specific bug
      const [rootCauses, resolutions] = await Promise.all([
        query(
          `SELECT irc.*, u.name as identified_by_name
           FROM issue_root_causes irc LEFT JOIN users u ON irc.identified_by = u.id
           WHERE irc.bug_report_id = $1 ORDER BY irc.created_at DESC`, [bugId]
        ),
        query(
          `SELECT ir.*, u.name as resolved_by_name, vu.name as verified_by_name
           FROM issue_resolutions ir
           LEFT JOIN users u ON ir.resolved_by = u.id
           LEFT JOIN users vu ON ir.verified_by = vu.id
           WHERE ir.bug_report_id = $1 ORDER BY ir.created_at DESC`, [bugId]
        ),
      ]);
      return NextResponse.json({ success: true, data: { root_causes: rootCauses.rows, resolutions: resolutions.rows } });
    }

    // Aggregated metrics
    const [metrics, topCategories, recentResolutions] = await Promise.all([
      query(`SELECT
        (SELECT COUNT(*) FROM bug_reports WHERE status IN ('open', 'in_progress')) as open_bugs,
        (SELECT COUNT(*) FROM bug_reports WHERE severity = 'critical' AND status IN ('open', 'in_progress')) as critical_bugs,
        (SELECT COUNT(*) FROM issue_root_causes) as total_root_causes,
        (SELECT COUNT(*) FROM issue_resolutions) as total_resolutions,
        (SELECT AVG(time_to_resolve_hours) FROM issue_resolutions WHERE time_to_resolve_hours IS NOT NULL) as avg_resolve_hours,
        (SELECT COUNT(*) FROM issue_resolutions WHERE is_verified = true) as verified_fixes
      `),
      query(`SELECT category, COUNT(*) as count FROM issue_root_causes GROUP BY category ORDER BY count DESC LIMIT 10`),
      query(`SELECT ir.*, br.title as bug_title, br.severity, u.name as resolved_by_name
        FROM issue_resolutions ir
        JOIN bug_reports br ON ir.bug_report_id = br.id
        LEFT JOIN users u ON ir.resolved_by = u.id
        ORDER BY ir.created_at DESC LIMIT 10`),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        metrics: metrics.rows[0],
        top_root_cause_categories: topCategories.rows,
        recent_resolutions: recentResolutions.rows,
      },
    });
  } catch (error) {
    console.error('[IssueIntelligence] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch intelligence' }, { status: 500 });
  }
}

/**
 * POST /api/issue-intelligence — Create root cause or resolution
 * Body: { type: 'root_cause' | 'resolution', bug_report_id, ... }
 */
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type, bug_report_id } = body;

    if (!bug_report_id) return NextResponse.json({ success: false, error: 'bug_report_id required' }, { status: 400 });

    if (type === 'root_cause') {
      const { root_cause, category, prevention_strategy, tags } = body;
      if (!root_cause?.trim()) return NextResponse.json({ success: false, error: 'root_cause required' }, { status: 400 });
      if (category && !ROOT_CAUSE_CATEGORIES.includes(category)) {
        return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${ROOT_CAUSE_CATEGORIES.join(', ')}` }, { status: 400 });
      }

      const result = await query(
        `INSERT INTO issue_root_causes (bug_report_id, root_cause, category, identified_by, prevention_strategy, tags)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [bug_report_id, root_cause.trim(), category || 'unknown', auth.userId, prevention_strategy || null, tags || []]
      );

      dispatch('root_cause_identified', {
        entityType: 'bug_report', entityId: bug_report_id,
        description: `Root cause identified: ${category || 'unknown'}`,
        actorId: auth.userId,
      });

      return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
    }

    if (type === 'resolution') {
      const { resolution_type, description, time_to_resolve_hours, files_changed, verification_steps } = body;
      if (!description?.trim()) return NextResponse.json({ success: false, error: 'description required' }, { status: 400 });
      if (resolution_type && !RESOLUTION_TYPES.includes(resolution_type)) {
        return NextResponse.json({ success: false, error: `Invalid resolution_type. Must be one of: ${RESOLUTION_TYPES.join(', ')}` }, { status: 400 });
      }

      const result = await query(
        `INSERT INTO issue_resolutions (bug_report_id, resolution_type, description, resolved_by, time_to_resolve_hours, files_changed, verification_steps)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [bug_report_id, resolution_type || 'fix', description.trim(), auth.userId, time_to_resolve_hours || null, files_changed || [], verification_steps || null]
      );

      dispatch('bug_resolved', {
        entityType: 'bug_report', entityId: bug_report_id,
        description: `Bug resolution recorded: ${resolution_type || 'fix'}`,
        actorId: auth.userId,
      });

      return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: 'type must be "root_cause" or "resolution"' }, { status: 400 });
  } catch (error) {
    console.error('[IssueIntelligence] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create entry' }, { status: 500 });
  }
}

/**
 * PATCH /api/issue-intelligence — Verify a resolution
 * Body: { resolution_id }
 */
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { resolution_id } = await request.json();
    if (!resolution_id) return NextResponse.json({ success: false, error: 'resolution_id required' }, { status: 400 });

    const result = await query(
      `UPDATE issue_resolutions SET is_verified = true, verified_by = $1, verified_at = NOW() WHERE id = $2 RETURNING *`,
      [auth.userId, resolution_id]
    );

    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Resolution not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to verify' }, { status: 500 });
  }
}
