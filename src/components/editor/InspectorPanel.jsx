'use client';

import {
  ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
  Copy, Trash2, RotateCcw
} from 'lucide-react';

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      value={Math.round(value ?? 0)}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30 text-right"
    />
  );
}

function ColorInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
        className="w-8 h-6 p-0 border-0 rounded cursor-pointer" />
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder="#000000"
        className="flex-1 px-2 py-1 text-xs border border-border rounded bg-muted/30 font-mono" />
    </div>
  );
}

export function InspectorPanel({ layer, onUpdate, onRemove, onClone, onBringForward, onSendBackward, onBringToFront, onSendToBack }) {
  if (!layer) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <div className="text-muted-foreground text-sm">
          <p className="font-medium mb-1">No layer selected</p>
          <p className="text-xs">Click a layer on the canvas or add one from the left panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-sm p-3 space-y-4">
      {/* Layer actions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Layer</p>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => onBringToFront(layer.id)} title="Bring to front"
            className="p-1.5 rounded border border-border hover:bg-muted/50"><ChevronsUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onBringForward(layer.id)} title="Bring forward"
            className="p-1.5 rounded border border-border hover:bg-muted/50"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onSendBackward(layer.id)} title="Send backward"
            className="p-1.5 rounded border border-border hover:bg-muted/50"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button onClick={() => onSendToBack(layer.id)} title="Send to back"
            className="p-1.5 rounded border border-border hover:bg-muted/50"><ChevronsDown className="w-3.5 h-3.5" /></button>
          <button onClick={onClone} title="Duplicate (Ctrl+D)"
            className="p-1.5 rounded border border-border hover:bg-muted/50"><Copy className="w-3.5 h-3.5" /></button>
          <button onClick={() => onRemove(layer.id)} title="Delete"
            className="p-1.5 rounded border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Position & Size */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Position & Size</p>
        <div className="grid grid-cols-2 gap-x-2">
          <Row label="X">
            <NumInput value={layer.x} onChange={v => onUpdate({ x: v })} />
          </Row>
          <Row label="Y">
            <NumInput value={layer.y} onChange={v => onUpdate({ y: v })} />
          </Row>
          <Row label="W">
            <NumInput value={layer.width} onChange={v => onUpdate({ width: Math.max(10, v) })} min={10} />
          </Row>
          <Row label="H">
            <NumInput value={layer.height} onChange={v => onUpdate({ height: Math.max(10, v) })} min={10} />
          </Row>
        </div>
      </div>

      {/* Transform */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Transform</p>
        <Row label="Rotate">
          <NumInput value={layer.rotation || 0} onChange={v => onUpdate({ rotation: v })} min={-360} max={360} />
        </Row>
        <Row label="Opacity">
          <input type="range" min={0} max={1} step={0.01}
            value={layer.opacity ?? 1}
            onChange={e => onUpdate({ opacity: parseFloat(e.target.value) })}
            className="w-full" />
        </Row>
        {layer.borderRadius !== undefined && (
          <Row label="Radius">
            <NumInput value={layer.borderRadius || 0} onChange={v => onUpdate({ borderRadius: v })} min={0} max={500} />
          </Row>
        )}
      </div>

      {/* Blend Mode */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Blend Mode</p>
        <select
          value={layer.blendMode || 'normal'}
          onChange={e => onUpdate({ blendMode: e.target.value })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30"
        >
          {['normal','multiply','overlay','screen','darken','lighten','color-dodge','color-burn','hard-light','soft-light'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Type-specific controls */}
      {(layer.type === 'shape' || layer.type === 'text') && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Color</p>
          <Row label={layer.type === 'text' ? 'Text' : 'Fill'}>
            <ColorInput value={layer.color} onChange={v => onUpdate({ color: v })} />
          </Row>
          {layer.type === 'shape' && (
            <>
              <Row label="Glass">
                <input type="checkbox" checked={!!layer.glass} onChange={e => onUpdate({ glass: e.target.checked })} />
              </Row>
              <div className="mt-1">
                <p className="text-xs text-muted-foreground mb-1">Gradient (optional)</p>
                <div className="flex gap-1.5">
                  <input type="color" value={layer.gradient?.from || '#3b82f6'}
                    onChange={e => onUpdate({ gradient: { ...(layer.gradient || {}), from: e.target.value, to: layer.gradient?.to || '#8b5cf6', angle: layer.gradient?.angle || 135 } })}
                    className="w-8 h-6 p-0 border-0 rounded cursor-pointer" title="From" />
                  <input type="color" value={layer.gradient?.to || '#8b5cf6'}
                    onChange={e => onUpdate({ gradient: { ...(layer.gradient || {}), to: e.target.value, from: layer.gradient?.from || '#3b82f6', angle: layer.gradient?.angle || 135 } })}
                    className="w-8 h-6 p-0 border-0 rounded cursor-pointer" title="To" />
                  <button onClick={() => onUpdate({ gradient: null })}
                    className="text-xs text-muted-foreground hover:text-foreground px-1">✕ clear</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {layer.type === 'text' && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Typography</p>
          <Row label="Size">
            <NumInput value={layer.fontSize || 24} onChange={v => onUpdate({ fontSize: v })} min={6} max={300} />
          </Row>
          <Row label="Weight">
            <select value={layer.fontWeight || 'normal'} onChange={e => onUpdate({ fontWeight: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30">
              {['100','200','300','normal','500','600','bold','800','900'].map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </Row>
          <Row label="Align">
            <select value={layer.align || 'left'} onChange={e => onUpdate({ align: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30">
              {['left','center','right'].map(a => <option key={a}>{a}</option>)}
            </select>
          </Row>
          <Row label="Spacing">
            <NumInput value={layer.letterSpacing || 0} onChange={v => onUpdate({ letterSpacing: v })} min={-10} max={50} step={0.5} />
          </Row>
          <Row label="Line H">
            <NumInput value={layer.lineHeight || 1.4} onChange={v => onUpdate({ lineHeight: v })} min={0.5} max={5} step={0.1} />
          </Row>
        </div>
      )}

      {layer.type === 'image' && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Image</p>
          <Row label="Fit">
            <select value={layer.objectFit || 'cover'} onChange={e => onUpdate({ objectFit: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30">
              {['cover','contain','fill','none'].map(f => <option key={f}>{f}</option>)}
            </select>
          </Row>
          <Row label="Src">
            <input type="text" value={layer.src || ''} onChange={e => onUpdate({ src: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30 font-mono truncate" />
          </Row>
          <Row label="Filter">
            <select value={layer.filter || 'none'}
              onChange={e => onUpdate({ filter: e.target.value === 'none' ? undefined : e.target.value })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30">
              {['none','grayscale(1)','blur(2px)','brightness(1.3)','contrast(1.4)','sepia(0.8)'].map(f => (
                <option key={f} value={f}>{f === 'none' ? 'None' : f}</option>
              ))}
            </select>
          </Row>
        </div>
      )}

      {layer.type === 'qr' && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">QR Code</p>
          <Row label="URL">
            <input type="text" value={layer.qrValue || ''} onChange={e => onUpdate({ qrValue: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-muted/30" />
          </Row>
          <Row label="Color">
            <ColorInput value={layer.color || '#000000'} onChange={v => onUpdate({ color: v })} />
          </Row>
          <Row label="Bg">
            <ColorInput value={layer.background || '#ffffff'} onChange={v => onUpdate({ background: v })} />
          </Row>
        </div>
      )}

      {/* Shadow */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Shadow</p>
        <div className="flex items-center gap-2 mb-1">
          <input type="checkbox" checked={!!layer.shadow}
            onChange={e => onUpdate({ shadow: e.target.checked ? { x: 0, y: 4, blur: 8, color: 'rgba(0,0,0,0.3)' } : null })} />
          <span className="text-xs text-muted-foreground">Enable shadow</span>
        </div>
        {layer.shadow && (
          <div className="grid grid-cols-2 gap-x-2">
            <Row label="X"><NumInput value={layer.shadow.x || 0} onChange={v => onUpdate({ shadow: { ...layer.shadow, x: v } })} /></Row>
            <Row label="Y"><NumInput value={layer.shadow.y || 4} onChange={v => onUpdate({ shadow: { ...layer.shadow, y: v } })} /></Row>
            <Row label="Blur"><NumInput value={layer.shadow.blur || 8} onChange={v => onUpdate({ shadow: { ...layer.shadow, blur: v } })} min={0} /></Row>
          </div>
        )}
      </div>
    </div>
  );
}
