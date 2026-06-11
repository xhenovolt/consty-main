'use client';

/**
 * Consty Theme Engine
 * Handles: color mode (system/light/dark), accent palette,
 *          background gradients, glassmorphism, typography
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Accent Palettes ──────────────────────────────────────────────────────────
export const ACCENT_PALETTES = {
  blue:    { name: 'Blue',    primary: '#3b82f6', accent: '#6366f1', sidebar: '#0f172a', navbar: '#0f172a' },
  purple:  { name: 'Purple',  primary: '#8b5cf6', accent: '#a78bfa', sidebar: '#0c0a1d', navbar: '#0c0a1d' },
  emerald: { name: 'Emerald', primary: '#10b981', accent: '#34d399', sidebar: '#022c22', navbar: '#022c22' },
  red:     { name: 'Red',     primary: '#ef4444', accent: '#f97316', sidebar: '#1c0a0a', navbar: '#1c0a0a' },
  orange:  { name: 'Orange',  primary: '#f97316', accent: '#fb923c', sidebar: '#1c0e00', navbar: '#1c0e00' },
  teal:    { name: 'Teal',    primary: '#14b8a6', accent: '#2dd4bf', sidebar: '#00201e', navbar: '#00201e' },
  pink:    { name: 'Pink',    primary: '#ec4899', accent: '#f472b6', sidebar: '#1a0010', navbar: '#1a0010' },
  gray:    { name: 'Gray',    primary: '#6b7280', accent: '#9ca3af', sidebar: '#111827', navbar: '#111827' },
};

// ─── Background Gradient Presets ─────────────────────────────────────────────
export const GRADIENT_PRESETS = {
  none:          { name: 'Solid',         light: 'none',                                               dark: 'none' },
  'blue-purple': { name: 'Blue → Purple', light: 'linear-gradient(135deg,#eff6ff 0%,#f5f3ff 100%)',    dark: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)' },
  'green-teal':  { name: 'Green → Teal',  light: 'linear-gradient(135deg,#f0fdf4 0%,#f0fdfa 100%)',    dark: 'linear-gradient(135deg,#022c22 0%,#00201e 100%)' },
  'red-orange':  { name: 'Red → Orange',  light: 'linear-gradient(135deg,#fef2f2 0%,#fff7ed 100%)',    dark: 'linear-gradient(135deg,#1c0a0a 0%,#1c0e00 100%)' },
  neutral:       { name: 'Neutral',       light: 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)',    dark: 'linear-gradient(135deg,#0a0a0a 0%,#111827 100%)' },
};

// ─── Font Families ────────────────────────────────────────────────────────────
export const FONT_FAMILIES = {
  'geist':           { name: 'Geist (Default)',     css: 'var(--font-geist-sans), system-ui, sans-serif' },
  'system-ui':       { name: 'System UI',           css: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  'inter':           { name: 'Inter',               css: "'Inter', system-ui, sans-serif",               google: 'Inter:wght@300;400;500;600;700' },
  'segoe-ui':        { name: 'Segoe UI',            css: "'Segoe UI', Tahoma, Geneva, sans-serif" },
  'arial':           { name: 'Arial',               css: 'Arial, Helvetica, sans-serif' },
  'verdana':         { name: 'Verdana',             css: 'Verdana, Geneva, Tahoma, sans-serif' },
  'tahoma':          { name: 'Tahoma',              css: 'Tahoma, Verdana, sans-serif' },
  'trebuchet-ms':    { name: 'Trebuchet MS',        css: "'Trebuchet MS', Helvetica, sans-serif" },
  'georgia':         { name: 'Georgia',             css: "Georgia, 'Times New Roman', serif" },
  'garamond':        { name: 'Garamond',            css: "'EB Garamond', Garamond, serif",               google: 'EB+Garamond:wght@400;500;600;700' },
  'times-new-roman': { name: 'Times New Roman',     css: "'Times New Roman', Times, serif" },
  'cambria':         { name: 'Cambria',             css: "Cambria, Georgia, serif" },
  'roboto':          { name: 'Roboto',              css: "'Roboto', Arial, sans-serif",                  google: 'Roboto:wght@300;400;500;700' },
  'open-sans':       { name: 'Open Sans',           css: "'Open Sans', Arial, sans-serif",               google: 'Open+Sans:wght@300;400;500;600;700' },
  'lato':            { name: 'Lato',                css: "'Lato', Arial, sans-serif",                    google: 'Lato:wght@300;400;700' },
  'source-serif':    { name: 'Source Serif 4',      css: "'Source Serif 4', Georgia, serif",             google: 'Source+Serif+4:wght@400;600;700' },
  'playfair':        { name: 'Playfair Display',    css: "'Playfair Display', Georgia, serif",           google: 'Playfair+Display:wght@400;500;600;700' },
  'fira-code':       { name: 'Fira Code (mono)',    css: "'Fira Code', 'Courier New', monospace",        google: 'Fira+Code:wght@300;400;500;700' },
};

// ─── Font Sizes (pt → rem, base 12pt = 1rem) ─────────────────────────────────
export const FONT_SIZES = {
  '8pt':  { pt: 8,  rem: '0.667rem' },
  '9pt':  { pt: 9,  rem: '0.75rem'  },
  '10pt': { pt: 10, rem: '0.833rem' },
  '11pt': { pt: 11, rem: '0.917rem' },
  '12pt': { pt: 12, rem: '1rem'     },
  '14pt': { pt: 14, rem: '1.167rem' },
  '16pt': { pt: 16, rem: '1.333rem' },
  '18pt': { pt: 18, rem: '1.5rem'   },
  '20pt': { pt: 20, rem: '1.667rem' },
  '24pt': { pt: 24, rem: '2rem'     },
  '28pt': { pt: 28, rem: '2.333rem' },
  '32pt': { pt: 32, rem: '2.667rem' },
  '36pt': { pt: 36, rem: '3rem'     },
  '48pt': { pt: 48, rem: '4rem'     },
  '60pt': { pt: 60, rem: '5rem'     },
  '72pt': { pt: 72, rem: '6rem'     },
};

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULTS = {
  colorMode:    'system',
  accent:       'blue',
  customAccent: null,
  gradient:     'none',
  glassMode:    false,
  fontFamily:   'geist',
  fontSize:     '12pt',
  fontWeight:   '400',
  lineHeight:   '1.6',
};

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadPrefs() {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem('consty-theme-v2');
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

function savePrefs(prefs) {
  try { localStorage.setItem('consty-theme-v2', JSON.stringify(prefs)); } catch {}
}

function getSystemDark() {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

// Load a Google Font link dynamically (safe to call multiple times)
function loadGoogleFont(spec) {
  if (typeof document === 'undefined') return;
  const id = `gf-${spec}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [prefs, setPrefsRaw] = useState(DEFAULTS);
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initial hydration
  useEffect(() => {
    const saved = loadPrefs();
    setPrefsRaw(saved);
    setSystemDark(getSystemDark());
    setMounted(true);
  }, []);

  // Track system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = prefs.colorMode === 'dark'
    || (prefs.colorMode === 'system' && systemDark);

  // Apply all CSS variables & classes to <html>
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;

    // ── 1. Dark mode class ──
    isDark ? html.classList.add('dark') : html.classList.remove('dark');

    // ── 2. Accent colors ──
    const pal = prefs.customAccent || ACCENT_PALETTES[prefs.accent] || ACCENT_PALETTES.blue;
    html.style.setProperty('--theme-primary', pal.primary);
    html.style.setProperty('--theme-accent',  pal.accent);

    // Sidebar & navbar background adapt to color mode
    const sidebarBg = isDark ? pal.sidebar : '#ffffff';
    const navbarBg  = isDark ? pal.navbar  : '#ffffff';
    html.style.setProperty('--theme-sidebar', sidebarBg);
    html.style.setProperty('--theme-navbar',  navbarBg);

    // Semantic sidebar tokens (used by Sidebar.js and Navbar.js)
    html.style.setProperty('--sidebar-text',       isDark ? '#f1f5f9'                   : '#111827');
    html.style.setProperty('--sidebar-muted',      isDark ? '#94a3b8'                   : '#6b7280');
    html.style.setProperty('--sidebar-hover',      isDark ? 'rgba(255,255,255,0.06)'    : 'rgba(0,0,0,0.05)');
    html.style.setProperty('--sidebar-active',     isDark ? 'rgba(255,255,255,0.10)'    : 'rgba(0,0,0,0.08)');
    html.style.setProperty('--sidebar-active-txt', isDark ? '#ffffff'                   : '#111827');
    html.style.setProperty('--sidebar-border',     isDark ? 'rgba(255,255,255,0.06)'    : 'rgba(0,0,0,0.08)');
    html.style.setProperty('--sidebar-icon-act',   isDark ? pal.primary                  : pal.primary);
    html.style.setProperty('--navbar-text',        isDark ? '#ffffff'                   : '#111827');
    html.style.setProperty('--navbar-muted',       isDark ? '#94a3b8'                   : '#6b7280');
    html.style.setProperty('--navbar-border',      isDark ? 'rgba(255,255,255,0.06)'    : 'rgba(0,0,0,0.08)');
    html.style.setProperty('--footer-bg',          isDark ? '#0f172a'                   : '#f8fafc');
    html.style.setProperty('--footer-text',        isDark ? '#94a3b8'                   : '#6b7280');

    // ── 3. Background gradient ──
    const grad = GRADIENT_PRESETS[prefs.gradient] || GRADIENT_PRESETS.none;
    const bg = isDark ? grad.dark : grad.light;
    html.style.setProperty('--theme-bg-gradient', bg !== 'none' ? bg : '');
    document.body.style.backgroundImage = bg !== 'none' ? bg : '';
    if (bg !== 'none') document.body.style.backgroundAttachment = 'fixed';

    // ── 4. Glass morphism ──
    html.style.setProperty('--glass-enabled', prefs.glassMode ? '1' : '0');
    prefs.glassMode ? html.classList.add('glass-mode') : html.classList.remove('glass-mode');

    // ── 5. Typography — font family ──
    const fontDef = FONT_FAMILIES[prefs.fontFamily] || FONT_FAMILIES.geist;
    if (fontDef.google) loadGoogleFont(fontDef.google);
    html.style.setProperty('--font-base', fontDef.css);
    document.body.style.fontFamily = fontDef.css;

    // ── 6. Typography — size ──
    const sizeDef = FONT_SIZES[prefs.fontSize] || FONT_SIZES['12pt'];
    html.style.setProperty('--base-font-size', sizeDef.rem);
    // Set root font-size so `rem` units scale globally
    html.style.fontSize = sizeDef.rem;

    // ── 7. Typography — weight & line-height ──
    html.style.setProperty('--base-font-weight', prefs.fontWeight);
    html.style.setProperty('--base-line-height',  prefs.lineHeight);
    document.body.style.fontWeight  = prefs.fontWeight;
    document.body.style.lineHeight  = prefs.lineHeight;

  }, [prefs, isDark, mounted]);

  const updatePrefs = useCallback((patch) => {
    setPrefsRaw(prev => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const ctx = {
    ...prefs, isDark, systemDark, mounted,
    setColorMode:    (v) => updatePrefs({ colorMode: v }),
    setAccent:       (v) => updatePrefs({ accent: v, customAccent: null }),
    setCustomAccent: (v) => updatePrefs({ customAccent: v }),
    setGradient:     (v) => updatePrefs({ gradient: v }),
    setGlassMode:    (v) => updatePrefs({ glassMode: v }),
    setFontFamily:   (v) => updatePrefs({ fontFamily: v }),
    setFontSize:     (v) => updatePrefs({ fontSize: v }),
    setFontWeight:   (v) => updatePrefs({ fontWeight: v }),
    setLineHeight:   (v) => updatePrefs({ lineHeight: v }),
    resetAll: () => { savePrefs(DEFAULTS); setPrefsRaw(DEFAULTS); },
    ACCENT_PALETTES, GRADIENT_PRESETS, FONT_FAMILIES, FONT_SIZES,
  };

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
