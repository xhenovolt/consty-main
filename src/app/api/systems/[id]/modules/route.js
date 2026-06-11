import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/systems/[id]/modules — Get modules for a system
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'systems.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    
    const result = await query(
      `SELECT * FROM system_modules 
       WHERE system_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );
    
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[System Modules] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch modules' }, { status: 500 });
  }
}

// POST /api/systems/[id]/modules — Add module
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'systems.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    const body = await request.json();
    const { module_name, description, status, module_url, version } = body;
    
    if (!module_name) {
      return NextResponse.json({ success: false, error: 'module_name is required' }, { status: 400 });
    }
    
    // Validate system exists
    const systemCheck = await query('SELECT id FROM systems WHERE id = $1', [id]);
    if (!systemCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }
    
    const result = await query(
      `INSERT INTO system_modules
       (system_id, module_name, description, status, module_url, version)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, module_name, description || null, status || 'active', module_url || null, version || null]
    );
    
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[System Modules] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create module' }, { status: 500 });
  }
}
