'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Building2, Phone, Mail, Globe, MapPin, FileText,
  ArrowLeft, Save, Loader2, CheckCircle, UploadCloud, XCircle, ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/fetch-client';

const FIELD_META = [
  { key: 'company_name',         label: 'Company Name',         type: 'text',     icon: Building2,  required: true },
  { key: 'company_tagline',      label: 'Tagline / Slogan',     type: 'text',     icon: FileText },
  { key: 'company_address',      label: 'Physical Address',     type: 'textarea', icon: MapPin },
  { key: 'company_phone_1',      label: 'Phone 1 (Primary)',    type: 'tel',      icon: Phone,      required: true },
  { key: 'company_phone_2',      label: 'Phone 2',              type: 'tel',      icon: Phone },
  { key: 'company_phone_3',      label: 'Phone 3',              type: 'tel',      icon: Phone },
  { key: 'company_email',        label: 'Company Email',        type: 'email',    icon: Mail },
  { key: 'company_website',      label: 'Website',              type: 'url',      icon: Globe,      placeholder: 'https://yoursite.com' },
  { key: 'company_tin',          label: 'TIN / Tax ID',         type: 'text',     icon: FileText },
  { key: 'company_registration', label: 'Registration Number',  type: 'text',     icon: FileText },
];

const EMPTY = Object.fromEntries(FIELD_META.map(f => [f.key, '']));

export default function CompanySettingsPage() {
  const [form, setForm]         = useState({ ...EMPTY, company_logo: '' });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const logoInputRef = useRef(null);

  // Load current settings
  useEffect(() => {
    fetchWithAuth('/api/settings/company')
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          setForm(prev => ({ ...prev, ...j.data }));
          if (j.data.company_logo) setLogoPreview(j.data.company_logo);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // Handle logo file selection — convert to base64
  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_BYTES) {
      setError('Logo image must be under 2 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setLogoPreview(dataUrl);
      update('company_logo', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoPreview('');
    update('company_logo', '');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(json.error || 'Failed to save');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/app/settings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-500" />
          Company Branding
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set once — used on all invoices, proposals, and documents automatically.
        </p>
      </div>

      {/* Logo upload */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-500" /> Company Logo
        </h2>

        <div className="flex items-start gap-5">
          {/* Preview box */}
          <div className="w-28 h-28 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Company logo" className="max-w-full max-h-full object-contain p-1" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <Building2 className="w-8 h-8 opacity-30" />
                <span className="text-xs opacity-50">No logo</span>
              </div>
            )}
          </div>

          {/* Upload controls */}
          <div className="flex-1">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={handleLogoFile}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className="flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition inline-flex w-fit"
            >
              <UploadCloud className="w-4 h-4" /> Upload Logo
            </label>
            <p className="text-xs text-muted-foreground mt-2">
              PNG, JPG, SVG or WebP · Max 2 MB<br />
              Recommended: square or wide, transparent background
            </p>
            {logoPreview && (
              <button
                onClick={removeLogo}
                className="mt-2 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600"
              >
                <XCircle className="w-3.5 h-3.5" /> Remove logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contact & identity fields */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-sm text-foreground mb-5 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" /> Company Information
        </h2>

        <div className="space-y-4">
          {FIELD_META.map(({ key, label, type, icon: Icon, required, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" style={type === 'textarea' ? { top: '12px', transform: 'none' } : {}} />
                {type === 'textarea' ? (
                  <textarea
                    value={form[key] || ''}
                    onChange={e => update(key, e.target.value)}
                    rows={2}
                    placeholder={placeholder || ''}
                    className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background text-foreground resize-none"
                  />
                ) : (
                  <input
                    type={type}
                    value={form[key] || ''}
                    onChange={e => update(key, e.target.value)}
                    placeholder={placeholder || ''}
                    className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background text-foreground"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview of how it appears on documents */}
      {(form.company_name || logoPreview) && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> Document Header Preview
          </h2>
          <div className="border border-border rounded-lg p-4 bg-white">
            <div className="flex items-start gap-3 border-b-2 border-gray-900 pb-3">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="max-h-12 w-auto object-contain shrink-0" />
              )}
              <div>
                <div className="font-extrabold text-gray-900 text-base">{form.company_name || 'Company Name'}</div>
                {form.company_tagline && <div className="text-xs text-gray-500">{form.company_tagline}</div>}
                {form.company_address && <div className="text-xs text-gray-500 mt-0.5">{form.company_address}</div>}
                <div className="text-xs text-gray-500 mt-0.5">
                  {[form.company_phone_1, form.company_phone_2, form.company_phone_3].filter(Boolean).join(' · ')}
                  {form.company_email && ` · ${form.company_email}`}
                </div>
                {(form.company_tin || form.company_registration) && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {form.company_tin && `TIN: ${form.company_tin}`}
                    {form.company_tin && form.company_registration && ' · '}
                    {form.company_registration && `Reg: ${form.company_registration}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Company Settings'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle className="w-4 h-4" /> Saved — all documents updated
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
