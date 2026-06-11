'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Check, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, CURRENCY_CONFIG } from '@/lib/format-currency';

const CURRENCIES = [
  { code: 'UGX', label: 'Ugandan Shilling', symbol: 'USh', example: 1250000 },
  { code: 'USD', label: 'US Dollar', symbol: '$', example: 1250 },
  { code: 'EUR', label: 'Euro', symbol: '€', example: 1150 },
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh', example: 162500 },
  { code: 'TZS', label: 'Tanzanian Shilling', symbol: 'TSh', example: 3125000 },
];

const DECIMAL_MODES = [
  { id: 'auto', label: 'Auto', description: 'Use currency defaults (UGX = 0, USD = 2)' },
  { id: '0', label: 'No decimals', description: 'Always show whole numbers (e.g. UGX 1,250,000)' },
  { id: '2', label: '2 decimals', description: 'Always show 2 decimal places (e.g. USD 1,250.00)' },
];

const STORAGE_KEY = 'consty-finance-prefs';

function loadPrefs() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function savePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  // Broadcast change so other components can react
  window.dispatchEvent(new CustomEvent('consty-finance-prefs-changed', { detail: prefs }));
}

export default function FinancialSettingsPage() {
  const [prefs, setPrefs] = useState({
    displayCurrency: 'UGX',
    decimalMode: 'auto',
  });
  const [saved, setSaved] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = loadPrefs();
    if (stored) setPrefs(stored);
  }, []);

  const updatePref = (key, value) => {
    setPrefs(p => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    savePrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    const defaults = { displayCurrency: 'UGX', decimalMode: 'auto' };
    setPrefs(defaults);
    savePrefs(defaults);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Preview formatting
  const previewAmount = CURRENCIES.find(c => c.code === prefs.displayCurrency)?.example ?? 1250000;
  const previewFormatted = formatCurrency(previewAmount, prefs.displayCurrency);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/app/settings" className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure currency display and formatting preferences</p>
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Preview</p>
        <p className="text-3xl font-bold text-foreground">{previewFormatted}</p>
        <p className="text-xs text-muted-foreground mt-1">Example amount displayed in {prefs.displayCurrency}</p>
      </div>

      {/* Display Currency */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Display Currency</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose your preferred currency for display. This affects how amounts are shown across the app.
          Individual records retain their stored currency.
        </p>
        <div className="space-y-2">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => updatePref('displayCurrency', c.code)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition ${
                prefs.displayCurrency === c.code
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-border bg-background hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center gap-3 text-left">
                <span className="text-lg font-bold text-muted-foreground w-8">{c.symbol}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{c.code}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{formatCurrency(c.example, c.code)}</span>
                {prefs.displayCurrency === c.code && <Check className="w-4 h-4 text-blue-600" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Decimal Mode */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Decimal Display</h2>
        <p className="text-sm text-muted-foreground">
          Control how many decimal places are shown for amounts.
        </p>
        <div className="space-y-2">
          {DECIMAL_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => updatePref('decimalMode', mode.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition text-left ${
                prefs.decimalMode === mode.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-border bg-background hover:border-muted-foreground/30'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{mode.label}</p>
                <p className="text-xs text-muted-foreground">{mode.description}</p>
              </div>
              {prefs.decimalMode === mode.id && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-muted/50 border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-xs uppercase tracking-wider">Note</p>
        <p>Preferences are saved to your browser. New prospects and transactions default to <strong className="text-foreground">UGX</strong>.</p>
        <p>Each record stores its own currency — changing display currency here affects formatting only, not stored values.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Preferences'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition border border-border"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset to defaults
        </button>
      </div>
    </div>
  );
}
