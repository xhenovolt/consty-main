import { NextResponse } from 'next/server';

// DEPRECATED: Resources merged into unified Items table (migration 302)

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Resources API deprecated. Use /api/items?view=tools or /api/items?view=infrastructure instead.',
    redirect: '/api/items',
  }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Resources API deprecated. Use POST /api/items instead.',
    redirect: '/api/items',
  }, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json({
    success: false,
    error: 'Resources API deprecated. Use PATCH /api/items instead.',
    redirect: '/api/items',
  }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: 'Resources API deprecated. Use DELETE /api/items instead.',
    redirect: '/api/items',
  }, { status: 410 });
}
