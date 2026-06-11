import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';

// GET /api/profile/completion — { percent, missing[], filled[] }
//
// Profile completion is computed from a fixed set of fields. Each scores
// equally. This is purely informational — there is no enforcement, only
// a UX hint on the profile page ("Your profile is 60% complete").
const FIELDS = [
  { key: 'full_name',         label: 'Full name' },
  { key: 'profile_image_url', label: 'Profile picture',  alt: 'avatar_id' },
  { key: 'bio',               label: 'Bio' },
  { key: 'phone',             label: 'Phone' },
  { key: 'timezone',          label: 'Timezone' },
  { key: 'department',        label: 'Department' },
];

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const r = await query(
      `SELECT full_name, profile_image_url, avatar_id, bio, phone, timezone, department
       FROM users WHERE id = $1`,
      [user.id]
    );
    if (!r.rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const u = r.rows[0];

    const filled  = [];
    const missing = [];
    for (const f of FIELDS) {
      const val = u[f.key] || (f.alt && u[f.alt]);
      if (val && String(val).trim()) filled.push(f.label);
      else missing.push(f.label);
    }
    const percent = Math.round((filled.length / FIELDS.length) * 100);
    return NextResponse.json({ success: true, percent, filled, missing });
  } catch (err) {
    if (err.message === 'Not authenticated') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    console.error('[profile.completion]', err);
    return NextResponse.json({ error: 'Failed to compute completion' }, { status: 500 });
  }
}
