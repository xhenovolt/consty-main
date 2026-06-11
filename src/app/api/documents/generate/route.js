import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';
import puppeteer from 'puppeteer';
import {
  generateUniqueDocumentId,
  substitutePlaceholders,
  generateVerificationToken,
  generateVerificationHash,
  formatDocumentWithBranding,
  extractPlaceholders,
  logDocumentGeneration,
} from '@/lib/document-generation.js';
import { getActiveBranding } from '@/lib/company-branding.js';

// POST /api/documents/generate
// Body: { template_id, document_type, recipient_name, recipient_email, placeholder_data, expires_in_days? }
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'documents.generate');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const {
      template_id,
      document_type = 'other',
      recipient_name,
      recipient_email,
      recipient_phone,
      placeholder_data = {},
      expires_in_days = 365,
      category_id,
      generate_pdf = false,
    } = await request.json();

    if (!template_id || !recipient_name) {
      return NextResponse.json(
        { success: false, error: 'template_id and recipient_name required' },
        { status: 400 }
      );
    }

    // Fetch template
    const templateRes = await query(
      `SELECT * FROM document_templates WHERE id = $1 AND is_active = TRUE`,
      [template_id]
    );
    if (!templateRes.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Template not found or inactive' },
        { status: 404 }
      );
    }
    const template = templateRes.rows[0];

    // Generate unique document ID
    const prefix = document_type.substring(0, 3).toUpperCase();
    const uniqueId = await generateUniqueDocumentId(prefix, query);

    // Generate verification tokens
    const verificationToken = generateVerificationToken();
    const verificationHash = generateVerificationHash(uniqueId);

    // Get branding
    const branding = await getActiveBranding();

    // Normalize placeholder data so common aliases work
    const normalizedPlaceholderData = {
      recipient_name,
      recipient_email,
      recipient_phone,
      applicant_name: placeholder_data.applicant_name ?? recipient_name,
      applicant_email: placeholder_data.applicant_email ?? recipient_email,
      applicant_phone: placeholder_data.applicant_phone ?? recipient_phone,
      ...placeholder_data,
    };

    // Substitute placeholders in template
    const substitutedContent = substitutePlaceholders(template.body, normalizedPlaceholderData);

    // Format with branding (QR will be added after PDF generation in real scenario)
    const htmlContent = formatDocumentWithBranding(substitutedContent, branding, {
      includeQr: false,
      documentId: uniqueId,
    });

    // Calculate expiration
    const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null;

    // Create generated document record
    const genDocRes = await query(
      `INSERT INTO generated_documents (
        template_id, branding_id, unique_id, title, document_type,
        recipient_name, recipient_email, recipient_phone,
        placeholder_data, verification_token, verification_hash,
        category_id, generated_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        template_id,
        branding.id,
        uniqueId,
        template.name,
        document_type,
        recipient_name,
        recipient_email,
        recipient_phone,
        JSON.stringify(placeholder_data),
        verificationToken,
        verificationHash,
        category_id || null,
        auth.userId,
        expiresAt,
      ]
    );

    const generatedDoc = genDocRes.rows[0];

    // Log generation start
    await logDocumentGeneration(query, generatedDoc.id, 'info', 'generation_start', `Document generated for ${recipient_name}`, {}, auth.userId);

    // Generate PDF if requested
    let pdfUrl = null;
    if (generate_pdf) {
      try {
        // Generate QR code data URL (placeholder)
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${uniqueId}`;
        const qrDataUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;

        // Format document with branding and QR
        const htmlContent = formatDocumentWithBranding(substitutedContent, branding, {
          includeQr: true,
          qrDataUrl,
          documentId: uniqueId,
        });

        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
          }
        });

        await browser.close();

        // In a real implementation, upload PDF to storage and get URL
        // For now, we'll store a placeholder URL
        pdfUrl = `/api/documents/pdf/${uniqueId}`; // Point to our PDF API

        // Update document with PDF URL
        await query(
          `UPDATE generated_documents SET pdf_url = $1 WHERE id = $2`,
          [pdfUrl, generatedDoc.id]
        );

      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
        // Continue without PDF - don't fail the whole request
      }
    }

    // Dispatch event
    dispatch('document_generated', {
      entityType: 'generated_document',
      entityId: generatedDoc.id,
      description: `Generated ${document_type} for ${recipient_name}`,
      actorId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: generatedDoc.id,
        unique_id: generatedDoc.unique_id,
        verification_token: generatedDoc.verification_token,
        verification_hash: generatedDoc.verification_hash,
        recipient_name: generatedDoc.recipient_name,
        recipient_email: generatedDoc.recipient_email,
        document_type: generatedDoc.document_type,
        generated_at: generatedDoc.generated_at,
        expires_at: generatedDoc.expires_at,
        pdf_url: pdfUrl,
        verification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${generatedDoc.unique_id}`,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Documents/Generate] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate document: ' + error.message },
      { status: 500 }
    );
  }
}

// GET /api/documents/generate
// List generated documents (admin only)
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view_generated');
    if (perm instanceof NextResponse) return perm;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const documentType = searchParams.get('document_type');
    const recipientEmail = searchParams.get('recipient_email');

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (documentType) {
      where += ` AND document_type = $${paramIndex}`;
      params.push(documentType);
      paramIndex++;
    }
    if (recipientEmail) {
      where += ` AND recipient_email ILIKE $${paramIndex}`;
      params.push(`%${recipientEmail}%`);
      paramIndex++;
    }

    const countRes = await query(
      `SELECT COUNT(*) as total FROM generated_documents ${where}`,
      params
    );

    const dataRes = await query(
      `SELECT id, unique_id, title, document_type, recipient_name, recipient_email,
              generated_at, viewed_count, last_viewed_at, expires_at, is_revoked
       FROM generated_documents ${where}
       ORDER BY generated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: dataRes.rows,
      total: countRes.rows[0].total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Documents/Generate] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
