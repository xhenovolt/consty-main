/**
 * GET /api/users/search
 * Search for users by email or name for autocomplete
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'users.view');
    if (perm instanceof NextResponse) return perm;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    // If search is empty, return empty list
    if (!search || search.trim().length < 2) {
      return Response.json({
        success: true,
        data: [],
      });
    }

    const searchTerm = `%${search}%`;

    const result = await query(
      `SELECT 
        id,
        email,
        COALESCE(full_name, email) as full_name,
        status
      FROM users
      WHERE (email ILIKE $1 OR COALESCE(full_name, '') ILIKE $1)
        AND status = 'active'
      ORDER BY CASE 
        WHEN email ILIKE $2 THEN 0
        WHEN COALESCE(full_name, '') ILIKE $2 THEN 1
        ELSE 2
      END,
      full_name ASC
      LIMIT $3`,
      [searchTerm, `${search}%`, limit]
    );

    return Response.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Users search error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
