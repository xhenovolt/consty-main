'use client';

import { useEffect, useState } from 'react';
import { FileText, Search, Filter, Download, Eye, Folder, Plus, X, File, Image, FileSpreadsheet } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const CATEGORY_ICONS = {
  invoice: FileText, contract: File, receipt: FileSpreadsheet,
  proposal: FileText, report: FileText, other: File,
};
const CATEGORY_COLORS = {
  invoice: 'text-blue-600', contract: 'text-purple-600', receipt: 'text-emerald-600',
  proposal: 'text-orange-600', report: 'text-gray-600', other: 'text-gray-500',
};

export default function DocumentCenterPage() {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'other', description: '', entity_type: '', entity_id: '', file_url: '' });
  const toast = useToast();

  const fetchDocuments = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter) params.append('category', categoryFilter);
      const res = await fetchWithAuth(`/api/documents?${params}`);
      const json = res.json ? await res.json() : res;
      if (json.success) {
        setDocuments(json.data || []);
        setCategories(json.categories || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchDocuments(); }, [categoryFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const submitDocument = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = res.json ? await res.json() : res;
      if (json.success) {
        toast.success('Document added');
        setShowForm(false);
        setForm({ title: '', category: 'other', description: '', entity_type: '', entity_id: '', file_url: '' });
        fetchDocuments();
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const totalDocs = categories.reduce((sum, c) => sum + parseInt(c.count || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Center</h1>
          <p className="text-sm text-muted-foreground mt-1">All generated documents in one place</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Document
        </button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <button onClick={() => setCategoryFilter('')} className={`bg-card rounded-xl border p-3 text-center hover:shadow-md transition-shadow ${!categoryFilter ? 'ring-2 ring-blue-500' : ''}`}>
          <Folder className="w-6 h-6 mx-auto text-blue-600 mb-1" />
          <div className="text-xs text-muted-foreground">All</div>
          <div className="text-lg font-bold">{totalDocs}</div>
        </button>
        {categories.map(cat => {
          const Icon = CATEGORY_ICONS[cat.category] || File;
          const color = CATEGORY_COLORS[cat.category] || 'text-gray-500';
          return (
            <button key={cat.category} onClick={() => setCategoryFilter(cat.category)} className={`bg-card rounded-xl border p-3 text-center hover:shadow-md transition-shadow ${categoryFilter === cat.category ? 'ring-2 ring-blue-500' : ''}`}>
              <Icon className={`w-6 h-6 mx-auto ${color} mb-1`} />
              <div className="text-xs text-muted-foreground capitalize">{cat.category}</div>
              <div className="text-lg font-bold">{cat.count}</div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-background" />
        </div>
        <button type="submit" className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-foreground rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700">Search</button>
      </form>

      {/* Add Document Form */}
      {showForm && (
        <form onSubmit={submitDocument} className="bg-card rounded-xl border p-5 space-y-3">
          <div className="flex justify-between items-center"><h3 className="font-semibold">Add Document</h3><button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
            <div><label className="text-xs text-muted-foreground">Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background">{['invoice', 'contract', 'receipt', 'proposal', 'report', 'other'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-muted-foreground">File URL</label><input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" placeholder="https://..." /></div>
            <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save Document</button>
        </form>
      )}

      {/* Document List */}
      <div className="bg-card rounded-xl border divide-y">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No documents found</p></div>
        ) : documents.map(doc => {
          const Icon = CATEGORY_ICONS[doc.category] || File;
          const color = CATEGORY_COLORS[doc.category] || 'text-gray-500';
          return (
            <div key={doc.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{doc.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="capitalize">{doc.category}</span>
                    <span>•</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    {doc.creator_name && <><span>•</span><span>{doc.creator_name}</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.file_url && (
                  <>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg dark:bg-blue-900/30 dark:text-blue-300"><Eye className="w-4 h-4" /></a>
                    <a href={doc.file_url} download className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg dark:bg-emerald-900/30 dark:text-emerald-300"><Download className="w-4 h-4" /></a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
