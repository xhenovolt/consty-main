'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Grid3X3, AlertCircle, Eye, Search, BookOpen, Code, Zap, Shield, TrendingUp, FileText } from 'lucide-react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const CATEGORY_STYLES = {
  architecture: { icon: Code, color: 'text-blue-600' },
  feature: { icon: Zap, color: 'text-emerald-600' },
  bug_fix: { icon: AlertCircle, color: 'text-red-600' },
  deployment: { icon: TrendingUp, color: 'text-purple-600' },
  guide: { icon: BookOpen, color: 'text-green-600' },
  security: { icon: Shield, color: 'text-red-600' },
  api: { icon: Code, color: 'text-violet-600' },
  default: { icon: FileText, color: 'text-gray-600' },
};

export default function TechIntelligencePage() {
  const [activeTab, setActiveTab] = useState('search');
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStack, setNewStack] = useState({ name: '', description: '' });
  
  // Intelligence search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (activeTab === 'stacks') loadStacks();
  }, [activeTab]);

  const loadStacks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tech-stacks');
      const data = await res.json();
      setStacks(data.stacks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const res = await fetchWithAuth(`/api/intelligence/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data || []);
      } else {
        toast.error('Search failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Search error');
    } finally {
      setSearchLoading(false);
    }
  };

  const createStack = async (e) => {
    e.preventDefault();
    if (!newStack.name.trim()) return;

    try {
      const res = await fetch('/api/tech-stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStack),
      });

      if (res.ok) {
        setNewStack({ name: '', description: '' });
        setShowCreateForm(false);
        loadStacks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteStack = async (id) => {
    if (!confirm('Delete this tech stack? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/tech-stacks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadStacks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (activeTab === 'stacks' && loading) return <div className="p-6">Loading tech stacks...</div>;

  const TabButton = ({ label, id }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-lg font-medium transition ${
        activeTab === id
          ? 'bg-blue-600 text-white'
          : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            Technical Intelligence Hub
          </h1>
          <p className="text-muted-foreground mt-1">Centralized knowledge base for all systems - search, explore, and manage intelligence</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton label="🔍 Search Intelligence" id="search" />
        <TabButton label="🔧 Tech Stacks" id="stacks" />
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <form onSubmit={performSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search across all system intelligence (architecture, features, guides, etc)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full l-10 pr-3 py-3 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
              <button
                type="submit"
                disabled={searchLoading || !searchQuery.trim()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{searchResults.length} results found for "{searchQuery}"</p>
              {searchResults.map((result) => {
                const categoryInfo = CATEGORY_STYLES[result.category] || CATEGORY_STYLES.default;
                const IconComponent = categoryInfo.icon;
                
                return (
                  <div
                    key={result.id}
                    className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                    onClick={() => setSelectedResult(selectedResult?.id === result.id ? null : result)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`${categoryInfo.color} p-2 rounded-lg`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{result.title}</h3>
                          <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                            {result.category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          System: <Link href={`/app/systems/${result.system_id}`} className="text-blue-600 hover:underline">
                            {result.system_name}
                          </Link>
                        </p>
                        {result.tags && result.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {result.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-xs bg-background px-2 py-0.5 rounded text-muted-foreground border border-border">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(result.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {selectedResult?.id === result.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <pre className="bg-muted p-3 rounded text-sm overflow-x-auto max-h-48 text-muted-foreground">
                          {result.summary || result.content?.substring(0, 500)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {searchQuery && !searchLoading && searchResults.length === 0 && (
            <div className="text-center py-12 bg-muted rounded-lg">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-12 bg-muted rounded-lg">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Search for architecture, features, guides, and more...</p>
            </div>
          )}
        </div>
      )}

      {/* Tech Stacks Tab */}
      {activeTab === 'stacks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Reusable Tech Stacks</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Stack
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={createStack} className="bg-muted border border-border rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Stack Name</label>
                  <input
                    type="text"
                    value={newStack.name}
                    onChange={(e) => setNewStack({ ...newStack, name: e.target.value })}
                    placeholder="e.g., Next.js SaaS Stack"
                    className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Description</label>
                  <textarea
                    value={newStack.description}
                    onChange={(e) => setNewStack({ ...newStack, description: e.target.value })}
                    placeholder="Describe this tech stack..."
                    className="w-full border border-border rounded px-3 py-2 bg-background text-foreground h-20"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition"
                  >
                    Create Stack
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="bg-muted text-muted-foreground px-4 py-2 rounded hover:bg-background border border-border transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stacks.map((stack) => (
              <div key={stack.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">{stack.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{stack.description}</p>
                  </div>
                  <button
                    onClick={() => deleteStack(stack.id)}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded ml-2 transition dark:bg-red-900/30 dark:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground border-t border-border pt-4 mb-4">
                  <div>
                    <span className="font-medium text-foreground">{stack.item_count}</span> components
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{stack.system_count}</span> systems
                  </div>
                </div>
                <Link
                  href={`/app/tech-intelligence/${stack.id}`}
                  className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </Link>
              </div>
            ))}
          </div>

          {stacks.length === 0 && (
            <div className="text-center py-12 bg-muted rounded-lg">
              <Grid3X3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No tech stacks yet. Create one to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

