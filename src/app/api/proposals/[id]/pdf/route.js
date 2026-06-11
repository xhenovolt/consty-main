import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getCompanySettings } from '@/lib/company-settings.js';


const fmt = (n) => 'UGX ' + parseFloat(n || 0).toLocaleString('en-UG', { minimumFractionDigits: 0 });

const featureGroups = {
  attendance:    '🔵',
  communication: '💬',
  analytics:     '📊',
  academics:     '📚',
  records:       '🗂️',
  access:        '📱',
  integration:   '🔗',
  support:       '🛟',
  base:          '✅',
  general:       '✅',
};

/**
 * Convert stored text blocks (paragraphs + bullet lines) to HTML.
 * Paragraphs separated by \n\n; bullet lines start with •
 */
function textToHtml(text) {
  if (!text) return '';
  return text.split('\n\n').filter(Boolean).map(block => {
    const lines = block.split('\n').filter(Boolean);
    const hasBullets = lines.some(l => l.startsWith('•'));
    if (hasBullets) {
      const inner = lines.map(line => {
        if (line.startsWith('•')) {
          return `<div class="bullet"><span class="bullet-dot">•</span><span>${esc(line.slice(1).trim())}</span></div>`;
        }
        return `<p class="block-lead">${esc(line)}</p>`;
      }).join('');
      return `<div class="content-block">${inner}</div>`;
    }
    return `<p class="body-text">${esc(block)}</p>`;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * GET /api/proposals/[id]/pdf
 * Returns print-optimised HTML — 10 sections, multi-plan comparison, company branding.
 * Supports both new multi-plan snapshots ({ plans: [] }) and old single-plan ({ plan: {} }).
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;

    const [co, snapshotRes] = await Promise.all([
      getCompanySettings(),
      query(
        `SELECT full_payload FROM proposal_snapshots WHERE proposal_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [id]
      ),
    ]);

    let data;
    if (snapshotRes.rows[0]) {
      data = snapshotRes.rows[0].full_payload;
    } else {
      const pr = await query(
        `SELECT pr.*, p.company_name AS prospect_name, p.contact_name, p.email, p.phone,
                ds.name AS system_name, ds.positioning, ds.description AS system_description,
                pp.name AS plan_name, pp.installation_fee, pp.annual_subscription, pp.student_limit, pp.is_popular,
                pr.discount_percent, pr.custom_notes, pr.payment_terms
         FROM proposals pr
         JOIN prospects p   ON p.id  = pr.prospect_id
         JOIN drais_systems ds ON ds.id = pr.system_id
         JOIN pricing_plans pp ON pp.id = pr.selected_plan_id
         WHERE pr.id = $1`, [id]
      );
      if (!pr.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      const row = pr.rows[0];
      const feats = await query(`SELECT * FROM pricing_features WHERE plan_id = $1 ORDER BY display_order`, [row.selected_plan_id]);
      data = {
        school_name: row.prospect_name, contact_name: row.contact_name, email: row.email, phone: row.phone,
        system: { name: row.system_name, positioning: row.positioning },
        plan:   { name: row.plan_name, installation_fee: row.installation_fee, annual_subscription: row.annual_subscription, student_limit: row.student_limit, is_popular: row.is_popular },
        features: feats.rows, discount_percent: parseFloat(row.discount_percent || 0),
        custom_notes: row.custom_notes, payment_terms: row.payment_terms, generated_at: new Date().toISOString(),
      };
    }

    const d = data;

    // ── Normalise to multi-plan format ──────────────────────────────────────
    const plans = Array.isArray(d.plans) && d.plans.length
      ? d.plans
      : d.plan
        ? [{ id: null, name: d.plan.name, installation_fee: d.plan.installation_fee,
             annual_subscription: d.plan.annual_subscription, student_limit: d.plan.student_limit,
             is_popular: d.plan.is_popular, is_recommended: true, features: d.features || [] }]
        : [];

    const extContent   = d.extended_content || {};
    const compMatrix   = Array.isArray(d.comparison_matrix) ? d.comparison_matrix : [];
    const recPlanId    = d.recommended_plan_id || plans.find(p => p.is_recommended)?.id || plans[0]?.id || null;
    const recPlan      = plans.find(p => p.id === recPlanId) || plans[0];
    const discPct      = parseFloat(d.discount_percent || 0);
    const schoolName   = d.school_name || 'Valued School';
    const today        = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });
    const phones       = [co.company_phone_1, co.company_phone_2, co.company_phone_3].filter(Boolean).join(' · ');

    // ── Section numbering (compact if single-plan, no comparison) ───────────
    let sN = 1;
    const S  = () => ++sN;   // returns incremented section number for headings

    // ── Comparison table HTML ───────────────────────────────────────────────
    const compTableHtml = (plans.length > 1 && compMatrix.length > 0) ? `
<div class="section">
  <h3>${S()}. Plan Comparison</h3>
  <table class="comp-table">
    <thead>
      <tr>
        <th class="feature-col">Feature</th>
        ${plans.map(p => `<th class="${p.id === recPlanId ? 'rec-col' : ''}">${esc(p.name)}${p.id === recPlanId ? '<br><span class="rec-label">★ Recommended</span>' : ''}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${compMatrix.map((row, i) => `
        <tr class="${i % 2 === 0 ? 'even' : ''}">
          <td class="feature-name">${esc(row.label)}</td>
          ${plans.map(p => {
            const v = row[p.id] || '—';
            const cls = v === '✔' ? 'check' : v === '✖' ? 'cross' : '';
            return `<td class="${cls}${p.id === recPlanId ? ' rec-col-cell' : ''}">${v}</td>`;
          }).join('')}
        </tr>`).join('')}
    </tbody>
  </table>
</div>` : '';

    // ── Per-plan pricing sections ───────────────────────────────────────────
    const pricingSectionN = S();
    const pricingHtml = `
<div class="section">
  <h3>${pricingSectionN}. Investment Summary</h3>
  ${plans.map(plan => {
    const inst    = parseFloat(plan.installation_fee || 0);
    const ann     = parseFloat(plan.annual_subscription || 0);
    const dInst   = inst - inst * (discPct / 100);
    const dAnn    = ann  - ann  * (discPct / 100);
    const isRec   = plan.id === recPlanId;
    const featRows = (plan.features || []).map(f => `
      <tr>
        <td class="feat-icon">${featureGroups[f.category] || '✅'}</td>
        <td>${esc(f.feature_name)}</td>
        <td class="feat-cat">${esc(f.category || '')}</td>
      </tr>`).join('');
    return `
<div class="plan-block${isRec ? ' plan-block-rec' : ''}">
  <div style="margin-bottom:12px">
    <span class="plan-badge">${esc(plan.name)}</span>
    ${plan.is_popular ? '<span class="popular-badge">⭐ Most Popular</span>' : ''}
    ${isRec && plans.length > 1 ? '<span class="rec-badge">★ Recommended</span>' : ''}
    <span style="font-size:12px;color:#666;margin-left:10px">
      ${plan.student_limit ? `Up to ${plan.student_limit.toLocaleString()} students` : 'Unlimited students'}
    </span>
  </div>
  ${featRows ? `
  <table class="feat-table" style="margin-bottom:14px">
    <thead><tr><th style="width:32px"></th><th>Feature</th><th>Category</th></tr></thead>
    <tbody>${featRows}</tbody>
  </table>` : ''}
  <div class="pricing-box">
    <div class="pricing-row"><span>Installation fee (one-time)</span><span><strong>${fmt(inst)}</strong></span></div>
    <div class="pricing-row"><span>Annual subscription</span><span><strong>${fmt(ann)}</strong> / year</span></div>
    ${discPct > 0 ? `
    <div class="pricing-row discount"><span>Discount (${discPct}%)</span><span>− ${fmt(inst * discPct / 100 + ann * discPct / 100)}</span></div>
    <div class="pricing-row total"><span>Installation (after discount)</span><span>${fmt(dInst)}</span></div>
    <div class="pricing-row total"><span>Annual (after discount)</span><span>${fmt(dAnn)}</span></div>` : ''}
  </div>
</div>`;
  }).join('')}
  ${d.payment_terms ? `<p style="margin-top:12px;font-size:13px;color:#555"><strong>Payment Terms:</strong> ${esc(d.payment_terms)}</p>` : ''}
</div>`;

    // ── Recommended plan callout (multi-plan only) ──────────────────────────
    const recBoxHtml = (recPlan && plans.length > 1) ? `
<div class="rec-box">
  <div class="rec-box-title">★ Our Recommendation: ${esc(recPlan.name)} Plan</div>
  <p style="font-size:13px;opacity:.9;margin-top:6px">
    Based on ${d.student_count ? `${parseInt(d.student_count).toLocaleString()} students` : "your institution's profile"},
    the <strong>${esc(recPlan.name)}</strong> plan delivers the best balance of capability and investment for ${esc(schoolName)}.
  </p>
</div>` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DRAIS Proposal – ${esc(schoolName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; background: #fff;
         padding: 40px; max-width: 880px; margin: 0 auto; font-size: 14px; line-height: 1.65; }
  /* HEADER */
  .brand { display:flex; justify-content:space-between; align-items:flex-start;
           border-bottom: 3px solid #1a1a2e; padding-bottom: 20px; margin-bottom: 32px; }
  .brand-left { display:flex; align-items:center; gap: 14px; }
  .brand-left h1 { font-size:24px; font-weight:800; letter-spacing:-0.5px; }
  .brand-left .tagline { font-size:11px; color:#666; margin-top:2px; }
  .brand-left .contacts { font-size:11px; color:#888; margin-top:3px; }
  .brand-right .doc-type { font-size:22px; font-weight:800; color:#2563eb; letter-spacing:2px; }
  .brand-right .doc-date { font-size:11px; color:#666; margin-top:4px; text-align:right; }
  /* INTRO */
  .intro { margin-bottom:28px; }
  .intro .greeting { font-size:15px; font-weight:700; margin-bottom:8px; }
  .intro p { color:#444; }
  /* SECTIONS */
  .section { margin-bottom:28px; }
  .section h3 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px;
                color:#888; border-bottom:1px solid #e5e7eb; padding-bottom:6px; margin-bottom:14px; }
  .body-text { color:#444; margin-bottom:8px; }
  .content-block { margin-bottom:10px; }
  .block-lead { font-weight:600; color:#333; margin-bottom:4px; font-size:13px; }
  .bullet { display:flex; gap:8px; margin-bottom:5px; font-size:13px; color:#444; }
  .bullet-dot { color:#2563eb; flex-shrink:0; margin-top:1px; }
  /* SYSTEM HIGHLIGHT */
  .highlight-box { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:14px 18px; margin-bottom:16px; }
  .highlight-box .sys-name { font-size:18px; font-weight:800; color:#1d4ed8; }
  .highlight-box .sys-pos { font-size:12px; color:#3730a3; font-style:italic; margin-top:3px; }
  /* RED BOX */
  .coi-box { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px 20px; margin-bottom:28px; }
  .coi-box h3 { color:#991b1b; border-color:#fecaca; }
  /* COMPARISON TABLE */
  .comp-table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:4px; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb; }
  .comp-table thead tr { background:#1a1a2e; color:#fff; }
  .comp-table th { padding:10px 12px; text-align:center; font-weight:700; font-size:11px; }
  .comp-table th.feature-col { text-align:left; width:200px; }
  .comp-table th.rec-col { color:#fbbf24; }
  .rec-label { font-size:9px; font-weight:normal; color:#fbbf24; }
  .comp-table td { padding:9px 12px; border-bottom:1px solid #f0f0f0; text-align:center; vertical-align:middle; }
  .comp-table td.feature-name { text-align:left; font-weight:500; color:#374151; font-size:12px; }
  .comp-table td.check { color:#059669; font-weight:800; font-size:14px; }
  .comp-table td.cross { color:#dc2626; font-size:14px; }
  .comp-table td.rec-col-cell { background:#fffbeb; }
  .comp-table tr.even td { background:#f9fafb; }
  .comp-table tr.even td.rec-col-cell { background:#fef9ee; }
  /* PLAN BLOCKS */
  .plan-block { border:1px solid #e5e7eb; border-radius:10px; padding:20px; margin-bottom:18px; }
  .plan-block-rec { border-color:#f59e0b; background:#fffbeb; }
  .plan-badge { display:inline-block; background:#1d4ed8; color:#fff; font-size:11px; font-weight:700;
                padding:4px 14px; border-radius:20px; letter-spacing:0.5px; text-transform:uppercase; }
  .popular-badge { display:inline-block; background:#f59e0b; color:#fff; font-size:10px; font-weight:700;
                   padding:3px 10px; border-radius:20px; margin-left:8px; }
  .rec-badge { display:inline-block; background:#d97706; color:#fff; font-size:10px; font-weight:700;
               padding:3px 10px; border-radius:20px; margin-left:8px; }
  /* FEATURE TABLE */
  table.feat-table { width:100%; border-collapse:collapse; }
  table.feat-table th { background:#1a1a2e; color:#fff; padding:8px 12px; font-size:10px;
                        text-transform:uppercase; letter-spacing:0.5px; text-align:left; }
  table.feat-table td { padding:9px 12px; border-bottom:1px solid #f0f0f0; vertical-align:top; font-size:13px; }
  td.feat-icon { width:30px; text-align:center; }
  td.feat-cat { width:110px; font-size:11px; color:#999; text-transform:capitalize; }
  /* PRICING */
  .pricing-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:18px 22px; }
  .pricing-row { display:flex; justify-content:space-between; padding:8px 0; font-size:13px; border-bottom:1px solid #e5e7eb; }
  .pricing-row:last-child { border-bottom:none; }
  .pricing-row.discount { color:#059669; }
  .pricing-row.total { font-size:14px; font-weight:800; border-top:2px solid #1a1a2e; padding-top:12px; margin-top:4px; }
  /* RECOMMENDED BOX */
  .rec-box { background:#f59e0b; color:#fff; border-radius:10px; padding:20px 24px; margin-bottom:28px; }
  .rec-box-title { font-size:15px; font-weight:800; }
  /* CTA */
  .cta-box { background:#1a1a2e; color:#fff; border-radius:10px; padding:24px 28px; margin-top:28px; }
  .cta-box h3 { font-size:15px; font-weight:700; margin-bottom:10px; }
  .cta-box p { font-size:13px; color:#cbd5e1; line-height:1.7; }
  .contact-row { display:flex; flex-wrap:wrap; gap:24px; margin-top:16px; }
  .contact-row span { font-size:12px; color:#94a3b8; }
  .contact-row b { color:#fff; }
  /* FOOTER */
  .footer-note { margin-top:40px; padding-top:14px; border-top:1px solid #e5e7eb;
                 font-size:11px; color:#aaa; display:flex; justify-content:space-between; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    .cta-box, .rec-box, .coi-box, table.feat-table th, .comp-table thead tr
      { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="no-print" style="text-align:right;margin-bottom:18px">
  <button onclick="window.print()"
    style="background:#2563eb;color:#fff;border:none;padding:10px 22px;border-radius:7px;font-size:14px;font-weight:600;cursor:pointer;">
    🖨️ Download / Print PDF
  </button>
</div>

<!-- HEADER -->
<div class="brand">
  <div class="brand-left">
    ${co.company_logo ? `<img src="${co.company_logo}" alt="Logo" style="max-height:56px;max-width:120px;object-fit:contain;display:block">` : ''}
    <div>
      <h1>${esc(co.company_name)}</h1>
      ${co.company_tagline ? `<div class="tagline">${esc(co.company_tagline)}</div>` : ''}
      ${co.company_address ? `<div class="contacts" style="margin-top:2px">${esc(co.company_address)}</div>` : ''}
      <div class="contacts">${phones}${co.company_email ? ` · ${esc(co.company_email)}` : ''}</div>
    </div>
  </div>
  <div class="brand-right">
    <div class="doc-type">PROPOSAL</div>
    <div class="doc-date">${today}</div>
  </div>
</div>

<!-- 1. INTRODUCTION -->
<div class="intro">
  <div class="greeting">Dear ${esc(schoolName)},</div>
  <p>
    We are pleased to present <strong>${esc(d.system?.name || 'DRAIS')}</strong> —
    ${esc(d.system?.positioning || 'attendance-first school management')} —
    tailored for your institution.
    ${plans.length > 1
      ? `This proposal compares <strong>${plans.length} plan options</strong> so you can select the right fit.`
      : `This proposal outlines the <strong>${esc(plans[0]?.name || '')}</strong> plan.`}
    ${d.student_count ? ` Based on your profile of <strong>${parseInt(d.student_count).toLocaleString()} students</strong>, we have tailored our recommendation accordingly.` : ''}
  </p>
</div>

<div class="highlight-box">
  <div class="sys-name">${esc(d.system?.name || 'DRAIS')}</div>
  <div class="sys-pos">"${esc(d.system?.positioning || '')}"</div>
</div>

<!-- 2. THE PROBLEM -->
${extContent.problem_block ? `
<div class="section">
  <h3>2. The Challenge Your School Faces</h3>
  ${textToHtml(extContent.problem_block)}
</div>` : ''}

<!-- 3. COST OF INACTION -->
${extContent.cost_of_inaction_block ? `
<div class="section coi-box">
  <h3>3. The Cost of Inaction</h3>
  ${textToHtml(extContent.cost_of_inaction_block)}
</div>` : ''}

<!-- 4. SOLUTION -->
${extContent.solution_block ? `
<div class="section">
  <h3>4. The DRAIS Solution</h3>
  ${textToHtml(extContent.solution_block)}
</div>` : ''}

<!-- 5. WHY ATTENDANCE-FIRST -->
${extContent.why_attendance_first ? `
<div class="section">
  <h3>5. Why Attendance-First?</h3>
  ${textToHtml(extContent.why_attendance_first)}
</div>` : ''}

<!-- 6. COMPARISON TABLE (multi-plan) -->
${compTableHtml}

<!-- 7. PRICING + FEATURES PER PLAN -->
${pricingHtml}

<!-- 8. RECOMMENDED PLAN -->
${recBoxHtml}

<!-- CUSTOM NOTES -->
${d.custom_notes ? `
<div class="section">
  <h3>Additional Notes</h3>
  <p>${esc(d.custom_notes)}</p>
</div>` : ''}

<!-- 9. TRANSFORMATION -->
${extContent.transformation_block ? `
<div class="section">
  <h3>${S()}. What Changes After DRAIS</h3>
  ${textToHtml(extContent.transformation_block)}
</div>` : ''}

<!-- 10. CTA -->
<div class="cta-box">
  <h3>Ready to Transform ${esc(schoolName)}?</h3>
  <p>
    Our team handles complete installation, staff training, and onboarding.
    DRAIS becomes operational from day one — yours to manage and grow from.
  </p>
  <p style="margin-top:10px">
    To proceed, reply to this proposal or contact us on any of the numbers below.
    We look forward to partnering with ${esc(schoolName)}.
  </p>
  <div class="contact-row">
    ${[co.company_phone_1, co.company_phone_2, co.company_phone_3].filter(Boolean).map(p => `<span><b>📞</b> ${esc(p)}</span>`).join('')}
    ${co.company_email   ? `<span><b>✉</b> ${esc(co.company_email)}</span>` : ''}
    ${co.company_website ? `<span><b>🌐</b> ${esc(co.company_website)}</span>` : ''}
  </div>
</div>

<div class="footer-note">
  <span>${esc(co.company_name)} · DRAIS School Management System</span>
  <span>Generated: ${today}</span>
</div>

</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Proposal-Id': id,
      },
    });
  } catch (error) {
    console.error('[Proposals PDF] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  }
}
