import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/pipeline — Full pipeline view with analytics
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'pipeline', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const stage_id = searchParams.get('stage_id');
    const system_id = searchParams.get('system_id');

    // Pipeline entries with full details
    let sql = `
      SELECT pe.*,
        p.prospect_name, p.company_name, p.email, p.phone_number,
        ps.name as stage_name, ps.stage_order, ps.color as stage_color,
        sys.name as system_name,
        st.name as assigned_to_name
      FROM pipeline_entries pe
      JOIN prospects p ON pe.prospect_id = p.id
      JOIN pipeline_stages ps ON pe.current_stage_id = ps.id
      LEFT JOIN systems sys ON pe.system_id = sys.id
      LEFT JOIN staff st ON pe.assigned_to = st.id
      WHERE 1=1
    `;
    const params = [];

    if (stage_id) { params.push(stage_id); sql += ` AND pe.current_stage_id = $${params.length}`; }
    if (system_id) { params.push(system_id); sql += ` AND pe.system_id = $${params.length}`; }

    sql += ` ORDER BY ps.stage_order, pe.updated_at DESC`;

    const entries = await query(sql, params);

    // All stages
    const stages = await query(`SELECT * FROM pipeline_stages ORDER BY stage_order`);

    // Per-stage counts + values
    const stageStats = await query(`
      SELECT
        ps.id, ps.name, ps.stage_order, ps.color,
        COUNT(pe.id) as count,
        COALESCE(SUM(pe.expected_value), 0) as total_value
      FROM pipeline_stages ps
      LEFT JOIN pipeline_entries pe ON pe.current_stage_id = ps.id
      GROUP BY ps.id, ps.name, ps.stage_order, ps.color
      ORDER BY ps.stage_order
    `);

    // Overall analytics
    const analytics = await query(`
      SELECT
        COUNT(*) as total_entries,
        COALESCE(SUM(expected_value), 0) as total_pipeline_value,
        COUNT(*) FILTER (WHERE pe.current_stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Deal Closed')) as closed_count,
        COALESCE(SUM(expected_value) FILTER (WHERE pe.current_stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Deal Closed')), 0) as closed_value
      FROM pipeline_entries pe
    `);

    // Conversion rates: entries that moved from each stage to the next
    const conversions = await query(`
      SELECT
        ps.name as from_stage,
        ps.stage_order,
        COUNT(DISTINCT psh.pipeline_entry_id) as entries_entered,
        COUNT(DISTINCT CASE WHEN psh.left_at IS NOT NULL THEN psh.pipeline_entry_id END) as entries_left
      FROM pipeline_stages ps
      LEFT JOIN pipeline_stage_history psh ON psh.stage_id = ps.id
      GROUP BY ps.name, ps.stage_order
      ORDER BY ps.stage_order
    `);

    return NextResponse.json({
      success: true,
      data: entries.rows,
      stages: stages.rows,
      stageStats: stageStats.rows,
      analytics: analytics.rows[0] || {},
      conversions: conversions.rows,
    });
  } catch (error) {
    console.error('[Pipeline] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch pipeline' }, { status: 500 });
  }
}

// POST /api/pipeline — Add prospect to pipeline
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { prospect_id, stage_id, system_id, assigned_to, expected_value, expected_close_date, notes } = body;

    if (!prospect_id) return NextResponse.json({ success: false, error: 'prospect_id is required' }, { status: 400 });

    // Default to first stage if not specified
    let targetStageId = stage_id;
    if (!targetStageId) {
      const firstStage = await query(`SELECT id FROM pipeline_stages ORDER BY stage_order LIMIT 1`);
      if (firstStage.rows.length === 0) return NextResponse.json({ success: false, error: 'No pipeline stages configured' }, { status: 500 });
      targetStageId = firstStage.rows[0].id;
    }

    // Check for duplicate entry
    const existing = await query(`SELECT id FROM pipeline_entries WHERE prospect_id = $1`, [prospect_id]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'This prospect is already in the pipeline' }, { status: 409 });
    }

    const result = await query(
      `INSERT INTO pipeline_entries (prospect_id, current_stage_id, system_id, assigned_to, expected_value, expected_close_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [prospect_id, targetStageId, system_id || null,
       assigned_to || null, expected_value || null, expected_close_date || null, notes || null]
    );

    // Record initial stage history
    await query(
      `INSERT INTO pipeline_stage_history (pipeline_entry_id, stage_id) VALUES ($1,$2)`,
      [result.rows[0].id, targetStageId]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Pipeline] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add to pipeline' }, { status: 500 });
  }
}

// PATCH /api/pipeline — Move prospect to new stage or update entry
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, new_stage_id, ...fields } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const updates = [];
    const values = [];

    // Handle stage change with history tracking
    if (new_stage_id) {
      // Close current stage history entry
      await query(
        `UPDATE pipeline_stage_history SET left_at = NOW()
         WHERE pipeline_entry_id = $1 AND left_at IS NULL`,
        [id]
      );

      // Open new stage history entry
      await query(
        `INSERT INTO pipeline_stage_history (pipeline_entry_id, stage_id) VALUES ($1,$2)`,
        [id, new_stage_id]
      );

      values.push(new_stage_id);
      updates.push(`current_stage_id = $${values.length}`);
    }

    const allowed = ['system_id','assigned_to','expected_value','expected_close_date','notes'];
    allowed.forEach(f => {
      if (fields[f] !== undefined) { values.push(fields[f]); updates.push(`${f} = $${values.length}`); }
    });

    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No changes provided' }, { status: 400 });
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await query(`UPDATE pipeline_entries SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Pipeline] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update pipeline entry' }, { status: 500 });
  }
}

// DELETE /api/pipeline?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    await query(`DELETE FROM pipeline_entries WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
