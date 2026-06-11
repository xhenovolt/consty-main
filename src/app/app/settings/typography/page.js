'use client';

import { useTheme, FONT_FAMILIES, FONT_SIZES } from '@/components/providers/ThemeProvider';

const FONT_WEIGHTS = [
  { value: '300', label: 'Light (300)'   },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)'  },
  { value: '600', label: 'Semibold (600)'},
  { value: '700', label: 'Bold (700)'    },
];

const LINE_HEIGHTS = [
  { value: '1.2',  label: 'Tight (1.2)'    },
  { value: '1.4',  label: 'Snug (1.4)'     },
  { value: '1.6',  label: 'Normal (1.6)'   },
  { value: '1.8',  label: 'Relaxed (1.8)'  },
  { value: '2.0',  label: 'Loose (2.0)'    },
];

export default function TypographyPage() {
  const {
    fontFamily, setFontFamily,
    fontSize,   setFontSize,
    fontWeight, setFontWeight,
    lineHeight, setLineHeight,
  } = useTheme();

  const currentFont = FONT_FAMILIES[fontFamily] || FONT_FAMILIES.geist;
  const currentSize = FONT_SIZES[fontSize] || FONT_SIZES['12pt'];

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Typography</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose your preferred reading font, size, weight and spacing.</p>
      </div>

      {/* ── Font Family ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Font Family</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {Object.entries(FONT_FAMILIES).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setFontFamily(key)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-all ${
                fontFamily === key
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.15] hover:text-white'
              }`}
              style={{ fontFamily: def.css }}
            >
              <span className="text-sm">{def.name}</span>
              {fontFamily === key && <span className="text-xs text-[var(--theme-primary)]">Active</span>}
            </button>
          ))}
        </div>
      </section>

      {/* ── Font Size ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Font Size</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FONT_SIZES).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setFontSize(key)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                fontSize === key
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.15] hover:text-white'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </section>

      {/* ── Font Weight ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Font Weight</h2>
        <div className="flex flex-wrap gap-2">
          {FONT_WEIGHTS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFontWeight(value)}
              className={`px-4 py-2 rounded-xl border transition-all ${
                fontWeight === value
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.15] hover:text-white'
              }`}
              style={{ fontWeight: value }}
            >
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Line Height ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Line Height</h2>
        <div className="flex flex-wrap gap-2">
          {LINE_HEIGHTS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLineHeight(value)}
              className={`px-4 py-2 rounded-xl border transition-all ${
                lineHeight === value
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.15] hover:text-white'
              }`}
            >
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Live Preview ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</h2>
        <div className="p-6 rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <p
            className="text-gray-200"
            style={{
              fontFamily:  currentFont.css,
              fontSize:    currentSize.rem,
              fontWeight,
              lineHeight,
            }}
          >
            The quick brown fox jumps over the lazy dog.
            Consty helps project teams move fast without losing control.
            Every update counts, every number matters.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {currentFont.name} · {fontSize} · Weight {fontWeight} · Leading {lineHeight}
          </p>
        </div>
      </section>
    </div>
  );
}
