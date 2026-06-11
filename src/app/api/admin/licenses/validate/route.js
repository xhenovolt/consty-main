import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/admin/licenses/validate
 * Validate license chain: Deal → Client → System → Plan → License
 */
export async function POST(req) {
  const { deal_id, client_id, system_id, plan_id } = await req.json();
  
  if (!deal_id || !client_id || !system_id || !plan_id) {
    return NextResponse.json(
      { error: 'Missing required fields: deal_id, client_id, system_id, plan_id' },
      { status: 400 }
    );
  }
  
  try {
    const errors = [];
    
    // 1. Verify deal exists and belongs to client
    const dealCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND client_id = $2',
      [deal_id, client_id]
    );
    
    if (dealCheck.rowCount === 0) {
      errors.push('Deal not found or does not belong to client');
    }
    
    // 2. Verify client exists
    const clientCheck = await pool.query(
      'SELECT id FROM clients WHERE id = $1',
      [client_id]
    );
    
    if (clientCheck.rowCount === 0) {
      errors.push('Client not found');
    }
    
    // 3. Verify system exists
    const systemCheck = await pool.query(
      'SELECT id FROM systems WHERE id = $1',
      [system_id]
    );
    
    if (systemCheck.rowCount === 0) {
      errors.push('System not found');
    }
    
    // 4. Verify plan exists and belongs to system
    const planCheck = await pool.query(
      'SELECT id FROM pricing_plans WHERE id = $1 AND system = $2',
      [plan_id, systemCheck.rows[0]?.id || system_id]
    );
    
    if (planCheck.rowCount === 0) {
      errors.push('Plan not found or does not belong to system');
    }
    
    if (errors.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          validation_errors: errors,
          validation_status: 'failed'
        },
        { status: 400 }
      );
    }
    
    // 5. Check for existing valid license
    const licenseCheck = await pool.query(
      `SELECT * FROM licenses 
       WHERE deal_id = $1 AND client_id = $2 AND system_id = $3 AND plan_id = $4
       AND status IN ('active', 'pending')`,
      [deal_id, client_id, system_id, plan_id]
    );
    
    if (licenseCheck.rowCount > 0) {
      return NextResponse.json({
        success: true,
        validation_status: 'valid',
        existing_license: licenseCheck.rows[0],
        message: 'Valid license already exists'
      });
    }
    
    return NextResponse.json({
      success: true,
      validation_status: 'ready_to_issue',
      message: 'All validation checks passed. Ready to issue license.'
    });
    
  } catch (error) {
    console.error('Error validating license:', error);
    return NextResponse.json(
      { error: 'Failed to validate license: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/licenses/issue
 * Issue a license after validation
 */
export async function PUT(req) {
  const { deal_id, client_id, system_id, plan_id } = await req.json();
  
  try {
    // First validate
    const validation = await fetch(new URL(req.url).origin + '/api/admin/licenses/validate', {
      method: 'POST',
      body: JSON.stringify({ deal_id, client_id, system_id, plan_id })
    });
    
    const validationResult = await validation.json();
    
    if (!validationResult.success) {
      return NextResponse.json(validationResult, { status: 400 });
    }
    
    if (validationResult.existing_license) {
      return NextResponse.json({
        success: true,
        license: validationResult.existing_license,
        message: 'License already exists'
      });
    }
    
    // Issue new license
    const result = await pool.query(
      `INSERT INTO licenses (deal_id, client_id, system_id, plan_id, status, validation_status, validated_at, auto_issued)
       VALUES ($1, $2, $3, $4, 'active', 'valid', CURRENT_TIMESTAMP, true)
       RETURNING *`,
      [deal_id, client_id, system_id, plan_id]
    );
    
    // Log
    await pool.query(
      `INSERT INTO system_logs (level, module, action, message, details)
       VALUES ('info', 'licenses', 'license_issued', $1, $2)`,
      [
        `License issued for client ${client_id}`,
        JSON.stringify({ deal_id, client_id, system_id, plan_id, license_id: result.rows[0].id })
      ]
    );
    
    return NextResponse.json({
      success: true,
      license: result.rows[0],
      message: 'License issued successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error issuing license:', error);
    return NextResponse.json(
      { error: 'Failed to issue license: ' + error.message },
      { status: 500 }
    );
  }
}
