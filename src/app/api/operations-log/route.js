import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/operations-log
 * Fetch operations log with filtering
 */
export async function GET(req) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const staff_id = searchParams.get('staff_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 500);
    
    let query = 'SELECT * FROM operations_log WHERE 1 = 1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (staff_id) {
      query += ` AND staff_id = $${paramIndex++}`;
      params.push(staff_id);
    }
    if (start_date) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching operations log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operations log' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/operations-log
 * Create new operation log entry
 */
export async function POST(req) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const {
      title,
      description,
      staff_id,
      department_id,
      status,
      started_at,
      completed_at,
      duration_ms
    } = await req.json();
    
    // Enforce non-null description
    if (!description || description.trim() === '') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }
    
    const result = await pool.query(
      `INSERT INTO operations_log (
        title, 
        description, 
        staff_id, 
        department_id, 
        status, 
        started_at,
        completed_at,
        duration_ms,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        title,
        description,
        staff_id,
        department_id,
        status || 'success',
        started_at,
        completed_at,
        duration_ms
      ]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating operations log:', error);
    return NextResponse.json(
      { error: 'Failed to create operation: ' + error.message },
      { status: 500 }
    );
  }
}
