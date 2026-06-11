import { useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';

export function SystemModuleModal({ isOpen, onClose, systemId, onSuccess }) {
  const toast = useToast();
  const [formData, setFormData] = useState({ module_name: '', description: '', status: 'active', module_url: '', version: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.module_name.trim()) {
      setError('Module name is required');
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetchWithAuth(`/api/systems/${systemId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add module');
        return;
      }

      toast.success('Module added successfully');
      setFormData({ module_name: '', description: '', status: 'active', module_url: '', version: '' });
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
    <Modal isOpen={isOpen} onClose={onClose} title="Add Module" size="md" footer={
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">Cancel</button>
        <button onClick={handleSubmit} disabled={isLoading} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"><Save className="w-4 h-4" /> {isLoading ? 'Adding...' : 'Add Module'}</button>
      </div>
    }>
      <div className="space-y-4">
        {error && <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
        <div><label className="block text-sm font-medium text-foreground mb-1">Module Name *</label><input type="text" name="module_name" value={formData.module_name} onChange={handleChange} placeholder="Authentication" className={inputClass} /></div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Description</label><textarea name="description" value={formData.description} onChange={handleChange} placeholder="Module details..." rows="3" className={`${inputClass} resize-none`} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-foreground mb-1">Status</label><select name="status" value={formData.status} onChange={handleChange} className={inputClass}><option value="active">Active</option><option value="inactive">Inactive</option><option value="deprecated">Deprecated</option><option value="planned">Planned</option></select></div>
          <div><label className="block text-sm font-medium text-foreground mb-1">Version</label><input type="text" name="version" value={formData.version} onChange={handleChange} placeholder="1.0.0" className={inputClass} /></div>
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Module URL</label><input type="url" name="module_url" value={formData.module_url} onChange={handleChange} placeholder="https://..." className={inputClass} /></div>
      </div>
    </Modal>
  );
}
