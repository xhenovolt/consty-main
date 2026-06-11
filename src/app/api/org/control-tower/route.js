/**
 * GET /api/org/control-tower - Founder Control Tower aggregation endpoint
 * Returns: org health, approval pipeline, structural warnings, activity feed
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'dashboard.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    // Run all queries in parallel for speed
    const [
      orgHealth,
      authorityDist,
      approvalPipeline,
      structuralWarnings,
      recentChanges,
      departmentHealth,
    ] = await Promise.all([
      // 1. Organization Health
      query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_staff,
          (SELECT COUNT(*) FROM organizational_structure WHERE status = 'vacant') AS vacant_roles,
          (SELECT COUNT(*) FROM organizational_structure WHERE status = 'active') AS filled_positions,
          (SELECT COUNT(*) FROM organizational_structure WHERE status = 'suspended') AS suspended,
          (SELECT COUNT(*) FROM organizational_structure) AS total_nodes,
          (SELECT COUNT(*) FROM departments WHERE is_active != false) AS active_departments
      `),

      // 2. Authority distribution
      query(`
        SELECT al.name, al.rank_value, al.color_indicator,
               COUNT(os.id) AS node_count
        FROM authority_levels al
        LEFT JOIN organizational_structure os ON os.authority_level_id = al.id AND os.status != 'archived'
        WHERE al.is_active = true
        GROUP BY al.id, al.name, al.rank_value, al.color_indicator
        ORDER BY al.rank_value DESC
      `),

      // 3. Approval Pipeline
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
          COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - interval '3 days') AS escalated
        FROM approval_requests
      `),

      // 4. Structural Warnings
      query(`
        SELECT * FROM (
          -- Departments without leadership (no node with rank >= 60)
          SELECT 'dept_no_leader' AS warning_type,
                 d.id AS entity_id,
                 COALESCE(d.name, d.department_name) AS entity_name,
                 'Department has no leadership node (Director+)' AS message,
                 'high' AS severity
          FROM departments d
          WHERE d.is_active != false
            AND NOT EXISTS (
              SELECT 1 FROM organizational_structure os
              JOIN authority_levels al ON os.authority_level_id = al.id
              WHERE os.department_id = d.id AND al.rank_value >= 60 AND os.status = 'active'
            )

          UNION ALL

          -- Vacant critical roles (authority >= 60)
          SELECT 'vacant_critical' AS warning_type,
                 os.id AS entity_id,
                 os.node_name AS entity_name,
                 'Critical position is vacant' AS message,
                 'high' AS severity
          FROM organizational_structure os
          JOIN authority_levels al ON os.authority_level_id = al.id
          WHERE os.status = 'vacant' AND al.rank_value >= 60

          UNION ALL

          -- Suspended staff in active positions
          SELECT 'suspended_in_active' AS warning_type,
                 os.id AS entity_id,
                 os.node_name AS entity_name,
                 'Position has suspended staff' AS message,
                 'medium' AS severity
          FROM organizational_structure os
          WHERE os.status = 'suspended'
        ) warnings
        ORDER BY
          CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          warning_type
      `),

      // 5. Recent org changes (activity feed)
      query(`
        SELECT ocl.*, u.name AS actor_name
        FROM org_change_logs ocl
        LEFT JOIN users u ON ocl.changed_by = u.id
        ORDER BY ocl.created_at DESC
        LIMIT 20
      `),

      // 6. Department health overview
      query(`
        SELECT d.id, COALESCE(d.name, d.department_name) AS name,
               COUNT(os.id) FILTER (WHERE os.status = 'active') AS active_nodes,
               COUNT(os.id) FILTER (WHERE os.status = 'vacant') AS vacant_nodes,
               COUNT(os.id) AS total_nodes
        FROM departments d
        LEFT JOIN organizational_structure os ON os.department_id = d.id AND os.status != 'archived'
        WHERE d.is_active != false
        GROUP BY d.id, d.name, d.department_name
        ORDER BY COALESCE(d.name, d.department_name)
      `),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        org_health: orgHealth.rows[0],
        authority_distribution: authorityDist.rows,
        approval_pipeline: approvalPipeline.rows[0],
        structural_warnings: structuralWarnings.rows,
        recent_changes: recentChanges.rows,
        department_health: departmentHealth.rows,
      },
    });
  } catch (error) {
    console.error('Failed to fetch control tower data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch control tower data' }, { status: 500 });
  }
}
