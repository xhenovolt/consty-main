'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { renderDocumentBody } from '@/lib/doc-render';

/**
 * Public document verification page.
 *
 * Reached via the QR code embedded in printed documents, or by typing the
 * unique document ID into the verification portal. Renders:
 *
 *   1. A trust banner (Verified / Revoked / Expired / Not Found).
 *   2. The actual document content on an A4-sized white sheet, with the
 *      issuing organisation's branding, the document body (placeholders
 *      already substituted server-side), and a QR code that re-encodes
 *      the very URL the visitor is on. This means: print the page, hand
 *      it out, the recipient scans the QR and lands here again — the
 *      content they see should match what's on paper. That's the chain
 *      of trust.
 *   3. A Print button that uses the browser print dialog. The print
 *      stylesheet hides the page chrome and prints only the document
 *      sheet at A4, so the QR ends up on the printed copy.
 */
export default function VerificationPage() {
  const params = useParams();
  const documentId = params?.documentId;
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [verifyUrl, setVerifyUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setVerifyUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    if (!documentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/documents/verify?id=${encodeURIComponent(documentId)}`);
        const json = await res.json();
        if (json.success) { setStatus('verified'); setData(json.data); }
        else { setStatus(json.status || 'error'); setError(json.error); setData(json.data); }
      } catch (err) {
        setStatus('error');
        setError('Failed to verify document: ' + err.message);
      }
    })();
  }, [documentId]);

  const handlePrint = () => { if (typeof window !== 'undefined') window.print(); };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const isVerified = status === 'verified';
  const banner = STATUS_BANNERS[status] || STATUS_BANNERS.error;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header bar — hidden on print */}
      <div className="print:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Document Verification</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Public authenticity check</p>
          </div>
          {isVerified && (
            <button onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-700 cursor-pointer">
              🖨 Print / Save PDF
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Status banner — hidden on print so the printed copy is just the document */}
        <div className={`print:hidden rounded-lg border-2 p-4 flex items-center gap-3 ${banner.color}`}>
          <div className={`text-3xl ${banner.textColor}`}>{banner.icon}</div>
          <div className="flex-1">
            <div className={`font-semibold ${banner.textColor}`}>{banner.title}</div>
            {status === 'loading' && (
              <div className="text-sm text-slate-600 dark:text-slate-400">Checking the database…</div>
            )}
            {status !== 'loading' && status !== 'verified' && error && (
              <div className="text-sm text-slate-600 dark:text-slate-400">{error}</div>
            )}
            {isVerified && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                ID <code className="font-mono">{data.id}</code> · Issued {fmtDate(data.generated_at)}
                {data.expires_at && <> · Expires {fmtDate(data.expires_at)}</>}
                {' '}· {data.view_count} verification view{data.view_count === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>

        {/* Document sheet — what gets printed */}
        {isVerified && data && (
          <div id="print-area" className="rounded-lg bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
            <article
              className="doc-paper mx-auto bg-white text-slate-900 shadow-md font-serif relative"
              style={{ width: '210mm', minHeight: '297mm', padding: '20mm 18mm' }}
            >
              {/* Letterhead */}
              {data.branding && (
                <header className="border-b border-slate-300 pb-4 mb-6 flex items-start gap-4">
                  {data.branding.logo_url && (
                    <img src={data.branding.logo_url} alt="logo"
                      className="h-16 w-16 object-contain shrink-0" crossOrigin="anonymous" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">{data.branding.organization_name || 'Organization'}</h2>
                    {data.branding.header_text && (
                      <p className="text-xs text-slate-600 mt-0.5">{data.branding.header_text}</p>
                    )}
                    <div className="text-xs text-slate-600 mt-1 space-x-2">
                      {data.branding.email   && <span>{data.branding.email}</span>}
                      {data.branding.phone   && <span>· {data.branding.phone}</span>}
                      {data.branding.website && <span>· {data.branding.website}</span>}
                      {(data.branding.address_line1 || data.branding.country) && (
                        <span>· {[data.branding.address_line1, data.branding.city, data.branding.country].filter(Boolean).join(', ')}</span>
                      )}
                    </div>
                  </div>
                </header>
              )}

              {/* Document body — placeholders already substituted server-side */}
              <div className="text-[12pt] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: data.rendered_body
                    ? (data.body_format === 'html' || data.body_format === 'rich'
                        ? data.rendered_body
                        : renderDocumentBody(data.rendered_body, data.body_format || 'markdown'))
                    : '<p class="italic text-slate-500">Document body not available.</p>'
                }}
              />

              {/* Verification footer — QR + ID + chain of trust */}
              <footer className="mt-12 pt-6 border-t border-slate-300 flex items-end justify-between gap-6">
                <div className="text-xs text-slate-600 flex-1 min-w-0">
                  <div className="font-semibold text-slate-700 mb-1">Authenticity Verification</div>
                  <div>Document ID: <code className="font-mono text-[11pt] text-slate-900">{data.id}</code></div>
                  <div>Issued: {fmtDate(data.generated_at)}</div>
                  {data.expires_at && <div>Expires: {fmtDate(data.expires_at)}</div>}
                  <div className="mt-2 break-all">
                    Scan the QR code or visit:<br />
                    <span className="font-mono text-[10pt] text-slate-700">{verifyUrl}</span>
                  </div>
                </div>
                {verifyUrl && (
                  <div className="text-center shrink-0">
                    <div className="bg-white p-2 border border-slate-300 rounded">
                      <QRCodeSVG
                        value={verifyUrl}
                        size={120}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div className="text-[9pt] text-slate-500 mt-1">Scan to verify</div>
                  </div>
                )}
              </footer>
            </article>
          </div>
        )}

        {/* Footer chrome — hidden on print */}
        <div className="print:hidden text-center text-xs text-slate-500 dark:text-slate-400 py-4">
          <p>Authenticity verified by CONSTY document infrastructure.</p>
          <p>Last verified: {new Date().toLocaleString()}</p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">Return to home</Link>
        </div>
      </div>

      {/* Print stylesheet — when user prints (or "Saves as PDF"), strip
          everything except the document sheet, full A4. The QR code is
          inside the sheet so it makes it onto the paper. */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute; inset: 0; padding: 0 !important;
            background: white !important; border: 0 !important; box-shadow: none !important;
            max-height: none !important; overflow: visible !important;
          }
          #print-area .doc-paper {
            margin: 0 !important; box-shadow: none !important; border: 0 !important;
            width: 210mm !important; min-height: 297mm !important;
          }
        }
      `}</style>
    </div>
  );
}

const STATUS_BANNERS = {
  loading:   { icon: '⏳', title: 'Verifying Document…',  color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900',          textColor: 'text-blue-900 dark:text-blue-300' },
  verified:  { icon: '✓',  title: 'Document Verified',    color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900', textColor: 'text-emerald-900 dark:text-emerald-300' },
  revoked:   { icon: '⚠',  title: 'Document Revoked',     color: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900',              textColor: 'text-red-900 dark:text-red-300' },
  expired:   { icon: '⏰', title: 'Document Expired',     color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900',       textColor: 'text-amber-900 dark:text-amber-300' },
  not_found: { icon: '❌', title: 'Document Not Found',   color: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900',              textColor: 'text-red-900 dark:text-red-300' },
  error:     { icon: '❌', title: 'Verification Error',   color: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900',              textColor: 'text-red-900 dark:text-red-300' },
};
