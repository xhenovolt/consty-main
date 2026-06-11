'use client';

import { useTheme, ACCENT_PALETTES, GRADIENT_PRESETS } from '@/components/providers/ThemeProvider';
import { Monitor, Sun, Moon, Check } from 'lucide-react';

export default function AppearancePage() {
  const {
    colorMode, setColorMode,
    accent, setAccent,
    customAccent, setCustomAccent,
    gradient, setGradient,
    glassMode, setGlassMode,
    isDark,
  } = useTheme();

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Appearance</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize colors, gradients and visual effects.</p>
      </div>

      {/* ── Color Mode ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Color Mode</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { mode: 'system', icon: Monitor, label: 'System' },
            { mode: 'light',  icon: Sun,     label: 'Light'  },
            { mode: 'dark',   icon: Moon,    label: 'Dark'   },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                colorMode === mode
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-white'
                  : 'border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/[0.15] hover:text-white'
              }`}
            >
              <Icon size={22} />
              <span className="text-sm font-medium">{label}</span>
              {colorMode === mode && <Check size={14} className="text-[var(--theme-primary)]" />}
            </button>
          ))}
        </div>
      </section>

      {/* ── Accent Palette ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {Object.entries(ACCENT_PALETTES).map(([key, pal]) => (
            <button
              key={key}
              onClick={() => setAccent(key)}
              title={pal.name}
              className={`group relative h-10 w-full rounded-xl border-2 transition-all ${
                accent === key && !customAccent
                  ? 'border-white scale-110'
                  : 'border-transparent hover:border-white/40'
              }`}
              style={{ background: `linear-gradient(135deg, ${pal.primary}, ${pal.accent})` }}
            >
              {accent === key && !customAccent && (
                <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>

        {/* Custom color picker */}
        <div className="flex items-center gap-3 mt-2">
          <label className="text-sm text-muted-foreground">Custom primary:</label>
          <input
            type="color"
            defaultValue={customAccent?.primary ?? '#3b82f6'}
            onChange={(e) => setCustomAccent({
              primary: e.target.value,
              accent:  e.target.value,
              sidebar: isDark ? '#0f172a' : '#ffffff',
              navbar:  isDark ? '#0f172a' : '#ffffff',
            })}
            className="h-8 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
          />
          {customAccent && (
            <button
              onClick={() => setCustomAccent(null)}
              className="text-xs text-muted-foreground hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* ── Background Gradient ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Background Gradient</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(GRADIENT_PRESETS).map(([key, grad]) => (
            <button
              key={key}
              onClick={() => setGradient(key)}
              className={`relative h-20 rounded-xl border-2 overflow-hidden transition-all ${
                gradient === key
                  ? 'border-[var(--theme-primary)]'
                  : 'border-transparent hover:border-white/20'
              }`}
              style={{
                background: isDark
                  ? (grad.dark !== 'none' ? grad.dark : '#0a0a0a')
                  : (grad.light !== 'none' ? grad.light : '#f8fafc'),
              }}
            >
              <span className="absolute bottom-2 left-2 text-xs font-medium text-white/80 drop-shadow">
                {grad.name}
              </span>
              {gradient === key && (
                <Check size={16} className="absolute top-2 right-2 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Glassmorphism ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Glassmorphism</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Blur + frosted-glass effect on cards and panels.</p>
          </div>
          <button
            onClick={() => setGlassMode(!glassMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              glassMode ? 'bg-[var(--theme-primary)]' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                glassMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${glassMode
            ? 'glass-card border-white/10'
            : 'border-white/[0.06] bg-white/[0.03]'}`}
        >
          <p className="text-sm text-muted-foreground">
            {glassMode ? '✓ Glass effects are active.' : 'Glass effects are off — solid surfaces.'}
          </p>
        </div>
      </section>
    </div>
  );
}
