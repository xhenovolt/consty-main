import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/systems/[id]/modules/[moduleId]
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'systems.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id, moduleId } = params;
    
    const result = await query(
      `SELECT * FROM system_modules 
       WHERE id = $1 AND system_id = $2`,
      [moduleId, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[System Module Detail] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch module' }, { status: 500 });
  }
}

// PATCH /api/systems/[id]/modules/[moduleId]
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'systems.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id, moduleId } = params;
    const body = await request.json();
    const { module_name, description, status, module_url, version } = body;
    
    const result = await query(
      `UPDATE system_modules
       SET module_name = COALESCE($1, module_name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           module_url = COALESCE($4, module_url),
           version = COALESCE($5, version),
           updated_at = NOW()
       WHERE id = $6 AND system_id = $7
       RETURNING *`,
      [module_name, description, status, module_url, version, moduleId, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[System Module Detail] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update module' }, { status: 500 });
  }
}

// DELETE /api/systems/[id]/modules/[moduleId]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'systems.delete');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id, moduleId } = params;
    
    const result = await query(
      `DELETE FROM system_modules
       WHERE id = $1 AND system_id = $2
       RETURNING id`,
      [moduleId, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: { id: moduleId } });
  } catch (error) {
    console.error('[System Module Detail] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete module' }, { status: 500 });
  }
}
