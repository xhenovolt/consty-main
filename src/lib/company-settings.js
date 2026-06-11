import { query } from '@/lib/db.js';

const DEFAULTS = {
  company_name:         'Consty',
  company_tagline:      'Construction delivery, procurement, and project control in one workspace',
  company_address:      '',
  company_phone_1:      '',
  company_phone_2:      '',
  company_phone_3:      '',
  company_email:        '',
  company_website:      '',
  company_logo:         '',
  company_tin:          '',
  company_registration: '',
};

/**
 * Fetch all company settings from DB.
 * Falls back to DEFAULTS if the table does not exist yet.
 * @returns {Promise<typeof DEFAULTS>}
 */
export async function getCompanySettings() {
  try {
    const res = await query('SELECT key, value FROM company_settings');
    const s = { ...DEFAULTS };
    for (const row of res.rows) {
      s[row.key] = row.value ?? '';
    }
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}
