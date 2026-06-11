'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const CATEGORIES = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'transport', label: 'Transport' },
  { value: 'office_equipment', label: 'Office Equipment' },
  { value: 'branding_material', label: 'Branding Material' },
  { value: 'software', label: 'Software' },
  { value: 'other', label: 'Other' },
];

const TYPES = [
  { value: 'development_tool', label: 'Development Tool' },
  { value: 'sales_tool', label: 'Sales Tool' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'branding', label: 'Branding' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

const FINANCIAL_CLASSES = [
  { value: 'asset', label: 'Asset' },
  { value: 'operational_asset', label: 'Operational Asset' },
  { value: 'expense_item', label: 'Expense Item' },
];

const VIEWS = [
  { value: '', label: 'All Items' },
  { value: 'assets', label: 'Assets' },
  { value: 'tools', label: 'Business Tools' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'revenue_critical', label: 'Revenue Critical' },
];

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  retired: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  damaged: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  maintenance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

function fmt(amount, currency) {
  return `${currency || 'UGX'} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('');
  const [systems, setSystems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const { addToast } = useToast();

  const emptyForm = {
    name: '', description: '', category: 'hardware', type: 'development_tool',
    financial_class: 'asset', purchase_cost: '', current_value: '', currency: 'UGX',
    acquisition_date: '', assigned_to: '', linked_system: '', revenue_dependency: false,
    status: 'active', condition: 'good', provider: '', renewal_date: '',
    serial_number: '', location: '', is_historical: false, account_deducted_from: '',
    notes: '', usage_notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const fetchItems = useCallback(async () => {
    try {
      let url = '/api/items?';
      if (view) url += `view=${view}&`;
      const res = await fetchWithAuth(url);
      if (res.success) {
        setItems(res.data || []);
        setStats(res.stats || {});
      }
    } catch (e) { console.error('Failed to fetch items:', e); }
    setLoading(false);
  }, [view]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    fetchWithAuth('/api/systems').then(r => { if (r.success) setSystems(r.data || r.systems || []); }).catch(() => {});
    fetchWithAuth('/api/staff').then(r => { if (r.success) setStaff(r.data || []); }).catch(() => {});
    fetchWithAuth('/api/accounts').then(r => { if (r.success) setAccounts(r.data || []); }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setDuplicateWarning(null);
    try {
      const body = {
        ...form,
        purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
        current_value: form.current_value ? parseFloat(form.current_value) : null,
        assigned_to: form.assigned_to || null,
        linked_system: form.linked_system || null,
        account_deducted_from: form.account_deducted_from || null,
      };

      if (editId) {
        // Update
        const res = await fetchWithAuth('/api/items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...body }),
        });
        if (res.success) {
          setShowForm(false);
          setEditId(null);
          setForm(emptyForm);
          addToast('Item updated successfully', 'success');
          fetchItems();
        } else {
          addToast(res.error || 'Failed to update item', 'error');
        }
      } else {
        // Create
        const res = await fetchWithAuth('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.success) {
          setShowForm(false);
          setForm(emptyForm);
          addToast('Item added successfully', 'success');
          fetchItems();
        } else if (res.error === 'duplicate_detected') {
          setDuplicateWarning(res);
        } else {
          addToast(res.error || res.message || 'Failed to add item', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      addToast('Network error — please try again', 'error');
    }
    setSaving(false);
  };

  const startEdit = (item) => {
    setForm({
      name: item.name || '',
      description: item.description || '',
      category: item.category || 'hardware',
      type: item.type || 'equipment',
      financial_class: item.financial_class || 'asset',
      purchase_cost: item.purchase_cost || '',
      current_value: item.current_value || '',
      currency: item.currency || 'UGX',
      acquisition_date: item.acquisition_date?.split('T')[0] || '',
      assigned_to: item.assigned_to || '',
      linked_system: item.linked_system || '',
      revenue_dependency: item.revenue_dependency || false,
      status: item.status || 'active',
      condition: item.condition || 'good',
      provider: item.provider || '',
      renewal_date: item.renewal_date?.split('T')[0] || '',
      serial_number: item.serial_number || '',
      location: item.location || '',
      is_historical: item.is_historical || false,
      account_deducted_from: '',
      notes: item.notes || '',
      usage_notes: item.usage_notes || '',
    });
    setEditId(item.id);
    setShowForm(true);
    setDuplicateWarning(null);
  };

  const deleteItem = async (id) => {
    if (!await confirmDelete('item')) return;
    await fetchWithAuth(`/api/items?id=${id}`, { method: 'DELETE' });
    toast.success('Item deleted');
    fetchItems();
  };

  if (loading) return <div className="p-8 text-center opacity-60">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Items</h1>
          <p className="text-sm opacity-60 mt-1">
            Unified register of all company assets, tools, and infrastructure
          </p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(emptyForm); setDuplicateWarning(null); }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Total Items</div>
          <div className="text-2xl font-bold mt-1">{stats.total || 0}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Assets</div>
          <div className="text-2xl font-bold mt-1">{stats.assets_count || 0}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Tools</div>
          <div className="text-2xl font-bold mt-1">{stats.tools_count || 0}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Total Value</div>
          <div className="text-xl font-bold mt-1 text-emerald-600">UGX {Math.round(parseFloat(stats.total_value || 0)).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card border-red-200 dark:border-red-800">
          <div className="text-xs font-medium text-red-600 uppercase">Revenue Critical</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{stats.revenue_critical_count || 0}</div>
          <div className="text-xs opacity-50">{fmt(stats.revenue_critical_value, 'UGX')}</div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 flex-wrap">
        {VIEWS.map(v => (
          <button key={v.value} onClick={() => setView(v.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${view === v.value ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit Item' : 'Add New Item'}</h2>

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">{duplicateWarning.message}</p>
              <button type="button" onClick={() => { startEdit(duplicateWarning.existing); setDuplicateWarning(null); }}
                className="mt-2 text-xs text-amber-700 dark:text-amber-300 underline">
                Open existing item for editing
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Founder Laptop" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Financial Class</label>
              <select value={form.financial_class} onChange={e => setForm(f => ({ ...f, financial_class: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                {FINANCIAL_CLASSES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Purchase Cost</label>
              <input type="number" step="1" min="0" value={form.purchase_cost}
                onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))}
                placeholder="0" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Current Value</label>
              <input type="number" step="1" min="0" value={form.current_value}
                onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))}
                placeholder="Same as cost" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Acquisition Date</label>
              <input type="date" value={form.acquisition_date}
                onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Linked System</label>
              <select value={form.linked_system} onChange={e => setForm(f => ({ ...f, linked_system: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Assigned To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— Unassigned —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="active">Active</option><option value="retired">Retired</option>
                <option value="lost">Lost</option><option value="damaged">Damaged</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                {['new','good','fair','poor','damaged'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>

            {/* Conditional fields */}
            {(form.category === 'infrastructure' || form.category === 'software') && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-70">Provider</label>
                  <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                    placeholder="e.g. Namecheap, Vercel" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-70">Renewal Date</label>
                  <input type="date" value={form.renewal_date} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
              </>
            )}
            {form.category === 'hardware' && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-70">Serial Number</label>
                  <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-70">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Office, Kampala" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
              </>
            )}

            {!editId && (
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Deduct from Account</label>
                <select value={form.account_deducted_from} onChange={e => setForm(f => ({ ...f, account_deducted_from: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                  <option value="">— No deduction —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium mb-1 opacity-70">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Additional details..."
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.revenue_dependency}
                onChange={e => setForm(f => ({ ...f, revenue_dependency: e.target.checked }))} className="rounded" />
              <span className="text-sm">Revenue Critical (company stops earning if this fails)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_historical}
                onChange={e => setForm(f => ({ ...f, is_historical: e.target.checked }))} className="rounded" />
              <span className="text-sm">Historical acquisition</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editId ? 'Update Item' : 'Save Item'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <p className="text-lg font-medium">No items found</p>
          <p className="text-sm mt-1">Add your first company item to get started</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {items.map(item => (
            <div key={item.id} className="p-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium">{item.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] || ''}`}>
                    {item.status}
                  </span>
                  {item.revenue_dependency && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      Revenue Critical
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                    {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                    {FINANCIAL_CLASSES.find(f => f.value === item.financial_class)?.label || item.financial_class}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm mt-1">
                  {item.purchase_cost && <span className="opacity-60">Cost: <span className="font-semibold opacity-100">{fmt(item.purchase_cost, item.currency)}</span></span>}
                  {item.current_value && item.current_value !== item.purchase_cost && (
                    <span className="opacity-60">Current: <span className="font-semibold text-emerald-600">{fmt(item.current_value, item.currency)}</span></span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs opacity-50 flex-wrap">
                  {item.system_name && <span>System: {item.system_name}</span>}
                  {item.assigned_to_name && <span>Assigned: {item.assigned_to_name}</span>}
                  {item.acquisition_date && <span>Acquired: {new Date(item.acquisition_date).toLocaleDateString()}</span>}
                  {item.provider && <span>Provider: {item.provider}</span>}
                  {item.serial_number && <span>S/N: {item.serial_number}</span>}
                  {item.location && <span>Location: {item.location}</span>}
                  {item.renewal_date && <span>Renews: {new Date(item.renewal_date).toLocaleDateString()}</span>}
                </div>
                {item.notes && <p className="text-xs opacity-40 mt-1">{item.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(item)}
                  className="p-1.5 rounded hover:bg-blue-50 text-blue-500 text-xs dark:hover:bg-blue-900/20">Edit</button>
                <button onClick={() => deleteItem(item.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-red-500 text-xs dark:hover:bg-red-900/20">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
