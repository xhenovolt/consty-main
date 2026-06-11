import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/follow-ups
 * Get all follow-ups (now fetching from centralized table)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const prospectId = searchParams.get('prospect_id');
    const userId = searchParams.get('user_id');
    const status = searchParams.get('status');
    
    let query = `
      SELECT 
        f.*,
        p.name as prospect_name,
        p.email as prospect_email,
        u.username as user_username
      FROM follow_ups f
      LEFT JOIN prospects p ON f.prospect_id = p.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE 1 = 1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (prospectId) {
      query += ` AND f.prospect_id = $${paramIndex++}`;
      params.push(prospectId);
    }
    if (userId) {
      query += ` AND f.user_id = $${paramIndex++}`;
      params.push(userId);
    }
    if (status) {
      query += ` AND f.status = $${paramIndex++}`;
      params.push(status);
    }
    
    query += ' ORDER BY f.created_at DESC';
    
    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch follow-ups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/follow-ups
 * Create a new follow-up
 */
export async function POST(req) {
  const { prospect_id, user_id, description, status, follow_up_date } = await req.json();
  
  if (!prospect_id) {
    return NextResponse.json(
      { error: 'prospect_id is required' },
      { status: 400 }
    );
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO follow_ups (prospect_id, user_id, description, status, follow_up_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [prospect_id, user_id, description, status || 'pending', follow_up_date]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating follow-up:', error);
    return NextResponse.json(
      { error: 'Failed to create follow-up: ' + error.message },
      { status: 500 }
    );
  }
}
