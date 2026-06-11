import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/systems/[id]/tech-profiles/[profileId]
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'systems.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id, profileId } = params;
    
    const result = await query(
      `SELECT * FROM system_tech_profiles 
       WHERE id = $1 AND system_id = $2`,
      [profileId, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Tech profile not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Tech Profile Detail] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tech profile' }, { status: 500 });
  }
}

// PATCH /api/systems/[id]/tech-profiles/[profileId]
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'systems.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id, profileId } = params;
    const body = await request.json();
    const {
      language, framework, framework_version, database, db_version,
      platform, hosting, deployment_url, notes
    } = body;
    
    const result = await query(
      `UPDATE system_tech_profiles
       SET language = COALESCE($1, language),
           framework = COALESCE($2, framework),
           framework_version = COALESCE($3, framework_version),
           database = COALESCE($4, database),
           db_version = COALESCE($5, db_version),
           platform = COALESCE($6, platform),
           hosting = COALESCE($7, hosting),
           deployment_url = COALESCE($8, deployment_url),
           notes = COALESCE($9, notes),
           updated_at = NOW()
       WHERE id = $10 AND system_id = $11
       RETURNING *`,
      [language, framework, framework_version, database, db_version,
       platform, hosting, deployment_url, notes, profileId, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Tech profile not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Tech Profile Detail] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update tech profile' }, { status: 500 });
  }
}

// DELETE /api/systems/[id]/tech-profiles/[profileId]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'systems.delete');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id, profileId } = params;
    
    const result = await query(
      `DELETE FROM system_tech_profiles
       WHERE id = $1 AND system_id = $2
       RETURNING id`,
      [profileId, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Tech profile not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: { id: profileId } });
  } catch (error) {
    console.error('[Tech Profile Detail] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete tech profile' }, { status: 500 });
  }
}
