import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/admin/data-consistency/scan
 * Scan database for orphaned and inconsistent records
 */
export async function GET(req) {
  try {
    const results = {};
    
    // Check orphaned users
    const orphanedUsers = await pool.query(`
      SELECT COUNT(*) as count FROM v_orphaned_users
    `);
    results.orphaned_users = orphanedUsers.rows[0].count;
    
    // Check orphaned staff
    const orphanedStaff = await pool.query(`
      SELECT COUNT(*) as count FROM v_orphaned_staff
    `);
    results.orphaned_staff = orphanedStaff.rows[0].count;
    
    // Check invalid roles
    const invalidRoles = await pool.query(`
      SELECT COUNT(*) as count FROM v_invalid_roles
    `);
    results.invalid_roles = invalidRoles.rows[0].count;
    
    // Check inconsistent currencies
    const inconsistentCurrencies = await pool.query(`
      SELECT COUNT(*) as count FROM v_inconsistent_currencies
    `);
    results.inconsistent_currencies = inconsistentCurrencies.rows[0].count;
    
    // Check NULL descriptions in operations_log
    const nullDescriptions = await pool.query(`
      SELECT COUNT(*) as count FROM operations_log WHERE description IS NULL OR TRIM(description) = ''
    `);
    results.null_operation_descriptions = nullDescriptions.rows[0].count;
    
    return NextResponse.json({
      success: true,
      scan_results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error scanning data consistency:', error);
    return NextResponse.json(
      { error: 'Failed to scan data consistency: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/data-consistency/fix
 * Fix known data consistency issues
 */
export async function POST(req) {
  const { issue_type } = await req.json();
  
  try {
    const result = await pool.query('SELECT * FROM cleanup_orphaned_records()');
    
    // Fix NULL descriptions
    await pool.query(`
      UPDATE operations_log 
      SET description = COALESCE(NULLIF(TRIM(description), ''), 'Operation completed')
      WHERE description IS NULL OR TRIM(description) = ''
    `);
    
    // Fix inconsistent currencies by setting to UGX
    await pool.query(`
      UPDATE payments 
      SET currency = 'UGX'
      WHERE currency IS NULL
    `);
    
    return NextResponse.json({
      success: true,
      message: 'Data consistency fixes applied',
      results: result.rows
    });
  } catch (error) {
    console.error('Error fixing data consistency:', error);
    return NextResponse.json(
      { error: 'Failed to fix data consistency: ' + error.message },
      { status: 500 }
    );
  }
}
