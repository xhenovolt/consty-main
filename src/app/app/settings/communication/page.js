'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, Video, FileText, Shield, Activity, ArrowLeft, Settings2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { PageTransition } from '@/components/ui/PageTransition';
import { apiRequest, confirmAction, alertSuccess, alertError } from '@/lib/api-client';

const SETTING_LABELS = {
  audio_calls_enabled: { label: 'Audio Calls', icon: Phone, desc: 'Allow users to make voice calls' },
  video_calls_enabled: { label: 'Video Calls', icon: Video, desc: 'Allow users to make video calls' },
  file_sharing_enabled: { label: 'File Sharing', icon: FileText, desc: 'Allow users to share files in chat' },
  screen_sharing_enabled: { label: 'Screen Sharing', icon: Settings2, desc: 'Allow screen sharing during calls' },
  recording_enabled: { label: 'Call Recording', icon: Activity, desc: 'Enable call recording capability' },
};

const NUMERIC_SETTINGS = {
  max_file_size_mb: { label: 'Max File Size (MB)', min: 1, max: 100 },
  rate_limit_messages: { label: 'Message Rate Limit (per minute)', min: 1, max: 200 },
  rate_limit_calls: { label: 'Call Rate Limit (per hour)', min: 1, max: 50 },
};

function SettingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-16 bg-muted rounded-xl" />
      ))}
    </div>
  );
}

function ToggleSetting({ settingKey, value, onChange }) {
  const config = SETTING_LABELS[settingKey];
  if (!config) return null;
  const Icon = config.icon;
  const enabled = value?.enabled ?? false;

  return (
    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
          <Icon className={`w-5 h-5 ${enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.desc}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(settingKey, { enabled: !enabled })}
        className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function NumericSetting({ settingKey, value, onChange }) {
  const config = NUMERIC_SETTINGS[settingKey];
  if (!config) return null;
  const val = value?.value ?? 0;

  return (
    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
      <div>
        <p className="text-sm font-medium text-foreground">{config.label}</p>
        <p className="text-xs text-muted-foreground">Min: {config.min}, Max: {config.max}</p>
      </div>
      <input
        type="number"
        min={config.min}
        max={config.max}
        value={val}
        onChange={e => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= config.min && n <= config.max) {
            onChange(settingKey, { value: n });
          }
        }}
        className="w-24 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm text-right"
      />
    </div>
  );
}

function AllowedFileTypes({ value, onChange }) {
  const types = value?.types ?? [];
  const [input, setInput] = useState('');

  const addType = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !types.includes(trimmed)) {
      onChange('allowed_file_types', { types: [...types, trimmed] });
      setInput('');
    }
  };

  const removeType = (t) => {
    onChange('allowed_file_types', { types: types.filter(x => x !== t) });
  };

  return (
    <div className="p-4 bg-card border border-border rounded-xl space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Allowed File Types</p>
        <p className="text-xs text-muted-foreground">File extensions users can share (e.g., pdf, jpg, png)</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {types.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-xs rounded-full text-foreground">
            .{t}
            <button onClick={() => removeType(t)} className="text-muted-foreground hover:text-destructive ml-1">&times;</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
          placeholder="e.g. pdf"
          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addType(); } }}
        />
        <LoadingButton size="sm" onClick={addType}>Add</LoadingButton>
      </div>
    </div>
  );
}

export default function CommunicationSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiRequest('/api/communication/admin/settings', { showToast: false });
      if (res.success) {
        setSettings(res.data);
      }
    } catch {
      // error already shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: { ...prev?.[key], ...value } }));
    setDirty(true);
  };

  const handleSave = async () => {
    const confirmed = await confirmAction(
      'Apply Changes?',
      'These settings affect all users immediately.',
      'Apply',
      'warning'
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const payload = {};
      for (const [key, val] of Object.entries(settings)) {
        const { id, updated_at, ...cleanVal } = val;
        payload[key] = cleanVal;
      }

      const res = await apiRequest('/api/communication/admin/settings', {
        method: 'PATCH',
        body: { settings: payload },
        successMessage: 'Communication settings updated!',
      });

      if (res.success) {
        setDirty(false);
        await fetchSettings();
      }
    } catch {
      // error handled
    } finally {
      setSaving(false);
    }
  };

  const toggleKeys = Object.keys(SETTING_LABELS);
  const numericKeys = Object.keys(NUMERIC_SETTINGS);

  return (
    <PageTransition>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/app/settings" className="p-2 hover:bg-muted rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Communication Settings</h1>
            <p className="text-sm text-muted-foreground">Manage calls, messaging, and file sharing</p>
          </div>
        </div>

        {loading ? <SettingSkeleton /> : !settings ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p>Could not load settings. You may not have permission.</p>
          </div>
        ) : (
          <>
            {/* Feature Toggles */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Features</h2>
              <div className="space-y-2">
                {toggleKeys.map(key => (
                  <ToggleSetting key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
                ))}
              </div>
            </div>

            {/* Rate Limits & Sizes */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Limits</h2>
              <div className="space-y-2">
                {numericKeys.map(key => (
                  <NumericSetting key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
                ))}
              </div>
            </div>

            {/* Allowed File Types */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">File Types</h2>
              <AllowedFileTypes value={settings.allowed_file_types} onChange={handleChange} />
            </div>

            {/* Save */}
            {dirty && (
              <div className="sticky bottom-4 flex justify-end">
                <LoadingButton loading={saving} onClick={handleSave} className="shadow-lg">
                  <Shield className="w-4 h-4 mr-2" /> Save Changes
                </LoadingButton>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
