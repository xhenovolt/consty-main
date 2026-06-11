'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Loader2, CheckCircle, ExternalLink,
  AlertCircle, Users, School,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const fmt = (n) => 'UGX ' + parseFloat(n || 0).toLocaleString('en-UG', { minimumFractionDigits: 0 });

// ── Recommend a plan based on student count + school type ──────────────────
function getRecommendedPlan(studentCount, schoolType, plans) {
  if (!plans.length) return null;
  const count = parseInt(studentCount) || 0;
  if (schoolType === 'university' || count > 2000) {
    return plans.find(p => p.student_limit === null)?.id || plans[plans.length - 1]?.id;
  }
  if (count > 1000 || schoolType === 'secondary') {
    const fit = plans.find(p => p.student_limit == null || p.student_limit >= count);
    return fit?.id || plans.find(p => p.is_popular)?.id || plans[0]?.id;
  }
  return plans.find(p => p.is_popular)?.id || plans[0]?.id;
}

// ── Render long text blocks ────────────────────────────────────────────────
function ContentBlock({ text, className = '' }) {
  if (!text) return null;
  const blocks = text.split('\n\n').filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter(Boolean);
        const hasBullets = lines.some(l => l.startsWith('•'));
        return (
          <div key={i} className="mb-2">
            {lines.map((line, j) => {
              if (line.startsWith('•')) {
                return (
                  <div key={j} className="flex gap-2 text-sm mb-1 text-muted-foreground">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>{line.slice(1).trim()}</span>
                  </div>
                );
              }
              return (
                <p key={j} className={`text-sm mb-1 ${hasBullets && j === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {line}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────
function ComparisonTable({ plans, matrix, recommendedId }) {
  if (!plans.length || !matrix.length) return null;
  const cellCls = (v) => {
    if (v === '✔') return 'text-emerald-600 font-bold text-center';
    if (v === '✖') return 'text-red-400 text-center';
    return 'text-center text-foreground text-xs';
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-foreground text-background">
            <th className="p-2.5 text-left font-semibold w-40">Feature</th>
            {plans.map(p => (
              <th key={p.id} className={`p-2.5 text-center font-semibold ${p.id === recommendedId ? 'text-amber-300' : ''}`}>
                {p.name}
                {p.id === recommendedId && <span className="block text-xs font-normal text-amber-300">★ Recommended</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i} className="border-t border-border even:bg-muted/20">
              <td className="p-2 text-xs text-muted-foreground font-medium">{row.label}</td>
              {plans.map(p => (
                <td key={p.id} className={`p-2 ${cellCls(row[p.id])}`}>{row[p.id] || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Live preview (full 10-section proposal) ────────────────────────────────
function ProposalPreview({ form, systems, company }) {
  const system       = systems.find(s => s.id === form.system_id);
  const allPlanIds   = form.selected_plan_ids || [];
  const selPlans     = system?.plans?.filter(p => allPlanIds.includes(p.id)) || [];
  const recPlan      = selPlans.find(p => p.id === form.recommended_plan_id) || selPlans[0];
  const matrix       = system?.comparison_matrix || [];
  const ext          = system || {};
  const schoolName   = form.school_name || 'Your School';
  const discPct      = parseFloat(form.discount_percent || 0);
  const today        = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });
  const phones       = [company?.company_phone_1, company?.company_phone_2, company?.company_phone_3].filter(Boolean).join(' · ');

  if (!system || selPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
        <FileText className="w-12 h-12 opacity-20" />
        <p className="text-sm">Select a system and at least one plan to preview</p>
      </div>
    );
  }

  const SH = ({ n, title }) => (
    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 border-b border-border pb-1">
      {n}. {title}
    </div>
  );
  const sectionN = (base) => selPlans.length > 1 ? base : base - 1;

  return (
    <div className="text-foreground space-y-5" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px' }}>

      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-foreground pb-3">
        <div className="flex items-center gap-3">
          {company?.company_logo && (
            <img src={company.company_logo} alt="Logo" className="max-h-10 max-w-[90px] object-contain" />
          )}
          <div>
            <div className="text-base font-extrabold">{company?.company_name || 'Your Company'}</div>
            <div className="text-xs text-muted-foreground">{company?.company_tagline || ''}</div>
            {phones && <div className="text-xs text-muted-foreground mt-0.5">{phones}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold text-blue-600 tracking-widest">PROPOSAL</div>
          <div className="text-xs text-muted-foreground">{today}</div>
        </div>
      </div>

      {/* 1. INTRODUCTION */}
      <div>
        <SH n="1" title="Introduction" />
        <p className="font-bold text-sm">Dear {schoolName},</p>
        <p className="text-sm text-muted-foreground mt-1">
          We are pleased to present <strong className="text-foreground">{system.name}</strong> — {system.positioning} —
          specifically configured for {schoolName}. This proposal {selPlans.length > 1 ? `compares ${selPlans.length} plan options` : 'outlines the most suitable plan'} for your needs.
          {form.student_count && ` Based on your profile of ${parseInt(form.student_count).toLocaleString()} students, we have tailored our recommendation accordingly.`}
        </p>
      </div>

      {/* SYSTEM */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3">
        <div className="text-sm font-extrabold text-blue-700 dark:text-blue-300">{system.name}</div>
        <div className="text-xs text-blue-600 dark:text-blue-400 italic mt-0.5">"{system.positioning}"</div>
      </div>

      {/* 2. PROBLEM */}
      {ext.problem_block && (
        <div>
          <SH n="2" title="The Challenge Your School Faces" />
          <ContentBlock text={ext.problem_block} />
        </div>
      )}

      {/* 3. COST OF INACTION */}
      {ext.cost_of_inaction_block && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3">
          <SH n="3" title="The Cost of Inaction" />
          <ContentBlock text={ext.cost_of_inaction_block} />
        </div>
      )}

      {/* 4. SOLUTION */}
      {ext.solution_block && (
        <div>
          <SH n="4" title="The DRAIS Solution" />
          <ContentBlock text={ext.solution_block} />
        </div>
      )}

      {/* 5. WHY ATTENDANCE-FIRST */}
      {ext.why_attendance_first && (
        <div>
          <SH n="5" title="Why Attendance-First?" />
          <ContentBlock text={ext.why_attendance_first} />
        </div>
      )}

      {/* 6. COMPARISON TABLE (multi-plan only) */}
      {selPlans.length > 1 && matrix.length > 0 && (
        <div>
          <SH n="6" title="Plan Comparison" />
          <ComparisonTable plans={selPlans} matrix={matrix} recommendedId={form.recommended_plan_id} />
        </div>
      )}

      {/* 7. PRICING */}
      <div>
        <SH n={String(sectionN(7))} title="Investment Summary" />
        <div className="space-y-3">
          {selPlans.map(plan => {
            const inst = parseFloat(plan.installation_fee || 0);
            const ann  = parseFloat(plan.annual_subscription || 0);
            const isRec = plan.id === recPlan?.id;
            return (
              <div key={plan.id} className={`rounded-lg border p-3 ${isRec ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-border bg-muted/20'}`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isRec ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>{plan.name}</span>
                  {plan.is_popular && <span className="text-xs text-amber-600 font-medium">⭐ Most Popular</span>}
                  {isRec && selPlans.length > 1 && <span className="text-xs text-amber-600 font-bold">★ Recommended</span>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {plan.student_limit ? `Up to ${plan.student_limit.toLocaleString()} students` : 'Unlimited students'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="text-muted-foreground">Installation</div>
                  <div className={`text-right font-semibold ${discPct > 0 ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{fmt(inst)}</div>
                  {discPct > 0 && <>
                    <div className="text-emerald-600">After {discPct}% discount</div>
                    <div className="text-right font-bold text-emerald-600">{fmt(inst - inst * (discPct / 100))}</div>
                  </>}
                  <div className="text-muted-foreground">Annual subscription</div>
                  <div className={`text-right font-semibold ${discPct > 0 ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{fmt(ann)} /yr</div>
                  {discPct > 0 && <>
                    <div className="text-emerald-600">After discount</div>
                    <div className="text-right font-bold text-emerald-600">{fmt(ann - ann * (discPct / 100))} /yr</div>
                  </>}
                </div>
              </div>
            );
          })}
        </div>
        {form.payment_terms && (
          <p className="text-xs text-muted-foreground mt-2"><strong>Payment Terms:</strong> {form.payment_terms}</p>
        )}
      </div>

      {/* 8. RECOMMENDATION (multi-plan anchor) */}
      {recPlan && selPlans.length > 1 && (
        <div className="rounded-lg bg-amber-500 text-white p-3">
          <div className="font-bold text-sm mb-1">★ Our Recommendation: {recPlan.name} Plan</div>
          <p className="text-xs opacity-90">
            Based on {form.student_count ? `${parseInt(form.student_count).toLocaleString()} students` : 'your profile'},
            the <strong>{recPlan.name}</strong> plan offers the best balance of capability and investment for {schoolName}.
          </p>
        </div>
      )}

      {/* Custom notes */}
      {form.custom_notes && (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Additional Notes</div>
          <p className="text-sm">{form.custom_notes}</p>
        </div>
      )}

      {/* 9. TRANSFORMATION */}
      {ext.transformation_block && (
        <div>
          <SH n={String(sectionN(9))} title="What Changes After DRAIS" />
          <ContentBlock text={ext.transformation_block} />
        </div>
      )}

      {/* 10. CTA */}
      <div className="rounded-lg bg-foreground text-background p-3">
        <div className="font-bold text-sm mb-1">Ready to Transform {schoolName}?</div>
        <p className="text-xs opacity-80">
          Our team handles complete installation, staff training, and onboarding — DRAIS becomes operational from day one.
        </p>
        {phones && <div className="text-xs opacity-70 mt-1.5">{phones}</div>}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ProposalGeneratorPage() {
  const { id: prospectId } = useParams();
  const toast = useToast();

  const [prospect, setProspect]     = useState(null);
  const [systems, setSystems]       = useState([]);
  const [company, setCompany]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated]   = useState(null);
  const [suggestion, setSuggestion] = useState('');

  const [form, setForm] = useState({
    system_id:           '',
    selected_plan_ids:   [],
    recommended_plan_id: '',
    discount_percent:    '',
    payment_terms:       '',
    custom_notes:        '',
    school_name:         '',
    student_count:       '',
    school_type:         'secondary',
  });

  useEffect(() => {
    Promise.all([
      fetchWithAuth(`/api/prospects/${prospectId}`).then(r => r.json()),
      fetchWithAuth('/api/drais/systems').then(r => r.json()),
      fetchWithAuth('/api/settings/company').then(r => r.json()),
    ]).then(([pd, sd, cd]) => {
      if (pd.success) {
        setProspect(pd.data);
        setForm(prev => ({ ...prev, school_name: pd.data.company_name || '' }));
      }
      if (sd.success && sd.data?.length) {
        setSystems(sd.data);
        const sys = sd.data[0];
        const plans = sys.plans || [];
        const recId = getRecommendedPlan('', 'secondary', plans);
        setForm(prev => ({
          ...prev,
          system_id:           sys.id,
          selected_plan_ids:   plans.map(p => p.id),
          recommended_plan_id: recId || plans.find(p => p.is_popular)?.id || plans[0]?.id || '',
        }));
      }
      if (cd.success && cd.data) setCompany(cd.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [prospectId]);

  const update = useCallback((field, value) => setForm(prev => ({ ...prev, [field]: value })), []);

  const handleProfileChange = (field, value) => {
    setForm(prev => {
      const newForm = { ...prev, [field]: value };
      const sys = systems.find(s => s.id === newForm.system_id);
      if (sys) {
        const recId = getRecommendedPlan(newForm.student_count, newForm.school_type, sys.plans || []);
        if (recId) {
          setSuggestion(recId);
          return { ...newForm, recommended_plan_id: recId };
        }
      }
      setSuggestion('');
      return newForm;
    });
  };

  const togglePlan = (planId) => {
    setForm(prev => {
      const ids = prev.selected_plan_ids.includes(planId)
        ? prev.selected_plan_ids.filter(id => id !== planId)
        : [...prev.selected_plan_ids, planId];
      const recId = ids.includes(prev.recommended_plan_id) ? prev.recommended_plan_id : ids[0] || '';
      return { ...prev, selected_plan_ids: ids, recommended_plan_id: recId };
    });
  };

  const selectedSystem = systems.find(s => s.id === form.system_id);

  const handleGenerate = async () => {
    if (!form.system_id || form.selected_plan_ids.length === 0) {
      toast.error('Please select a system and at least one plan');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id:         prospectId,
          system_id:           form.system_id,
          selected_plan_ids:   form.selected_plan_ids,
          recommended_plan_id: form.recommended_plan_id,
          custom_notes:        form.custom_notes || null,
          discount_percent:    parseFloat(form.discount_percent) || 0,
          payment_terms:       form.payment_terms || null,
          student_count:       form.student_count ? parseInt(form.student_count) : null,
          school_type:         form.school_type || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGenerated(json.data);
        toast.success('Proposal generated!');
      } else {
        toast.error(json.error || 'Failed to generate proposal');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!prospect) return <div className="p-6 text-muted-foreground">Prospect not found.</div>;

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
      {/* Nav */}
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/app/prospects/${prospectId}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back to {prospect.company_name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Generate Proposal</span>
      </div>

      {/* Success banner */}
      {generated && (
        <div className="mb-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Proposal generated with {generated.plans?.length || 1} plan{(generated.plans?.length || 1) !== 1 ? 's' : ''}!</p>
              <p className="text-xs opacity-80">Snapshot saved permanently. Download PDF below.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.open(`/api/proposals/${generated.id}/pdf`, '_blank')}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
              <ExternalLink className="w-4 h-4" /> Download PDF
            </button>
            <Link href={`/app/proposals/${generated.id}`}
              className="flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition dark:bg-emerald-900/30">
              View Proposal
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        {/* LEFT — Configuration */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" /> Proposal Configuration
            </h2>

            {/* School name */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">School / Organisation Name</label>
              <input type="text" value={form.school_name} onChange={e => update('school_name', e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
                placeholder={prospect.company_name} />
            </div>

            {/* School profile */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Student Count
                </label>
                <input type="number" min="1" value={form.student_count}
                  onChange={e => handleProfileChange('student_count', e.target.value)}
                  placeholder="e.g. 800"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <School className="w-3 h-3" /> School Type
                </label>
                <select value={form.school_type} onChange={e => handleProfileChange('school_type', e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="university">University</option>
                  <option value="vocational">Vocational</option>
                </select>
              </div>
            </div>

            {/* System select (if multiple) */}
            {systems.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">System</label>
                <select value={form.system_id}
                  onChange={e => { update('system_id', e.target.value); update('selected_plan_ids', []); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
                  {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Multi-plan checkboxes */}
            {selectedSystem && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Plans to Include</label>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setForm(prev => ({ ...prev, selected_plan_ids: selectedSystem.plans.map(p => p.id) }))}
                      className="text-blue-500 hover:underline">All</button>
                    <button onClick={() => setForm(prev => ({ ...prev, selected_plan_ids: [] }))}
                      className="text-muted-foreground hover:underline">None</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedSystem.plans?.map(plan => {
                    const isSelected = form.selected_plan_ids.includes(plan.id);
                    const isRec = form.recommended_plan_id === plan.id;
                    const isSugg = suggestion === plan.id;
                    return (
                      <div key={plan.id} className={`border rounded-xl p-3 transition ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-border bg-background'}`}>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" checked={isSelected} onChange={() => togglePlan(plan.id)}
                            className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">{plan.name}</span>
                              {plan.is_popular && <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Popular</span>}
                              {isSugg && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full">✦ Suggested</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {fmt(plan.installation_fee)} install · {fmt(plan.annual_subscription)}/yr
                              {plan.student_limit ? ` · up to ${plan.student_limit.toLocaleString()} students` : ' · unlimited'}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50 cursor-pointer"
                            onClick={() => update('recommended_plan_id', plan.id)}>
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isRec ? 'border-amber-500' : 'border-muted-foreground'}`}>
                              {isRec && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                            </div>
                            <span className={`text-xs ${isRec ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>
                              {isRec ? '★ Highlighted as Recommended' : 'Set as Recommended'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Discount */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Discount (% optional)</label>
              <input type="number" min="0" max="100" value={form.discount_percent}
                onChange={e => update('discount_percent', e.target.value)} placeholder="e.g. 10"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            </div>

            {/* Payment terms */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Terms (optional)</label>
              <input type="text" value={form.payment_terms}
                onChange={e => update('payment_terms', e.target.value)}
                placeholder="e.g. 50% upfront, 50% on go-live"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            </div>

            {/* Custom notes */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Custom Notes (optional)</label>
              <textarea value={form.custom_notes} onChange={e => update('custom_notes', e.target.value)}
                placeholder="Special conditions, personalised message…" rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground resize-none" />
            </div>

            {form.selected_plan_ids.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Select at least one plan
              </div>
            )}

            <button onClick={handleGenerate} disabled={submitting || form.selected_plan_ids.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {submitting ? 'Generating…' : `Generate Proposal${form.selected_plan_ids.length > 1 ? ` (${form.selected_plan_ids.length} plans)` : ''}`}
            </button>

            {generated && (
              <button onClick={() => window.open(`/api/proposals/${generated.id}/pdf`, '_blank')}
                className="w-full mt-2 flex items-center justify-center gap-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-medium py-2.5 rounded-xl transition text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 dark:bg-blue-900/30">
                <ExternalLink className="w-4 h-4" /> Download PDF
              </button>
            )}
          </div>
        </div>

        {/* RIGHT — Live Preview */}
        <div className="bg-card border border-border rounded-xl p-5 overflow-auto max-h-[calc(100vh-160px)] sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-xs text-foreground uppercase tracking-widest">Live Preview</h2>
            <span className="text-xs text-muted-foreground">Updates as you edit</span>
          </div>
          <ProposalPreview
            form={{ ...form, school_name: form.school_name || prospect.company_name }}
            systems={systems}
            company={company}
          />
        </div>
      </div>
    </div>
  );
}
