import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

/**
 * Auto-diagnosis engine — infers WHY a project is stalled from its state.
 * Each detector is idempotent (won't duplicate an already-open auto blocker for
 * the same target+type). A resolve pass closes auto blockers whose condition has
 * cleared, so re-running keeps the picture current. Manual blockers are untouched.
 */

// detectors: INSERT ... SELECT guarded by NOT EXISTS (open auto blocker same target+type)
const DETECTORS = [
  // Missing materials / consumables / utilities
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'resource',r.id,'missing_material',
          'Short '||(r.quantity_required - r.quantity_available)||' '||COALESCE(r.unit_of_measure,'units')||' of '||r.name,
          'Procure or allocate more '||r.name,'high','auto','open'
   FROM resources r
   WHERE r.project_id=$1 AND r.category IN ('material','consumable','fuel','water','power')
     AND r.quantity_available < r.quantity_required
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='resource'
                     AND b.target_id=r.id AND b.blocker_type='missing_material' AND b.status<>'resolved')`,

  // Unavailable labour
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'resource',r.id,'unavailable_labour','Labour shortfall on '||r.name,'Mobilise more labour for '||r.name,'high','auto','open'
   FROM resources r
   WHERE r.project_id=$1 AND r.category IN ('labour','staff','subcontractor')
     AND r.quantity_available < r.quantity_required
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='resource'
                     AND b.target_id=r.id AND b.blocker_type='unavailable_labour' AND b.status<>'resolved')`,

  // Unavailable equipment / vehicles / tools
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'resource',r.id,'unavailable_equipment','Equipment shortfall on '||r.name,'Hire or allocate '||r.name,'medium','auto','open'
   FROM resources r
   WHERE r.project_id=$1 AND r.category IN ('equipment','vehicle','tool')
     AND r.quantity_available < r.quantity_required
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='resource'
                     AND b.target_id=r.id AND b.blocker_type='unavailable_equipment' AND b.status<>'resolved')`,

  // Sister/dependent resource missing while the primary is present
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'resource',dep.id,'missing_sister_material',
          dep.name||' is required by '||r.name||' but is short','Supply '||dep.name||' so '||r.name||' can be used','high','auto','open'
   FROM resource_relations rel
   JOIN resources r   ON r.id = rel.resource_id AND r.project_id=$1
   JOIN resources dep ON dep.id = rel.depends_on_resource_id
   WHERE r.quantity_available >= r.quantity_required
     AND dep.quantity_available < dep.quantity_required
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='resource'
                     AND b.target_id=dep.id AND b.blocker_type='missing_sister_material' AND b.status<>'resolved')`,

  // Budget in trouble
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'budget',pb.id,'missing_budget','Project budget is '||pb.status,'Increase funding or reduce scope',
          CASE WHEN pb.status='overrun' THEN 'critical' ELSE 'high' END,'auto','open'
   FROM project_budgets pb
   WHERE pb.project_id=$1 AND pb.status IN ('deficit','frozen','overrun')
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='budget'
                     AND b.target_id=pb.id AND b.blocker_type='missing_budget' AND b.status<>'resolved')`,

  // Procurement awaiting approval past its needed-by date
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'procurement',pr.id,'approval_delay','Request "'||pr.title||'" awaiting approval past its needed-by date',
          'Approve or reject the request','high','auto','open'
   FROM procurement_requests pr
   WHERE pr.project_id=$1 AND pr.status='requested' AND pr.needed_by IS NOT NULL AND pr.needed_by < CURRENT_DATE
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='procurement'
                     AND b.target_id=pr.id AND b.blocker_type='approval_delay' AND b.status<>'resolved')`,

  // Approved/ordered procurement not received past needed-by date
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'procurement',pr.id,'supplier_delay','Request "'||pr.title||'" not delivered by its needed-by date',
          'Follow up with the supplier','high','auto','open'
   FROM procurement_requests pr
   WHERE pr.project_id=$1 AND pr.status IN ('approved','ordered') AND pr.needed_by IS NOT NULL AND pr.needed_by < CURRENT_DATE
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='procurement'
                     AND b.target_id=pr.id AND b.blocker_type='supplier_delay' AND b.status<>'resolved')`,

  // Open defects requiring rework
  `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,required_action,severity,detected_by,status)
   SELECT $1,'work_item',COALESCE(d.work_item_id,d.id),'rework_required','Rework needed: '||d.description,
          'Complete the rework and re-inspect',d.severity,'auto','open'
   FROM defects d
   WHERE d.project_id=$1 AND d.rework_required = true AND d.status <> 'closed'
     AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.blocker_type='rework_required'
                     AND b.target_id=COALESCE(d.work_item_id,d.id) AND b.status<>'resolved')`,
];

// resolvers: close auto blockers whose underlying condition has cleared
const RESOLVERS = [
  `UPDATE blockers b SET status='resolved', resolved_at=now(), resolution_notes='Auto-resolved: condition cleared', updated_at=now()
   WHERE b.project_id=$1 AND b.detected_by='auto' AND b.status<>'resolved'
     AND b.blocker_type IN ('missing_material','unavailable_labour','unavailable_equipment')
     AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.id=b.target_id AND r.quantity_available < r.quantity_required)`,

  `UPDATE blockers b SET status='resolved', resolved_at=now(), resolution_notes='Auto-resolved: condition cleared', updated_at=now()
   WHERE b.project_id=$1 AND b.detected_by='auto' AND b.status<>'resolved' AND b.blocker_type='missing_sister_material'
     AND NOT EXISTS (SELECT 1 FROM resources dep WHERE dep.id=b.target_id AND dep.quantity_available < dep.quantity_required)`,

  `UPDATE blockers b SET status='resolved', resolved_at=now(), resolution_notes='Auto-resolved: condition cleared', updated_at=now()
   WHERE b.project_id=$1 AND b.detected_by='auto' AND b.status<>'resolved' AND b.blocker_type='missing_budget'
     AND NOT EXISTS (SELECT 1 FROM project_budgets pb WHERE pb.project_id=$1 AND pb.status IN ('deficit','frozen','overrun'))`,

  `UPDATE blockers b SET status='resolved', resolved_at=now(), resolution_notes='Auto-resolved: condition cleared', updated_at=now()
   WHERE b.project_id=$1 AND b.detected_by='auto' AND b.status<>'resolved' AND b.blocker_type IN ('approval_delay','supplier_delay')
     AND NOT EXISTS (SELECT 1 FROM procurement_requests pr WHERE pr.id=b.target_id
                     AND pr.needed_by < CURRENT_DATE AND pr.status IN ('requested','approved','ordered'))`,

  `UPDATE blockers b SET status='resolved', resolved_at=now(), resolution_notes='Auto-resolved: condition cleared', updated_at=now()
   WHERE b.project_id=$1 AND b.detected_by='auto' AND b.status<>'resolved' AND b.blocker_type='rework_required'
     AND NOT EXISTS (SELECT 1 FROM defects d WHERE COALESCE(d.work_item_id,d.id)=b.target_id AND d.rework_required AND d.status<>'closed')`,
];

// POST /api/projects/[id]/blockers/diagnose
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    let resolved = 0, detected = 0;
    for (const sql of RESOLVERS) resolved += (await query(sql, [id])).rowCount;
    for (const sql of DETECTORS) detected += (await query(sql, [id])).rowCount;
    const open = await query(
      `SELECT count(*)::int AS n FROM blockers WHERE project_id=$1 AND status<>'resolved'`, [id]);
    return NextResponse.json({ success: true, data: { detected, resolved, open_total: open.rows[0].n } });
  } catch (error) {
    console.error('[Diagnose] error:', error);
    return NextResponse.json({ success: false, error: 'Diagnosis failed' }, { status: 500 });
  }
}
