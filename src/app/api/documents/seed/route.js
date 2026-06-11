import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { seedDocumentTemplates, seedMukunguHatimu } from '@/lib/seed-documents.js';

// POST /api/documents/seed
// Initialize document templates and sample data (admin only)
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'documents.create');
    if (perm instanceof NextResponse) return perm;

    const { type = 'all' } = await request.json().catch(() => ({}));

    const results = {};

    if (type === 'all' || type === 'templates') {
      results.templates = await seedDocumentTemplates();
    }

    if (type === 'all' || type === 'mukungu') {
      results.mukungu = await seedMukunguHatimu();
    }

    return NextResponse.json({
      success: true,
      message: 'Seed completed',
      results,
    });
  } catch (error) {
    console.error('[Documents/Seed] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Seed failed: ' + error.message },
      { status: 500 }
    );
  }
}
