import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import puppeteer from 'puppeteer';
import {
  validateVerificationHash,
  isDocumentValid,
  formatDocumentWithBranding,
} from '@/lib/document-generation.js';
import { getActiveBranding } from '@/lib/company-branding.js';

// GET /api/documents/pdf/[id] - Generate PDF for document
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Fetch document
    const docRes = await query(
      `SELECT gd.*, dt.body as template_body, dt.variables
       FROM generated_documents gd
       JOIN document_templates dt ON gd.template_id = dt.id
       WHERE gd.unique_id = $1`,
      [id]
    );

    if (!docRes.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const document = docRes.rows[0];

    // Check if document is valid
    if (!isDocumentValid(document)) {
      return NextResponse.json(
        { success: false, error: 'Document is no longer valid' },
        { status: 410 }
      );
    }

    // If PDF already exists, return it
    if (document.pdf_url) {
      // In a real implementation, you'd redirect to the stored PDF
      // For now, we'll regenerate
    }

    // Get branding
    const branding = document.branding_id
      ? await query(`SELECT * FROM document_branding WHERE id = $1`, [document.branding_id])
        .then(r => r.rows[0])
      : await getActiveBranding();

    if (!branding) {
      return NextResponse.json(
        { success: false, error: 'Branding configuration not found' },
        { status: 500 }
      );
    }

    // Generate QR code data URL (simplified - in real app you'd use a QR library)
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${document.unique_id}`;
    const qrDataUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`; // Placeholder

    // Format document with branding and QR
    const htmlContent = formatDocumentWithBranding(
      document.template_body,
      branding,
      {
        includeQr: true,
        qrDataUrl,
        documentId: document.unique_id,
      }
    );

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

    // Update document with PDF URL (in real app, upload to storage)
    // For now, we'll just return the PDF directly

    // Log PDF generation
    await query(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [
        document.id,
        'downloaded',
        perm.auth?.userId || null,
        JSON.stringify({ format: 'pdf', source: 'api' })
      ]
    );

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Documents/PDF] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}