'use client';

import { useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';

export default function NewClientModal({ isOpen, onClose, onCreated }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '', industry: '', payment_terms: 30,
  });

  const resetForm = () => {
    setForm({ company_name: '', contact_name: '', email: '', phone: '', industry: '', payment_terms: 30 });
    setError('');
  };

  const submit = async (e) => {
    e?.preventDefault(); setError('');
    if (!form.company_name.trim()) { setError('Company name is required'); return; }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Client created');
        resetForm();
        onClose();
        if (onCreated) onCreated(json.data);
      } else setError(json.error || 'Failed to create client');
    } catch (err) { console.error(err); setError(err.message || 'Network error'); } finally { setSaving(false); }
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Client"
      subtitle="Add a new client to your CRM"
      size="md"
      footer={
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm">
            <Save className="w-4 h-4" /> {saving ? 'Creating...' : 'Create Client'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Company Name *</label>
          <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
            placeholder="e.g. Kampala Logistics Ltd" className={inputClass} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Contact Name</label>
            <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              placeholder="Primary contact" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+256 ..." className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="client@example.com" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
            <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              placeholder="e.g. Transportation" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Payment Terms (days)</label>
            <input type="number" min="0" value={form.payment_terms}
              onChange={e => setForm(f => ({ ...f, payment_terms: parseInt(e.target.value) || 0 }))}
              className={inputClass} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
