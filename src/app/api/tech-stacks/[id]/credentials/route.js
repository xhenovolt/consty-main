import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import crypto from 'crypto';

// Simple encryption for credentials (in production, use a proper key management service)
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || '0'.repeat(32);

function encryptValue(value) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32)), iv);
  let encrypted = cipher.update(value, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptValue(encrypted) {
  const [iv, encryptedData] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32)), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;

    const result = await query(
      `SELECT id, key_name, description, created_at 
       FROM tech_stack_credentials 
       WHERE tech_stack_id = $1
       ORDER BY created_at`,
      [id]
    );

    // Return only metadata, never the encrypted value
    return NextResponse.json({ credentials: result.rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const { key_name, value, description } = await request.json();

    if (!key_name || !value) {
      return NextResponse.json({ error: 'Key name and value required' }, { status: 400 });
    }

    const encryptedValue = encryptValue(value);

    const result = await query(
      `INSERT INTO tech_stack_credentials (tech_stack_id, key_name, value_encrypted, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, key_name, description, created_at`,
      [id, key_name, encryptedValue, description]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
