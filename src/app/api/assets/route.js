import { NextResponse } from 'next/server';

// DEPRECATED: Assets merged into unified Items table (migration 302)

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Assets API deprecated. Use /api/items?view=assets instead.',
    redirect: '/api/items?view=assets',
  }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Assets API deprecated. Use POST /api/items instead.',
    redirect: '/api/items',
  }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: 'Assets API deprecated. Use DELETE /api/items instead.',
    redirect: '/api/items',
  }, { status: 410 });
}
