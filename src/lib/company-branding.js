import { query } from './db.js';

/**
 * Single source of truth for organisational branding used by the documents
 * module (templates, generation, PDFs, public verification page).
 *
 * Historically we had TWO parallel tables:
 *   - `company_settings` (key/value)  — written by /app/settings/company,
 *     holds: company_name, company_logo (data-URL), company_address,
 *     company_email, company_phone_1, company_website, …
 *   - `company_branding` (one row)    — written by the documents Settings
 *     page, holds: organization_name, logo_url, signature_url, colors,
 *     header/footer text, etc.
 *
 * The two diverged: a user updating their company name in
 * /app/settings/company would not see it on a generated document because
 * documents read from `company_branding`. This module makes
 * `company_settings` the canonical source for the OVERLAP (name, logo,
 * address, phone, email, website, tagline) and falls back to
 * `company_branding` for the documents-only extras (signatures, colors,
 * footer text). The full merged shape is returned, so existing callers
 * (formatDocumentWithBranding, PDF generation, seeds) keep working.
 */

let brandingCache = null;
let brandingCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SETTINGS_TO_BRANDING = {
  company_name:    'organization_name',
  company_logo:    'logo_url',
  company_tagline: 'header_text',
  company_address: 'address_line1',
  company_phone_1: 'phone',
  company_email:   'email',
  company_website: 'website',
};

async function loadCompanySettings() {
  try {
    const r = await query('SELECT key, value FROM company_settings');
    const out = {};
    for (const row of r.rows) out[row.key] = row.value || null;
    return out;
  } catch {
    // company_settings table may not exist on older deployments
    return {};
  }
}

async function loadCompanyBranding() {
  try {
    const r = await query(
      `SELECT * FROM company_branding WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
    );
    return r.rows[0] || null;
  } catch {
    // company_branding might not exist either; fall back to defaults
    return null;
  }
}

export async function getActiveBranding(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && brandingCache && (now - brandingCacheTime) < CACHE_TTL) {
    return brandingCache;
  }

  const [settings, branding] = await Promise.all([
    loadCompanySettings(),
    loadCompanyBranding(),
  ]);

  // Start from defaults so the shape is always complete, layer the
  // documents-only branding row (signatures, colors, etc.) on top, then
  // let company_settings WIN for the overlap fields. This gives staff one
  // place to edit name / logo / contact details.
  const merged = { ...getDefaultBranding(), ...(branding || {}) };
  for (const [settingsKey, brandingKey] of Object.entries(SETTINGS_TO_BRANDING)) {
    if (settings[settingsKey]) merged[brandingKey] = settings[settingsKey];
  }
  // Country wasn't in the legacy mapping but exists in company_settings under
  // company_address. Keep what's there.
  if (settings.company_registration && !merged.organization_slug) {
    merged.organization_slug = settings.company_registration.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  brandingCache = merged;
  brandingCacheTime = now;
  return brandingCache;
}

/**
 * Invalidate the in-process cache. Called by /api/settings/company PATCH
 * and /api/documents/branding PUT so a fresh edit shows up on the next
 * document generation without a process restart.
 */
export function invalidateBrandingCache() {
  brandingCache = null;
  brandingCacheTime = 0;
}

export function getDefaultBranding() {
  return {
    id: null,
    organization_name: 'CONSTY',
    organization_slug: 'consty',
    logo_url: null,
    logo_width: 100,
    logo_height: 100,
    header_text: 'Construction Operations Platform',
    footer_text: 'Project authenticity verified',
    signature_url: null,
    signature_name: 'Project Director',
    signature_title: 'Authorized Representative',
    address_line1: null,
    address_line2: null,
    city: null,
    postal_code: null,
    country: null,
    phone: null,
    email: null,
    website: null,
    primary_color: '#1f2937',
    secondary_color: '#d97706',
    accent_color: '#0f766e',
  };
}

export async function updateBranding(data, userId) {
  // Ensure only one active branding record (excluding the one we're updating)
  await query(
    `UPDATE company_branding SET is_active = FALSE WHERE is_active = TRUE AND id != $1`,
    [data.id || null]
  );

  const result = await query(
    `INSERT INTO company_branding (
      organization_name, organization_slug, logo_url, logo_width, logo_height,
      header_text, footer_text, signature_url, signature_name, signature_title,
      address_line1, address_line2, city, postal_code, country, phone, email, website,
      primary_color, secondary_color, accent_color, is_active, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
     ON CONFLICT (organization_slug) DO UPDATE SET
      logo_url = $3, logo_width = $4, logo_height = $5,
      header_text = $6, footer_text = $7, signature_url = $8, signature_name = $9, signature_title = $10,
      address_line1 = $11, address_line2 = $12, city = $13, postal_code = $14, country = $15,
      phone = $16, email = $17, website = $18,
      primary_color = $19, secondary_color = $20, accent_color = $21, is_active = $22, updated_by = $23, updated_at = NOW()
     RETURNING *`,
    [
      data.organization_name || 'CONSTY',
      data.organization_slug || 'consty',
      data.logo_url || null,
      data.logo_width || 100,
      data.logo_height || 100,
      data.header_text || null,
      data.footer_text || null,
      data.signature_url || null,
      data.signature_name || null,
      data.signature_title || null,
      data.address_line1 || null,
      data.address_line2 || null,
      data.city || null,
      data.postal_code || null,
      data.country || null,
      data.phone || null,
      data.email || null,
      data.website || null,
      data.primary_color || '#1F2937',
      data.secondary_color || '#3B82F6',
      data.accent_color || '#10B981',
      data.is_active !== false,
      userId
    ]
  );

  invalidateBrandingCache();
  return result.rows[0];
}

export async function getBrandingHistory() {
  return query(
    `SELECT * FROM company_branding ORDER BY updated_at DESC LIMIT 20`
  );
}
