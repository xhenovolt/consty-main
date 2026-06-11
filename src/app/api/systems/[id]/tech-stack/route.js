import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/systems/[id]/tech-stack
 * Fetch tech stack for a system
 */
export async function GET(req, { params }) {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const stackId = searchParams.get('stackId');
  
  try {
    if (stackId) {
      // Get specific tech stack entry
      const result = await pool.query(
        'SELECT * FROM system_tech_stack WHERE id = $1 AND system_id = $2',
        [stackId, id]
      );
      return NextResponse.json(result.rows[0] || null);
    } else {
      // Get all tech stack entries for system
      const result = await pool.query(
        'SELECT * FROM system_tech_stack WHERE system_id = $1 ORDER BY created_at DESC',
        [id]
      );
      return NextResponse.json(result.rows || []);
    }
  } catch (error) {
    console.error('Error fetching tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tech stack' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/systems/[id]/tech-stack
 * Add/update tech stack for a system
 */
export async function POST(req, { params }) {
  const { id } = params;
  const { language, framework, database, platform, notes } = await req.json();
  
  try {
    const result = await pool.query(
      `INSERT INTO system_tech_stack (system_id, language, framework, database, platform, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, language, framework, database, platform, notes]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to create tech stack: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/systems/[id]/tech-stack?stackId=X
 * Update tech stack entry
 */
export async function PUT(req, { params }) {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const stackId = searchParams.get('stackId');
  
  if (!stackId) {
    return NextResponse.json(
      { error: 'stackId query parameter required' },
      { status: 400 }
    );
  }
  
  const { language, framework, database, platform, notes } = await req.json();
  
  try {
    const result = await pool.query(
      `UPDATE system_tech_stack 
       SET language = COALESCE($2, language),
           framework = COALESCE($3, framework),
           database = COALESCE($4, database),
           platform = COALESCE($5, platform),
           notes = COALESCE($6, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND system_id = $7
       RETURNING *`,
      [stackId, language, framework, database, platform, notes, id]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Tech stack entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to update tech stack: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/systems/[id]/tech-stack?stackId=X
 * Delete tech stack entry
 */
export async function DELETE(req, { params }) {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const stackId = searchParams.get('stackId');
  
  if (!stackId) {
    return NextResponse.json(
      { error: 'stackId query parameter required' },
      { status: 400 }
    );
  }
  
  try {
    const result = await pool.query(
      'DELETE FROM system_tech_stack WHERE id = $1 AND system_id = $2 RETURNING id',
      [stackId, id]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Tech stack entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to delete tech stack: ' + error.message },
      { status: 500 }
    );
  }
}
