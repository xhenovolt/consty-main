'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Copy, Trash2, Layout } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { confirmAction } from '@/lib/api-client';
import { PageTransition } from '@/components/ui/PageTransition';
import { motion } from 'framer-motion';

function DesignCard({ design, onEdit, onClone, onDelete }) {
  const [hovering, setHovering] = useState(false);
  const canvas = design.canvas || {};
  const aspect = canvas.height && canvas.width ? canvas.height / canvas.width : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Thumbnail / preview */}
      <div
        className="w-full relative flex items-center justify-center overflow-hidden"
        style={{ paddingBottom: `${Math.min(aspect * 100, 100)}%`, background: canvas.background || '#f1f5f9' }}
      >
        {design.thumbnail ? (
          <img src={design.thumbnail} alt={design.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Layout className="w-8 h-8 text-muted-foreground/40" />
          </div>
        )}

        {/* Hover overlay */}
        {hovering && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
            <button onClick={() => onEdit(design.id)}
              className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100">
              Edit
            </button>
          </div>
        )}

        {design.is_template && (
          <span className="absolute top-2 left-2 text-[10px] font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
            Template
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{design.name}</p>
          <p className="text-xs text-muted-foreground">{canvas.width}×{canvas.height}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onClone(design.id)} title="Duplicate"
            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {!design.is_template && (
            <button onClick={() => onDelete(design.id)} title="Delete"
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function DesignsPage() {
  const router = useRouter();
  const toast = useToast();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/designs', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDesigns(data.data || []);
      }
    } catch {
      toast.error('Failed to load designs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => router.push('/app/designs/editor/new');

  const handleEdit = (id) => router.push(`/app/designs/editor/${id}`);

  const handleClone = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/designs/${id}/clone`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        toast.success('Design duplicated');
        router.push(`/app/designs/editor/${data.data.id}`);
      }
    } catch { toast.error('Failed to duplicate'); }
  }, [router, toast]);

  const handleDelete = useCallback(async (id) => {
    const ok = await confirmAction('Delete design?', 'This cannot be undone.', 'Delete', 'warning');
    if (!ok) return;
    try {
      const res = await fetch(`/api/designs/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Design deleted');
        setDesigns(prev => prev.filter(d => d.id !== id));
      }
    } catch { toast.error('Failed to delete'); }
  }, [toast]);

  const templates = designs.filter(d => d.is_template);
  const myDesigns = designs.filter(d => !d.is_template);

  return (
    <PageTransition className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Designs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage your designs</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Design
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 animate-pulse">
              <div className="aspect-square" />
              <div className="p-3"><div className="h-4 bg-muted rounded w-3/4" /></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Templates section */}
          {templates.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Starter Templates</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {templates.map(d => (
                  <DesignCard key={d.id} design={d} onEdit={handleEdit} onClone={handleClone} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}

          {/* My designs section */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              My Designs {myDesigns.length > 0 && `(${myDesigns.length})`}
            </h2>
            {myDesigns.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
                <Layout className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground mb-2">No designs yet</p>
                <p className="text-sm text-muted-foreground mb-4">Start from a template or create a blank design</p>
                <button onClick={handleCreate}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                  Create your first design
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {myDesigns.map(d => (
                  <DesignCard key={d.id} design={d} onEdit={handleEdit} onClone={handleClone} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PageTransition>
  );
}
