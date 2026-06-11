import { useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';

export function TechProfileModal({ isOpen, onClose, systemId, onSuccess }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    language: '', framework: '', framework_version: '',
    database: '', db_version: '', platform: 'web',
    hosting: '', deployment_url: '', notes: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetchWithAuth(`/api/systems/${systemId}/tech-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add tech profile');
        return;
      }

      toast.success('Tech profile added successfully');
      setFormData({ language: '', framework: '', framework_version: '', database: '', db_version: '', platform: 'web', hosting: '', deployment_url: '', notes: '' });
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Tech Stack" size="md" footer={
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">Cancel</button>
        <button onClick={handleSubmit} disabled={isLoading} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"><Save className="w-4 h-4" /> {isLoading ? 'Adding...' : 'Add Profile'}</button>
      </div>
    }>
      <div className="space-y-4">
        {error && <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-foreground mb-1">Language</label><input type="text" name="language" value={formData.language} onChange={handleChange} placeholder="TypeScript" className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1">Framework</label><input type="text" name="framework" value={formData.framework} onChange={handleChange} placeholder="React" className={inputClass} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-foreground mb-1">Framework Version</label><input type="text" name="framework_version" value={formData.framework_version} onChange={handleChange} placeholder="19.2.3" className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1">Database</label><input type="text" name="database" value={formData.database} onChange={handleChange} placeholder="PostgreSQL" className={inputClass} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-foreground mb-1">DB Version</label><input type="text" name="db_version" value={formData.db_version} onChange={handleChange} placeholder="16" className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1">Platform</label><select name="platform" value={formData.platform} onChange={handleChange} className={inputClass}><option value="web">Web</option><option value="mobile">Mobile</option><option value="desktop">Desktop</option></select></div>
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Hosting</label><input type="text" name="hosting" value={formData.hosting} onChange={handleChange} placeholder="Vercel" className={inputClass} /></div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Deployment URL</label><input type="url" name="deployment_url" value={formData.deployment_url} onChange={handleChange} placeholder="https://..." className={inputClass} /></div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes..." rows="3" className={`${inputClass} resize-none`} /></div>
      </div>
    </Modal>
  );
}
