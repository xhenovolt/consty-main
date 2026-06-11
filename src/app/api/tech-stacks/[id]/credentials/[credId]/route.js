import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id, credId } = params;

    const result = await query(
      `DELETE FROM tech_stack_credentials WHERE id = $1 AND tech_stack_id = $2 RETURNING id`,
      [credId, id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
