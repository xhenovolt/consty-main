import { useState, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';

export function EmployeeAccountModal({ isOpen, onClose, staffList, onSuccess }) {
  const toast = useToast();
  const [formData, setFormData] = useState({ staff_id: '', account_id: '', currency: 'UGX', notes: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const fetchAccounts = async () => {
    try {
      const res = await fetchWithAuth('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.staff_id || !formData.account_id) {
      setError('Staff member and account are required');
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetchWithAuth('/api/employee-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create employee account');
        return;
      }

      toast.success('Employee account created successfully');
      setFormData({ staff_id: '', account_id: '', currency: 'UGX', notes: '' });
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create Employee Account" size="md" footer={
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">Cancel</button>
        <button onClick={handleSubmit} disabled={isLoading} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"><Save className="w-4 h-4" /> {isLoading ? 'Creating...' : 'Create Account'}</button>
      </div>
    }>
      <div className="space-y-4">
        {error && <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
        <div><label className="block text-sm font-medium text-foreground mb-1">Staff Member *</label><select name="staff_id" value={formData.staff_id} onChange={handleChange} className={inputClass}><option value="">Select staff...</option>{staffList?.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Linked Account *</label><select name="account_id" value={formData.account_id} onChange={handleChange} className={inputClass}><option value="">Select account...</option>{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>)}</select></div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Currency</label><select name="currency" value={formData.currency} onChange={handleChange} className={inputClass}><option value="UGX">UGX</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="KES">KES</option></select></div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes..." rows="3" className={`${inputClass} resize-none`} /></div>
      </div>
    </Modal>
  );
}
  );
}
