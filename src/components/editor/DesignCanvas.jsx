'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

/** Convert CSS transform string for a layer */
function layerStyle(layer, isSelected, previewMode) {
  return {
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    transform: `rotate(${layer.rotation || 0}deg)`,
    opacity: layer.opacity ?? 1,
    zIndex: layer.zIndex ?? 0,
    mixBlendMode: layer.blendMode || 'normal',
    boxShadow: layer.shadow ? `${layer.shadow.x || 0}px ${layer.shadow.y || 4}px ${layer.shadow.blur || 8}px ${layer.shadow.color || 'rgba(0,0,0,0.3)'}` : undefined,
    outline: isSelected && !previewMode ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
    cursor: previewMode ? 'default' : 'move',
    userSelect: 'none',
    overflow: 'hidden',
    borderRadius: layer.borderRadius ? `${layer.borderRadius}px` : undefined,
  };
}

function ShapeLayer({ layer }) {
  if (layer.shape === 'circle') {
    return (
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: layer.gradient
          ? `linear-gradient(${layer.gradient.angle || 135}deg, ${layer.gradient.from}, ${layer.gradient.to})`
          : (layer.color || '#3b82f6'),
        backdropFilter: layer.glass ? 'blur(10px)' : undefined,
      }} />
    );
  }
  return (
    <div style={{
      width: '100%', height: '100%',
      background: layer.gradient
        ? `linear-gradient(${layer.gradient.angle || 135}deg, ${layer.gradient.from}, ${layer.gradient.to})`
        : (layer.color || '#3b82f6'),
      backdropFilter: layer.glass ? 'blur(10px)' : undefined,
      border: layer.border ? `${layer.border.width || 2}px solid ${layer.border.color || '#000'}` : undefined,
    }} />
  );
}

function TextLayer({ layer, isSelected, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (ref.current) onUpdate({ value: ref.current.innerText });
  };

  return (
    <div
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      onBlur={handleBlur}
      style={{
        width: '100%', height: '100%',
        display: 'flex',
        alignItems: layer.verticalAlign === 'bottom' ? 'flex-end' : layer.verticalAlign === 'top' ? 'flex-start' : 'center',
        justifyContent: layer.align === 'right' ? 'flex-end' : layer.align === 'center' ? 'center' : 'flex-start',
        fontSize: layer.fontSize || 24,
        fontWeight: layer.fontWeight || 'normal',
        fontFamily: layer.fontFamily || 'inherit',
        color: layer.color || '#000000',
        textAlign: layer.align || 'left',
        letterSpacing: layer.letterSpacing ? `${layer.letterSpacing}px` : undefined,
        lineHeight: layer.lineHeight || 1.4,
        outline: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        padding: '4px',
        textShadow: layer.textShadow || undefined,
        background: layer.background || 'transparent',
      }}
    >
      {layer.value || 'Double-click to edit'}
    </div>
  );
}

function ImageLayer({ layer }) {
  return (
    <img
      src={layer.src}
      alt={layer.alt || ''}
      draggable={false}
      style={{
        width: '100%', height: '100%',
        objectFit: layer.objectFit || 'cover',
        filter: layer.filter || undefined,
      }}
    />
  );
}

function QRLayer({ layer }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: layer.background || '#fff', padding: 8 }}>
      <QRCodeSVG
        value={layer.qrValue || 'https://consty.example.com'}
        size={Math.min(layer.width, layer.height) - 16}
        fgColor={layer.color || '#000000'}
        bgColor={layer.background || '#ffffff'}
        level="Q"
      />
    </div>
  );
}

function LayerContent({ layer, isSelected, onUpdate }) {
  switch (layer.type) {
    case 'shape':  return <ShapeLayer layer={layer} />;
    case 'text':   return <TextLayer layer={layer} isSelected={isSelected} onUpdate={onUpdate} />;
    case 'image':  return <ImageLayer layer={layer} />;
    case 'qr':     return <QRLayer layer={layer} />;
    default:       return null;
  }
}

function DraggableLayer({ layer, isSelected, onSelect, onUpdate, canvasRef, previewMode }) {
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ resizing: false, startX: 0, startY: 0, origW: 0, origH: 0 });

  const getScale = useCallback(() => {
    if (!canvasRef.current) return 1;
    const { width } = canvasRef.current.getBoundingClientRect();
    return width / (canvasRef.current.dataset.naturalWidth || width);
  }, [canvasRef]);

  const handleMouseDown = useCallback((e) => {
    if (previewMode) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(layer.id);

    const scale = getScale();
    dragRef.current = {
      dragging: true,
      startX: e.clientX, startY: e.clientY,
      origX: layer.x, origY: layer.y,
    };

    const onMove = (ev) => {
      if (!dragRef.current.dragging) return;
      const dx = (ev.clientX - dragRef.current.startX) / scale;
      const dy = (ev.clientY - dragRef.current.startY) / scale;
      onUpdate({ x: Math.round(dragRef.current.origX + dx), y: Math.round(dragRef.current.origY + dy) });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [layer.id, layer.x, layer.y, onSelect, onUpdate, previewMode, getScale]);

  const handleResizeMouseDown = useCallback((e) => {
    if (previewMode) return;
    e.preventDefault();
    e.stopPropagation();
    const scale = getScale();
    resizeRef.current = {
      resizing: true,
      startX: e.clientX, startY: e.clientY,
      origW: layer.width, origH: layer.height,
    };
    const onMove = (ev) => {
      if (!resizeRef.current.resizing) return;
      const dw = (ev.clientX - resizeRef.current.startX) / scale;
      const dh = (ev.clientY - resizeRef.current.startY) / scale;
      onUpdate({
        width:  Math.max(20, Math.round(resizeRef.current.origW + dw)),
        height: Math.max(20, Math.round(resizeRef.current.origH + dh)),
      });
    };
    const onUp = () => {
      resizeRef.current.resizing = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [layer.width, layer.height, onUpdate, previewMode, getScale]);

  return (
    <div
      style={layerStyle(layer, isSelected, previewMode)}
      onMouseDown={handleMouseDown}
    >
      <LayerContent layer={layer} isSelected={isSelected} onUpdate={onUpdate} />

      {/* Resize handle */}
      {isSelected && !previewMode && (
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute', right: -5, bottom: -5,
            width: 12, height: 12,
            background: '#3b82f6', borderRadius: 2,
            cursor: 'se-resize', zIndex: 9999,
          }}
        />
      )}
    </div>
  );
}

export function DesignCanvas({ canvas, layers, selectedId, onSelect, onUpdateLayer, previewMode, canvasRef }) {
  const scaledRef = useRef(null);

  // Compute display scale so canvas fits within the viewport
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = scaledRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const aw = el.clientWidth - 48;
      const ah = el.clientHeight - 48;
      const s = Math.min(aw / canvas.width, ah / canvas.height, 1);
      setScale(s);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [canvas.width, canvas.height]);

  const sortedLayers = [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  const canvasBackground = canvas.gradient
    ? `linear-gradient(${canvas.gradient.angle || 135}deg, ${canvas.gradient.from}, ${canvas.gradient.to})`
    : (canvas.background || '#ffffff');

  return (
    <div
      ref={scaledRef}
      id="design-canvas"
      data-natural-width={canvas.width}
      style={{
        position: 'relative',
        width: canvas.width,
        height: canvas.height,
        background: canvasBackground,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        flexShrink: 0,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}
      onClick={() => onSelect(null)}
    >
      {/* Pass ref for scale calculations */}
      <div ref={canvasRef} data-natural-width={canvas.width} style={{ display: 'none' }} />

      {sortedLayers.map(layer => (
        <DraggableLayer
          key={layer.id}
          layer={layer}
          isSelected={selectedId === layer.id}
          onSelect={onSelect}
          onUpdate={(changes) => onUpdateLayer(layer.id, changes)}
          canvasRef={scaledRef}
          previewMode={previewMode}
        />
      ))}
    </div>
  );
}
