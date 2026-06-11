import crypto from 'crypto';

// Generate unique document ID: XTN-PREFIX-YEAR-SEQUENCE
export async function generateUniqueDocumentId(prefix, query) {
  const year = new Date().getFullYear();
  const prefixUpper = prefix.toUpperCase();
  const pattern = `XTN-${prefixUpper}-${year}-%`;

  const result = await query(
    `SELECT COUNT(*) as count FROM generated_documents
     WHERE unique_id LIKE $1`,
    [pattern]
  );

  const sequence = (result.rows[0]?.count || 0) + 1;
  const paddedSeq = String(sequence).padStart(4, '0');
  return `XTN-${prefixUpper}-${year}-${paddedSeq}`;
}

// Substitute template placeholders with actual data
export function substitutePlaceholders(template, data) {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
  });
  return result;
}

// Generate verification token: base64(random 32 bytes)
export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate verification hash: SHA256(unique_id + secret)
export function generateVerificationHash(uniqueId, secret = process.env.VERIFICATION_SECRET || 'default-secret') {
  const input = `${uniqueId}:${secret}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Validate verification hash against unique_id
export function validateVerificationHash(uniqueId, hash, secret = process.env.VERIFICATION_SECRET || 'default-secret') {
  const expectedHash = generateVerificationHash(uniqueId, secret);
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}

// Verify document is valid (not revoked, not expired)
export function isDocumentValid(doc) {
  if (doc.is_revoked) return false;
  if (doc.expires_at && new Date(doc.expires_at) < new Date()) return false;
  return true;
}

// Extract placeholder variables from template
export function extractPlaceholders(template) {
  const regex = /\{\{(\w+)\}\}/g;
  const placeholders = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1]);
    }
  }
  return placeholders;
}

// Format document content with branding HTML
export function formatDocumentWithBranding(content, branding, options = {}) {
  const { includeQr = true, qrDataUrl = null, documentId = '' } = options;

  const headerStyle = `
    background: linear-gradient(135deg, ${branding.primary_color} 0%, ${branding.secondary_color} 100%);
    color: white;
    padding: 40px;
    text-align: center;
    border-bottom: 3px solid ${branding.accent_color};
  `;

  const containerStyle = `
    max-width: 900px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    line-height: 1.6;
    color: #1F2937;
  `;

  const bodyStyle = `
    padding: 60px 40px;
    min-height: 600px;
  `;

  const footerStyle = `
    border-top: 1px solid #E5E7EB;
    padding: 30px 40px;
    background: #F9FAFB;
    font-size: 12px;
    color: #6B7280;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  `;

  const qrSection = includeQr && qrDataUrl ? `
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #D1D5DB;">
      <p style="color: #6B7280; font-size: 12px; margin-bottom: 10px;">Verify authenticity:</p>
      <img src="${qrDataUrl}" alt="Verification QR Code" style="width: 200px; height: 200px;" />
      <p style="color: #6B7280; font-size: 11px; margin-top: 10px;">ID: ${documentId}</p>
    </div>
  ` : '';

  const logo = branding.logo_url ? `
    <img src="${branding.logo_url}" alt="Logo" style="height: ${branding.logo_height}px; width: ${branding.logo_width}px; margin-bottom: 20px;" />
  ` : '';

  const signature = branding.signature_url ? `
    <div style="margin-top: 60px; display: inline-block; text-align: center;">
      <img src="${branding.signature_url}" alt="Signature" style="height: 100px; margin-bottom: 10px;" />
      <div style="border-top: 1px solid #1F2937; padding-top: 8px; min-width: 200px;">
        <p style="margin: 0; font-weight: 500;">${branding.signature_name || 'Authorized Signatory'}</p>
        <p style="margin: 0; font-size: 12px; color: #6B7280;">${branding.signature_title || ''}</p>
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Official Document</title>
    </head>
    <body style="margin: 0; padding: 0; background: white;">
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          ${logo}
          <h1 style="margin: 10px 0; font-size: 28px;">${branding.organization_name}</h1>
          ${branding.header_text ? `<p style="margin: 5px 0; font-size: 14px;">${branding.header_text}</p>` : ''}
        </div>

        <div style="${bodyStyle}">
          ${content}
          ${signature}
          ${qrSection}
        </div>

        <div style="${footerStyle}">
          <div>
            <p style="margin: 0;">${branding.organization_name}</p>
            ${branding.address_line1 ? `<p style="margin: 4px 0; font-size: 11px;">${branding.address_line1}</p>` : ''}
            ${branding.city ? `<p style="margin: 4px 0; font-size: 11px;">${branding.city}${branding.postal_code ? ', ' + branding.postal_code : ''}</p>` : ''}
          </div>
          <div style="text-align: right;">
            ${branding.phone ? `<p style="margin: 0;">Tel: ${branding.phone}</p>` : ''}
            ${branding.email ? `<p style="margin: 4px 0;">Email: ${branding.email}</p>` : ''}
            ${branding.website ? `<p style="margin: 4px 0;">Web: ${branding.website}</p>` : ''}
            <p style="margin: 8px 0 0 0; font-size: 10px;">Generated: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Log document generation event
export async function logDocumentGeneration(query, generatedDocId, level, phase, message, details = {}, actorId = null) {
  return query(
    `INSERT INTO generated_document_logs (generated_document_id, level, phase, message, details, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [generatedDocId, level, phase, message, JSON.stringify(details), actorId]
  );
}
