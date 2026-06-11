'use client';

import { useState, useRef, useCallback } from 'react';
import { Download, X } from 'lucide-react';

export function ExportModal({ onClose, canvasId, designName }) {
  const [format, setFormat] = useState('png');
  const [filename, setFilename] = useState(designName || 'design');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = useCallback(async () => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { setError('Canvas element not found'); return; }

    setExporting(true);
    setError(null);

    try {
      if (format === 'png') {
        const html2canvas = (await import('html2canvas')).default;
        const rendered = await html2canvas(canvas, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          scale: 2,
        });
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = rendered.toDataURL('image/png');
        link.click();
      } else if (format === 'svg') {
        // SVG export: serialize the canvas innerHTML as SVG with foreignObject
        const { width, height } = canvas.getBoundingClientRect();
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('width', canvas.offsetWidth);
        svg.setAttribute('height', canvas.offsetHeight);
        svg.setAttribute('viewBox', `0 0 ${canvas.offsetWidth} ${canvas.offsetHeight}`);

        const fo = document.createElementNS(svgNS, 'foreignObject');
        fo.setAttribute('width', '100%');
        fo.setAttribute('height', '100%');
        const div = document.createElement('div');
        div.innerHTML = canvas.outerHTML;
        fo.appendChild(div);
        svg.appendChild(fo);

        const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${filename}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[Export] error:', err);
      setError('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }, [format, filename, canvasId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-xl border border-border shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Export Design</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted/50 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Filename</label>
            <input type="text" value={filename} onChange={e => setFilename(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/30" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {['png', 'svg'].map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`py-2 rounded-lg border text-sm font-medium transition ${format === f ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {exporting ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
