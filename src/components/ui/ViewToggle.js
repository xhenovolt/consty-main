'use client';

/**
 * ViewToggle — Switch between list and grid display modes.
 * Persists preference to localStorage per module.
 */

import { useEffect, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';

export function ViewToggle({ storageKey = 'view-mode', defaultMode = 'list', onChange }) {
  const [mode, setMode] = useState(defaultMode);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'grid' || saved === 'list') {
      setMode(saved);
      onChange?.(saved);
    }
  }, [storageKey]);

  const toggle = (m) => {
    setMode(m);
    localStorage.setItem(storageKey, m);
    onChange?.(m);
  };

  return (
    <div className="flex items-center rounded-lg overflow-hidden border border-border">
      <button onClick={() => toggle('list')} title="List view"
        className={`p-2 transition ${mode === 'list' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
        <List className="w-4 h-4" />
      </button>
      <button onClick={() => toggle('grid')} title="Grid view"
        className={`p-2 transition ${mode === 'grid' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}
