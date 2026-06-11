'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, ChevronDown, AlertCircle, BookOpen, Code, CheckCircle, Zap, Lock, Shield, TrendingUp, AlertTriangle, FileText } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const CATEGORY_COLORS = {
  architecture: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Code },
  feature: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Zap },
  bug_fix: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle },
  deployment: { bg: 'bg-purple-100', text: 'text-purple-700', icon: TrendingUp },
  decision: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: FileText },
  integration: { bg: 'bg-pink-100', text: 'text-pink-700', icon: Shield },
  performance: { bg: 'bg-orange-100', text: 'text-orange-700', icon: Zap },
  security: { bg: 'bg-red-100', text: 'text-red-700', icon: Lock },
  scaling: { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: TrendingUp },
  api: { bg: 'bg-violet-100', text: 'text-violet-700', icon: Code },
  database: { bg: 'bg-slate-100', text: 'text-slate-700', icon: FileText },
  infrastructure: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Code },
  guide: { bg: 'bg-green-100', text: 'text-green-700', icon: BookOpen },
  troubleshooting: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
  release_notes: { bg: 'bg-amber-100', text: 'text-amber-700', icon: CheckCircle },
};

export function SystemIntelligenceTab({ systemId, systemName }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    title: '',
    category: 'guide',
    content: '',
    summary: '',
    tags: '',
    is_public: true,
  });

  const [importData, setImportData] = useState({
    files: [],
    autoDetectCategory: true,
  });

  useEffect(() => {
    loadIntelligence();
  }, [systemId, selectedCategory]);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetchWithAuth(`/api/systems/${systemId}/intelligence?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEntries(json.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        category: formData.category,
        content: formData.content,
        summary: formData.summary || formData.content.substring(0, 200),
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        is_public: formData.is_public,
      };

      const res = await fetchWithAuth(`/api/systems/${systemId}/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setEntries(prev => [json.data, ...prev]);
        setFormData({ title: '', category: 'guide', content: '', summary: '', tags: '', is_public: true });
        setShowCreateForm(false);
        toast.success('Intelligence entry created');
      } else {
        toast.error(json.error || 'Failed to create entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error creating entry');
    }
  };

  const handleImportMarkdown = async (e) => {
    e.preventDefault();
    if (importData.files.length === 0) {
      toast.error('Please select markdown files to import');
      return;
    }

    try {
      setImportLoading(true);

      // Read files and prepare payload
      const filesData = [];
      for (const file of importData.files) {
        const content = await file.text();
        filesData.push({
          filename: file.name,
          content,
        });
      }

      const res = await fetchWithAuth('/api/intelligence/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          files: filesData,
          autoDetectCategory: importData.autoDetectCategory,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Imported ${json.summary.successful} files successfully`);
        setImportData({ files: [], autoDetectCategory: true });
        setShowImportForm(false);
        loadIntelligence();
      } else {
        toast.error(json.message || 'Import failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error importing files');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Delete this intelligence entry?')) return;

    try {
      const res = await fetchWithAuth(`/api/systems/${systemId}/intelligence/${entryId}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (json.success) {
        setEntries(prev => prev.filter(e => e.id !== entryId));
        setSelectedEntry(null);
        toast.success('Entry deleted');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete entry');
    }
  };

  const getCategoryInfo = (category) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.guide;
  };

  const filteredEntries = searchQuery
    ? entries.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Technical Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized knowledge base for {systemName} — accessible without source code
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportForm(!showImportForm)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Import MD Files
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>
      </div>

      {/* Import Form */}
      {showImportForm && (
        <form onSubmit={handleImportMarkdown} className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Import Markdown Files</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">Select .md files</label>
              <input
                type="file"
                multiple
                accept=".md,.txt"
                onChange={(e) => setImportData(prev => ({ ...prev, files: Array.from(e.target.files || []) }))}
                className="w-full border border-purple-300 rounded-lg px-3 py-2"
              />
              {importData.files.length > 0 && (
                <p className="text-sm text-purple-700 mt-2">{importData.files.length} file(s) selected</p>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={importData.autoDetectCategory}
                onChange={(e) => setImportData(prev => ({ ...prev, autoDetectCategory: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-foreground">Auto-detect category from filename</span>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={importLoading || importData.files.length === 0}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {importLoading ? 'Importing...' : 'Import'}
              </button>
              <button
                type="button"
                onClick={() => setShowImportForm(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateEntry} className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">New Intelligence Entry</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-background text-foreground"
            />
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-background text-foreground"
            >
              {Object.keys(CATEGORY_COLORS).map(cat => (
                <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <textarea
              placeholder="Content..."
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={6}
              className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-background text-foreground font-mono text-sm"
            />
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-background text-foreground"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-foreground">Public (visible to all)</span>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
              >
                Create Entry
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search intelligence entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted transition"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-3">Category</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  selectedCategory === null ? 'bg-blue-600 text-white' : 'border border-border hover:bg-background'
                }`}
              >
                All
              </button>
              {Object.keys(CATEGORY_COLORS).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedCategory === cat ? getCategoryInfo(cat).bg + ' ' + getCategoryInfo(cat).text : 'border border-border hover:bg-background'
                  }`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading intelligence...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted rounded-lg">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No intelligence entries yet</p>
            <p className="text-xs mt-1">Create new entries or import markdown files to populate the knowledge base</p>
          </div>
        ) : (
          filteredEntries.map(entry => {
            const categoryInfo = getCategoryInfo(entry.category);
            const IconComponent = categoryInfo.icon;

            return (
              <div
                key={entry.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition cursor-pointer"
                onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`${categoryInfo.bg} p-2 rounded-lg mt-0.5`}>
                        <IconComponent className={`w-4 h-4 ${categoryInfo.text}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{entry.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{entry.summary || entry.content.substring(0, 100)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${categoryInfo.bg} ${categoryInfo.text}`}>
                        {entry.category.replace(/_/g, ' ')}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntry(entry.id);
                        }}
                        className="text-muted-foreground hover:text-red-600 transition"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-3">
                      {entry.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                      {entry.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{entry.tags.length - 3} more</span>
                      )}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                    <span>v{entry.version_number || 1}</span>
                    <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedEntry === entry.id && (
                  <div className="border-t border-border bg-background p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                        <code>{entry.content}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
