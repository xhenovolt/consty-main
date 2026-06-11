'use client';

/**
 * useDesignEditor — Core state engine for the Consty Design Editor
 * Manages layers, selection, undo history, auto-save
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';

const AUTOSAVE_INTERVAL_MS = 5000;

function cloneLayer(layer) {
  return { ...layer, id: uuid() };
}

export function useDesignEditor({ initialDesign, designId }) {
  const [canvas, setCanvas] = useState(
    initialDesign?.canvas || { width: 1080, height: 1080, background: '#ffffff' }
  );
  const [layers, setLayers] = useState(initialDesign?.layers || []);
  const [selectedId, setSelectedId] = useState(null);
  const [historyStack, setHistoryStack] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Push to undo history (defined before updateLayers)
  const pushHistory = useCallback((newLayers) => {
    setHistoryStack(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newLayers].slice(-50); // keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Update layers + mark dirty
  const updateLayers = useCallback((fn) => {
    setLayers(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      setIsDirty(true);
      return next;
    });
  }, []);

  // ─── Layer mutations ────────────────────────────────────────────

  const addLayer = useCallback((layer) => {
    const newLayer = {
      id: uuid(),
      x: 100, y: 100,
      width: 200, height: 200,
      rotation: 0,
      opacity: 1,
      zIndex: layers.length,
      ...layer,
    };
    updateLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  }, [layers.length, updateLayers]);

  const updateLayer = useCallback((id, changes) => {
    updateLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));
  }, [updateLayers]);

  const removeLayer = useCallback((id) => {
    updateLayers(prev => prev.filter(l => l.id !== id));
    setSelectedId(null);
  }, [updateLayers]);

  const cloneSelected = useCallback(() => {
    if (!selectedId) return;
    setLayers(prev => {
      const src = prev.find(l => l.id === selectedId);
      if (!src) return prev;
      const clone = { ...cloneLayer(src), x: src.x + 20, y: src.y + 20, zIndex: prev.length };
      setSelectedId(clone.id);
      setIsDirty(true);
      return [...prev, clone];
    });
  }, [selectedId]);

  // ─── Layering ───────────────────────────────────────────────────

  const bringForward = useCallback((id) => {
    updateLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  const sendBackward = useCallback((id) => {
    updateLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next.map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  const bringToFront = useCallback((id) => {
    updateLayers(prev => {
      const layer = prev.find(l => l.id === id);
      if (!layer) return prev;
      const rest = prev.filter(l => l.id !== id);
      return [...rest, layer].map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  const sendToBack = useCallback((id) => {
    updateLayers(prev => {
      const layer = prev.find(l => l.id === id);
      if (!layer) return prev;
      const rest = prev.filter(l => l.id !== id);
      return [layer, ...rest].map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  // ─── Canvas settings ────────────────────────────────────────────

  const updateCanvas = useCallback((changes) => {
    setCanvas(prev => ({ ...prev, ...changes }));
    setIsDirty(true);
  }, []);

  // ─── Save ───────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!designId || !isDirty) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/designs/${designId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas, layers }),
      });
      if (!res.ok) throw new Error('Save failed');
      setIsDirty(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [designId, isDirty, canvas, layers]);

  // Auto-save every 5 seconds when dirty
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(save, AUTOSAVE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isDirty, save]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      const STEP = e.shiftKey ? 10 : 1;
      if (!selectedId) return;
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); updateLayer(selectedId, { y: (layers.find(l => l.id === selectedId)?.y || 0) - STEP }); break;
        case 'ArrowDown':  e.preventDefault(); updateLayer(selectedId, { y: (layers.find(l => l.id === selectedId)?.y || 0) + STEP }); break;
        case 'ArrowLeft':  e.preventDefault(); updateLayer(selectedId, { x: (layers.find(l => l.id === selectedId)?.x || 0) - STEP }); break;
        case 'ArrowRight': e.preventDefault(); updateLayer(selectedId, { x: (layers.find(l => l.id === selectedId)?.x || 0) + STEP }); break;
        case 'Delete':
        case 'Backspace':  removeLayer(selectedId); break;
        case 'd':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); cloneSelected(); } break;
        case 'Escape':     setSelectedId(null); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, layers, updateLayer, removeLayer, cloneSelected]);

  const selectedLayer = layers.find(l => l.id === selectedId) || null;

  return {
    canvas, layers, selectedId, selectedLayer,
    isDirty, isSaving, saveError, previewMode,
    setSelectedId, setPreviewMode,
    addLayer, updateLayer, removeLayer, cloneSelected,
    bringForward, sendBackward, bringToFront, sendToBack,
    updateCanvas, save,
  };
}
