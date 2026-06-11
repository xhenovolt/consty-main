'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Lock } from 'lucide-react';
import Link from 'next/link';

export default function TechStackDetailPage({ params }) {
  const { id } = params;
  const [stack, setStack] = useState(null);
  const [items, setItems] = useState([]);
  const [linkedSystems, setLinkedSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState({ type: 'framework', name: '', version: '' });
  const [showCredForm, setShowCredForm] = useState(false);
  const [newCred, setNewCred] = useState({ key_name: '', value: '', description: '' });

  useEffect(() => {
    loadStackDetails();
  }, [id]);

  const loadStackDetails = async () => {
    try {
      const res = await fetch(`/api/tech-stacks/${id}`);
      const data = await res.json();
      setStack(data.stack);
      setItems(data.items || []);
      setLinkedSystems(data.linkedSystems || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    try {
      const res = await fetch(`/api/tech-stacks/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      if (res.ok) {
        loadStackDetails();
        setNewItem({ type: 'framework', name: '', version: '' });
        setShowNewItem(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteItem = async (itemId) => {
    if (!confirm('Delete this component?')) return;

    try {
      await fetch(`/api/tech-stacks/${id}/items/${itemId}`, { method: 'DELETE' });
      loadStackDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const addCredential = async (e) => {
    e.preventDefault();
    if (!newCred.key_name.trim() || !newCred.value.trim()) return;

    try {
      const res = await fetch(`/api/tech-stacks/${id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCred),
      });

      if (res.ok) {
        loadStackDetails();
        setNewCred({ key_name: '', value: '', description: '' });
        setShowCredForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!stack) return <div className="p-6">Stack not found</div>;

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link href="/app/tech-intelligence" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back to Tech Stacks
      </Link>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold">{stack.name}</h1>
        <p className="text-gray-600 mt-2">{stack.description}</p>
      </div>

      {/* Linked Systems */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Linked Systems ({linkedSystems.length})</h2>
        {linkedSystems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {linkedSystems.map((sys) => (
              <Link
                key={sys.id}
                href={`/app/systems/${sys.id}`}
                className="p-3 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20"
              >
                {sys.system_name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No systems use this tech stack yet</p>
        )}
      </div>

      {/* Components */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Components ({items.length})</h2>
          <button
            onClick={() => setShowNewItem(!showNewItem)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {showNewItem && (
          <form onSubmit={addItem} className="bg-gray-50 border border-dashed rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="language">Language</option>
                  <option value="framework">Framework</option>
                  <option value="database">Database</option>
                  <option value="tool">Tool</option>
                  <option value="infra">Infrastructure</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g., Node.js"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Version</label>
                <input
                  type="text"
                  value={newItem.version}
                  onChange={(e) => setNewItem({ ...newItem, version: e.target.value })}
                  placeholder="e.g., 18.0"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                Add Component
              </button>
              <button
                type="button"
                onClick={() => setShowNewItem(false)}
                className="bg-gray-300 text-gray-900 px-3 py-1 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {Object.entries(groupedItems).map(([type, typeItems]) => (
            <div key={type} className="border rounded-lg p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">{type}</h3>
              <div className="space-y-2">
                {typeItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.version && <p className="text-xs text-gray-600">v{item.version}</p>}
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && !showNewItem && (
          <p className="text-gray-600 text-sm">No components yet</p>
        )}
      </div>

      {/* Credentials */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Encrypted Credentials</h2>
            <Lock className="w-4 h-4 text-yellow-600" />
          </div>
          <button
            onClick={() => setShowCredForm(!showCredForm)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Credential
          </button>
        </div>

        {showCredForm && (
          <form onSubmit={addCredential} className="bg-gray-50 border border-dashed rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Key Name</label>
              <input
                type="text"
                value={newCred.key_name}
                onChange={(e) => setNewCred({ ...newCred, key_name: e.target.value })}
                placeholder="API_KEY, DB_PASSWORD, etc"
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Value (encrypted)</label>
              <input
                type="password"
                value={newCred.value}
                onChange={(e) => setNewCred({ ...newCred, value: e.target.value })}
                placeholder="••••••••••"
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <input
                type="text"
                value={newCred.description}
                onChange={(e) => setNewCred({ ...newCred, description: e.target.value })}
                placeholder="What is this for?"
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                Save Credential
              </button>
              <button
                type="button"
                onClick={() => setShowCredForm(false)}
                className="bg-gray-300 text-gray-900 px-3 py-1 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-gray-600 mb-3">Values are encrypted and never displayed. Only key names are shown for reference.</p>
        <div className="space-y-2">
          {/* Credentials would be displayed here (but not their values) */}
          <p className="text-gray-600 text-sm">Credentials stored securely</p>
        </div>
      </div>
    </div>
  );
}
