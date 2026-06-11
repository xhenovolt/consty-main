import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/admin/staff/create-with-account
 * Create staff with user account in a single transaction
 */
export async function POST(req) {
  const client = await pool.connect();
  
  try {
    const { staff_name, staff_email, username, password, role_name, department_id } = await req.json();
    
    if (!staff_name || !staff_email || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    await client.query('BEGIN');
    
    try {
      // 1. Get or create role
      let roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [role_name || 'staff']
      );
      
      let role_id = roleResult.rows[0]?.id;
      if (!role_id) {
        roleResult = await client.query(
          'INSERT INTO roles (name) VALUES ($1) RETURNING id',
          [role_name || 'staff']
        );
        role_id = roleResult.rows[0].id;
      }
      
      // 2. Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // 3. Create user
      const userResult = await client.query(
        `INSERT INTO users (username, email, password, role, role_id, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING id`,
        [username, staff_email, passwordHash, role_name || 'staff', role_id]
      );
      
      const user_id = userResult.rows[0].id;
      
      // 4. Create staff record
      const staffResult = await client.query(
        `INSERT INTO staff (name, email, user_id, linked_user_id, role_id, department_id, account_status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP)
         RETURNING *`,
        [staff_name, staff_email, user_id, user_id, role_id, department_id]
      );
      
      // 5. Assign role permissions
      const permResult = await client.query(
        'SELECT permission_id FROM role_permissions WHERE role_id = $1',
        [role_id]
      );
      
      if (permResult.rowCount === 0) {
        // Assign default permissions for the role
        const defaultPerms = await client.query(
          'SELECT id FROM permissions WHERE role_default = $1',
          [role_name || 'staff']
        );
        
        for (const perm of defaultPerms.rows) {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [role_id, perm.id]
          );
        }
      }
      
      // Log the creation
      await client.query(
        `INSERT INTO system_logs (level, module, action, message, details, user_id)
         VALUES ('info', 'staff_management', 'staff_created_with_account', $1, $2, NULL)`,
        [
          `Staff ${staff_name} created with user account`,
          JSON.stringify({ staff_id: staffResult.rows[0].id, user_id, username })
        ]
      );
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        staff: staffResult.rows[0],
        user_id
      }, { status: 201 });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating staff with account:', error);
    return NextResponse.json(
      { error: 'Failed to create staff: ' + error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
