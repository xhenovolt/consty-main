'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Save, Download, Eye, EyeOff, Undo2, ArrowLeft,
  Layers, ChevronLeft, ChevronRight, Pencil
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { DesignCanvas } from '@/components/editor/DesignCanvas';
import { EditorLeftSidebar } from '@/components/editor/EditorLeftSidebar';
import { InspectorPanel } from '@/components/editor/InspectorPanel';
import { ExportModal } from '@/components/editor/ExportModal';
import { useDesignEditor } from '@/hooks/useDesignEditor';

function LayerListPanel({ layers, selectedId, onSelect, onRemove }) {
  const sorted = [...layers].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  return (
    <div className="border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Layers ({layers.length})</p>
      <div className="overflow-y-auto max-h-40">
        {sorted.map(layer => (
          <div
            key={layer.id}
            onClick={() => onSelect(layer.id)}
            className={`flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs ${selectedId === layer.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
          >
            <span className="truncate max-w-[140px]">
              {layer.type === 'text' ? `"${(layer.value || '').slice(0, 18)}"` : `${layer.type} ${layer.id.slice(-4)}`}
            </span>
            <button onClick={e => { e.stopPropagation(); onRemove(layer.id); }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-500 px-1">×</button>
          </div>
        ))}
        {layers.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 pb-2">No layers yet</p>
        )}
      </div>
    </div>
  );
}

export default function DesignEditorPage() {
  const { templateId } = useParams();
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef(null);

  const [initialDesign, setInitialDesign] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [designName, setDesignName] = useState('Untitled Design');
  const [editingName, setEditingName] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [actualDesignId, setActualDesignId] = useState(null);

  // Load design and templates
  useEffect(() => {
    async function load() {
      try {
        // Load templates for sidebar
        const tRes = await fetch('/api/designs?templates=true', { credentials: 'include' });
        if (tRes.ok) {
          const tData = await tRes.json();
          setTemplates(tData.data?.filter(t => t.is_template) || []);
        }

        if (templateId === 'new') {
          // Create fresh design
          const res = await fetch('/api/designs', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Untitled Design' }),
          });
          if (res.ok) {
            const data = await res.json();
            setInitialDesign(data.data);
            setDesignName(data.data.name);
            setActualDesignId(data.data.id);
          }
        } else {
          // Load existing or template
          const res = await fetch(`/api/designs/${templateId}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const design = data.data;
            // If it's a template, clone it first
            if (design.is_template) {
              const clone = await fetch(`/api/designs/${templateId}/clone`, { method: 'POST', credentials: 'include' });
              if (clone.ok) {
                const cloneData = await clone.json();
                setInitialDesign(cloneData.data);
                setDesignName(cloneData.data.name);
                setActualDesignId(cloneData.data.id);
              }
            } else {
              setInitialDesign(design);
              setDesignName(design.name);
              setActualDesignId(design.id);
            }
          } else {
            toast.error('Design not found');
            router.push('/app/designs');
          }
        }
      } catch (err) {
        toast.error('Failed to load design');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [templateId]);

  const editor = useDesignEditor({ initialDesign, designId: actualDesignId });

  const handleSaveName = useCallback(async (name) => {
    setEditingName(false);
    setDesignName(name);
    if (!actualDesignId) return;
    try {
      await fetch(`/api/designs/${actualDesignId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    } catch {}
  }, [actualDesignId]);

  const handleManualSave = useCallback(async () => {
    await editor.save();
    toast.success('Design saved');
  }, [editor, toast]);

  const handleLoadTemplate = useCallback((template) => {
    if (confirm('Load this template? Current layers will be replaced.')) {
      editor.updateCanvas(template.canvas || {});
      // We can't directly set layers from here via editor hook — use a workaround
      // by reloading page with template ID
      router.push(`/app/designs/editor/${template.id}`);
    }
  }, [editor, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top toolbar */}
      <div className="h-12 border-b border-border flex items-center gap-2 px-3 shrink-0 bg-background z-10">
        <button onClick={() => router.push('/app/designs')}
          className="p-1.5 hover:bg-muted/50 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Design name */}
        {editingName ? (
          <input
            autoFocus
            type="text"
            defaultValue={designName}
            className="text-sm font-medium border border-border rounded px-2 py-0.5 bg-muted/30 min-w-[150px]"
            onBlur={e => handleSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveName(e.target.value)}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1.5 text-sm font-medium hover:bg-muted/50 px-2 py-1 rounded-lg"
          >
            {designName}
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
        )}

        {editor.isDirty && !editor.isSaving && (
          <span className="text-xs text-amber-500 ml-1">● Unsaved</span>
        )}
        {editor.isSaving && (
          <span className="text-xs text-muted-foreground ml-1 animate-pulse">Saving...</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => editor.setPreviewMode(p => !p)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/50 text-muted-foreground">
            {editor.previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {editor.previewMode ? 'Exit Preview' : 'Preview'}
          </button>
          <button onClick={handleManualSave} disabled={!editor.isDirty}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/50 disabled:opacity-40">
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div className={`border-r border-border flex flex-col transition-all duration-200 ${leftOpen ? 'w-56' : 'w-0'} overflow-hidden shrink-0`}>
          <EditorLeftSidebar
            onAddLayer={editor.addLayer}
            onUpdateCanvas={editor.updateCanvas}
            canvas={editor.canvas}
            templates={templates}
            onLoadTemplate={handleLoadTemplate}
          />
          <LayerListPanel
            layers={editor.layers}
            selectedId={editor.selectedId}
            onSelect={editor.setSelectedId}
            onRemove={editor.removeLayer}
          />
        </div>

        {/* Toggle left */}
        <button
          onClick={() => setLeftOpen(o => !o)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 translate-x-[calc(var(--left-w)-1px)] w-4 h-8 bg-border hover:bg-muted flex items-center justify-center rounded-r border border-border border-l-0"
          style={{ '--left-w': leftOpen ? '224px' : '0px' }}
        >
          {leftOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-6">
          <div
            style={{
              width: editor.canvas.width,
              height: editor.canvas.height,
              position: 'relative',
            }}
          >
            <DesignCanvas
              canvas={editor.canvas}
              layers={editor.layers}
              selectedId={editor.previewMode ? null : editor.selectedId}
              onSelect={editor.setSelectedId}
              onUpdateLayer={editor.updateLayer}
              previewMode={editor.previewMode}
              canvasRef={canvasRef}
            />
          </div>
        </div>

        {/* Right inspector */}
        <div className={`border-l border-border transition-all duration-200 ${rightOpen ? 'w-60' : 'w-0'} overflow-hidden shrink-0`}>
          <InspectorPanel
            layer={editor.selectedLayer}
            onUpdate={(changes) => editor.selectedId && editor.updateLayer(editor.selectedId, changes)}
            onRemove={editor.removeLayer}
            onClone={editor.cloneSelected}
            onBringForward={editor.bringForward}
            onSendBackward={editor.sendBackward}
            onBringToFront={editor.bringToFront}
            onSendToBack={editor.sendToBack}
          />
        </div>

        {/* Toggle right */}
        <button
          onClick={() => setRightOpen(o => !o)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-4 h-8 bg-border hover:bg-muted flex items-center justify-center rounded-l border border-border border-r-0"
          style={{ transform: `translateY(-50%) translateX(${rightOpen ? 'calc(-240px - 1px)' : '0'})` }}
        >
          {rightOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Keyboard hints */}
      {!editor.previewMode && (
        <div className="h-7 border-t border-border flex items-center gap-4 px-4 text-xs text-muted-foreground bg-background shrink-0">
          <span>Arrow keys: move 1px • Shift+Arrow: 10px</span>
          <span>Ctrl+D: duplicate</span>
          <span>Del: remove</span>
          <span>Dbl-click text: edit</span>
          <span>Escape: deselect</span>
        </div>
      )}

      {showExport && (
        <ExportModal
          canvasId="design-canvas"
          designName={designName}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
