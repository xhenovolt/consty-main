import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/systems/[id]/tech-profiles — Get tech stack for a system
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'systems.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    
    const result = await query(
      `SELECT * FROM system_tech_profiles 
       WHERE system_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );
    
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Tech Profiles] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tech profiles' }, { status: 500 });
  }
}

// POST /api/systems/[id]/tech-profiles — Add tech stack profile
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'systems.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    const body = await request.json();
    const {
      language, framework, framework_version, database, db_version,
      platform, hosting, deployment_url, notes
    } = body;
    
    // Validate system exists
    const systemCheck = await query('SELECT id FROM systems WHERE id = $1', [id]);
    if (!systemCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }
    
    const result = await query(
      `INSERT INTO system_tech_profiles
       (system_id, language, framework, framework_version, database, db_version,
        platform, hosting, deployment_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, language || null, framework || null, framework_version || null,
       database || null, db_version || null, platform || null,
       hosting || null, deployment_url || null, notes || null]
    );
    
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Tech Profiles] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create tech profile' }, { status: 500 });
  }
}
