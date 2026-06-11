/**
 * Username Suggestions API
 * POST: Get username suggestions when desired username is taken
 */

import { query } from '@/lib/db';



function generateVariations(username) {
  const variations = [];

  // Original
  variations.push(username);

  // Add numbers
  for (let i = 1; i <= 99; i++) {
    variations.push(`${username}${i}`);
  }

  // Remove/add characters
  if (username.length > 3) {
    variations.push(username.slice(1)); // Remove first character
    variations.push(username.slice(0, -1)); // Remove last character
  }

  // Add common suffixes
  variations.push(`${username}_pro`);
  variations.push(`${username}_dev`);
  variations.push(`${username}_official`);

  // First letter + last name variations
  if (username.includes('.')) {
    variations.push(username.replace('.', ''));
  }

  return variations;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || username.length < 3) {
      return Response.json(
        { success: false, error: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    const variations = generateVariations(username);
    const available = [];

    for (const variation of variations) {
      const check = await query(
        'SELECT id FROM users WHERE username = $1',
        [variation]
      );

      if (check.rowCount === 0) {
        available.push(variation);
        if (available.length >= 10) break;
      }
    }

    return Response.json({
      success: true,
      requested: username,
      is_available: available[0] === username,
      suggestions: available.slice(0, 10),
    });
  } catch (error) {
    console.error('Username suggestions error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
