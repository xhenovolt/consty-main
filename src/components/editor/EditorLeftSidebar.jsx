'use client';

import { useState } from 'react';
import {
  Type, Square, Circle, Image, QrCode, Upload,
  Layout, AlignLeft, ChevronDown, ChevronRight
} from 'lucide-react';

const SHAPES = [
  { label: 'Rectangle', shape: 'rect', color: '#3b82f6', width: 200, height: 120 },
  { label: 'Circle',    shape: 'circle', color: '#8b5cf6', width: 150, height: 150 },
  { label: 'Rounded',   shape: 'rect', color: '#10b981', width: 200, height: 120, borderRadius: 16 },
  { label: 'Glass',     shape: 'rect', color: 'rgba(255,255,255,0.2)', glass: true, width: 220, height: 130 },
];

const TEXT_PRESETS = [
  { label: 'Heading',    fontSize: 48, fontWeight: 'bold',   color: '#111827', value: 'Heading', width: 400, height: 70 },
  { label: 'Subheading', fontSize: 28, fontWeight: '600',    color: '#374151', value: 'Subheading', width: 350, height: 50 },
  { label: 'Body Text',  fontSize: 16, fontWeight: 'normal', color: '#6b7280', value: 'Body text goes here', width: 300, height: 60 },
];

const CANVAS_PRESETS = [
  { label: 'Square 1080',  width: 1080, height: 1080 },
  { label: 'Story 1080×1920', width: 1080, height: 1920 },
  { label: 'A4 Portrait',  width: 794,  height: 1123 },
  { label: 'Banner Wide',  width: 1920, height: 600  },
  { label: 'LinkedIn',     width: 1200, height: 627  },
];

function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted/50"
      >
        {title}
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

export function EditorLeftSidebar({ onAddLayer, onUpdateCanvas, canvas, templates = [], onLoadTemplate }) {
  const [imgUrl, setImgUrl] = useState('');

  const addShape = (preset) => onAddLayer({
    type: 'shape',
    shape: preset.shape,
    color: preset.color,
    glass: preset.glass || false,
    borderRadius: preset.borderRadius || 0,
    width: preset.width,
    height: preset.height,
  });

  const addText = (preset) => onAddLayer({
    type: 'text',
    value: preset.value,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    color: preset.color,
    width: preset.width,
    height: preset.height,
  });

  const addImage = () => {
    if (!imgUrl.trim()) return;
    onAddLayer({ type: 'image', src: imgUrl.trim(), width: 300, height: 200 });
    setImgUrl('');
  };

  const addQR = () => onAddLayer({ type: 'qr', qrValue: 'https://consty.example.com', width: 180, height: 180 });

  return (
    <div className="h-full overflow-y-auto text-sm bg-background">
      {/* Canvas size */}
      <Section title="Canvas">
        <div className="space-y-1 mt-1">
          {CANVAS_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => onUpdateCanvas({ width: p.width, height: p.height })}
              className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-primary/10 ${canvas.width === p.width && canvas.height === p.height ? 'bg-primary/15 text-primary font-medium' : ''}`}
            >
              {p.label}
              <span className="ml-1 text-muted-foreground">{p.width}×{p.height}</span>
            </button>
          ))}
          <div className="flex gap-1 mt-1">
            <input type="number" placeholder="W" value={canvas.width}
              onChange={e => onUpdateCanvas({ width: parseInt(e.target.value) || canvas.width })}
              className="w-1/2 px-2 py-1 text-xs border border-border rounded bg-muted/30" />
            <input type="number" placeholder="H" value={canvas.height}
              onChange={e => onUpdateCanvas({ height: parseInt(e.target.value) || canvas.height })}
              className="w-1/2 px-2 py-1 text-xs border border-border rounded bg-muted/30" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <label className="text-xs text-muted-foreground">Background</label>
            <input type="color" value={canvas.background || '#ffffff'}
              onChange={e => onUpdateCanvas({ background: e.target.value })}
              className="w-8 h-6 p-0 border-0 rounded cursor-pointer" />
          </div>
        </div>
      </Section>

      {/* Templates */}
      {templates.length > 0 && (
        <Section title="Templates">
          <div className="space-y-1 mt-1">
            {templates.map(t => (
              <button key={t.id} onClick={() => onLoadTemplate(t)}
                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-primary/10 truncate">
                {t.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Text */}
      <Section title="Text">
        <div className="space-y-1 mt-1">
          {TEXT_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => addText(p)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50"
            >
              <Type className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span style={{ fontSize: Math.min(p.fontSize * 0.4, 14) + 'px', fontWeight: p.fontWeight }}>{p.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Shapes */}
      <Section title="Shapes">
        <div className="grid grid-cols-2 gap-1 mt-1">
          {SHAPES.map(s => (
            <button
              key={s.label}
              onClick={() => addShape(s)}
              className="flex flex-col items-center justify-center py-2 px-1 rounded hover:bg-muted/50 gap-1"
            >
              <div style={{
                width: 32, height: s.shape === 'circle' ? 32 : 20,
                borderRadius: s.shape === 'circle' ? '50%' : (s.borderRadius || 2),
                background: s.glass ? 'rgba(150,150,255,0.3)' : s.color,
                border: s.glass ? '1px solid rgba(255,255,255,0.5)' : undefined,
              }} />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Images */}
      <Section title="Images">
        <div className="mt-1 space-y-1">
          <input
            type="text"
            placeholder="Paste image URL..."
            value={imgUrl}
            onChange={e => setImgUrl(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-border rounded bg-muted/30"
            onKeyDown={e => e.key === 'Enter' && addImage()}
          />
          <button onClick={addImage}
            className="w-full py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90">
            + Add Image
          </button>
        </div>
      </Section>

      {/* QR Code */}
      <Section title="QR Code">
        <button onClick={addQR}
          className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-muted/50 mt-1">
          <QrCode className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs">Add QR Code</span>
        </button>
      </Section>
    </div>
  );
}
