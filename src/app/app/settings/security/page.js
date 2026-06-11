'use client';

/**
 * /app/settings/security — Biometric Authentication & Account Security
 *
 * Allows users to:
 *  - Register passkeys (fingerprint / face unlock)
 *  - View all registered passkey devices with timestamps
 *  - Rename a device
 *  - Revoke (delete) a device
 *
 * Uses the @simplewebauthn/browser client to interact with the platform
 * authenticator (Touch ID, Windows Hello, Face ID, etc.).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint, ShieldCheck, Smartphone, Monitor, Laptop,
  Tablet, Plus, Trash2, Pencil, Check, X, Loader2,
  AlertTriangle, Clock, KeyRound, Info,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function DeviceIcon({ deviceName, className = 'w-5 h-5' }) {
  const d = (deviceName || '').toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return <Smartphone className={className} />;
  if (d.includes('tablet') || d.includes('ipad'))  return <Tablet className={className} />;
  if (d.includes('laptop'))                         return <Laptop className={className} />;
  return <Monitor className={className} />;
}

// Detect if the browser supports WebAuthn + platform authenticators
function usePlatformAuthSupport() {
  const [supported, setSupported] = useState(null); // null = detecting

  useEffect(() => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setSupported(false);
      return;
    }
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(ok => setSupported(ok))
      .catch(() => setSupported(false));
  }, []);

  return supported;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PasskeyRow({ passkey, onRename, onRevoke }) {
  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(passkey.device_name);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const submitRename = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onRename(passkey.id, name.trim());
      setEditing(false);
    } catch {
      toast.error('Failed to rename device');
    } finally {
      setSaving(false);
    }
  };

  const submitRevoke = async () => {
    if (!window.confirm(`Remove "${passkey.device_name}" from your account?\n\nYou will no longer be able to use it for biometric login.`)) return;
    setDeleting(true);
    try {
      await onRevoke(passkey.id);
    } catch {
      toast.error('Failed to remove device');
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-muted/30 rounded-xl border border-border">
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
        <DeviceIcon deviceName={passkey.device_name} className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>

      {/* Name + timestamps */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setEditing(false); setName(passkey.device_name); } }}
              className="flex-1 px-2 py-1 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={64}
            />
            <button onClick={submitRename} disabled={saving} className="text-green-600 hover:text-green-500 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => { setEditing(false); setName(passkey.device_name); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium text-foreground truncate">{passkey.device_name}</p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Added {timeAgo(passkey.created_at)}
          </span>
          {passkey.last_used_at && (
            <span className="text-xs text-muted-foreground">
              Last used {timeAgo(passkey.last_used_at)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            title="Rename device"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={submitRevoke}
            disabled={deleting}
            title="Remove device"
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SecuritySettingsPage() {
  const [passkeys, setPasskeys]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [showLabelPrompt, setShowLabelPrompt] = useState(false);
  const toast  = useToast();
  const platformSupported = usePlatformAuthSupport();

  // ── Load passkeys ──────────────────────────────────────────────────────────
  const loadPasskeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/passkeys');
      if (res.success) setPasskeys(res.data || []);
      else toast.error(res.error || 'Failed to load passkeys');
    } catch {
      toast.error('Failed to load passkeys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPasskeys(); }, [loadPasskeys]);

  // ── Enroll biometric ───────────────────────────────────────────────────────
  const startEnrollment = async () => {
    // Dynamic import so the browser bundle is only loaded when needed
    let startRegistration;
    try {
      const mod = await import('@simplewebauthn/browser');
      startRegistration = mod.startRegistration;
    } catch {
      toast.error('WebAuthn browser module unavailable. Make sure you are on a secure (HTTPS) connection.');
      return;
    }

    setEnrolling(true);
    try {
      // 1. Get options from server
      const optRes = await fetchWithAuth('/api/auth/passkeys/register-options');
      if (!optRes.success) {
        toast.error(optRes.error || 'Failed to start registration');
        return;
      }

      // 2. Ask the platform authenticator to create a credential
      let credential;
      try {
        credential = await startRegistration({ optionsJSON: optRes.options });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          toast.error('Biometric prompt was dismissed or denied. Please try again.');
        } else if (err.name === 'InvalidStateError') {
          toast.error('This device is already registered.');
        } else {
          toast.error(`Registration failed: ${err.message}`);
        }
        return;
      }

      // 3. Send to server for verification + storage
      const label = deviceLabel.trim() || autoDeviceLabel();
      const saveRes = await fetchWithAuth('/api/auth/passkeys/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ credential, deviceName: label }),
      });

      if (saveRes.success) {
        toast.success('Biometric login enabled for this device!');
        setDeviceLabel('');
        setShowLabelPrompt(false);
        loadPasskeys();
      } else {
        toast.error(saveRes.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
      console.error('[SecurityPage] enroll error:', err);
    } finally {
      setEnrolling(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRename = async (passkeyId, newName) => {
    const res = await fetchWithAuth('/api/auth/passkeys', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ passkeyId, deviceName: newName }),
    });
    if (res.success) {
      setPasskeys(prev => prev.map(p => p.id === passkeyId ? { ...p, device_name: newName } : p));
      toast.success('Device renamed');
    } else {
      throw new Error(res.error || 'Rename failed');
    }
  };

  const handleRevoke = async (passkeyId) => {
    const res = await fetchWithAuth('/api/auth/passkeys', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ passkeyId }),
    });
    if (res.success) {
      setPasskeys(prev => prev.filter(p => p.id !== passkeyId));
      toast.success('Device removed');
    } else {
      throw new Error(res.error || 'Delete failed');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Security</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage biometric authentication and account security settings.
        </p>
      </div>

      {/* ── Biometric Authentication section ──────────────────────────────── */}
      <section className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Biometric Authentication</h2>
            <p className="text-xs text-muted-foreground">
              Fingerprint · Face ID · Windows Hello · Touch ID
            </p>
          </div>
        </div>

        {/* Browser compatibility notice */}
        {platformSupported === false && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Your browser does not detect a platform authenticator on this device. Make sure
              you are on HTTPS and that the device has a biometric sensor or PIN set up.
            </p>
          </div>
        )}

        {platformSupported === null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking biometric support…
          </div>
        )}

        {/* Explanation when no passkeys yet */}
        {!loading && passkeys.length === 0 && platformSupported && (
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Enable biometric login so you can sign into Consty using your device&apos;s
              fingerprint sensor, Face ID, or Windows Hello — no password required.
            </p>
          </div>
        )}

        {/* Device list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading devices…
          </div>
        ) : (
          <div className="space-y-2">
            {passkeys.map(pk => (
              <PasskeyRow
                key={pk.id}
                passkey={pk}
                onRename={handleRename}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}

        {/* Device label prompt */}
        {showLabelPrompt && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Device label <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={deviceLabel}
              onChange={e => setDeviceLabel(e.target.value)}
              placeholder={autoDeviceLabel()}
              maxLength={64}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground">
              Give this device a name to recognise it later (e.g. "Work MacBook", "Samsung S24").
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center gap-2 flex-wrap">
          {!showLabelPrompt ? (
            <button
              onClick={() => setShowLabelPrompt(true)}
              disabled={enrolling || platformSupported === false}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Biometric Login
            </button>
          ) : (
            <>
              <button
                onClick={startEnrollment}
                disabled={enrolling}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {enrolling
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
                  : <><Fingerprint className="w-4 h-4" /> Register Biometric</>
                }
              </button>
              <button
                onClick={() => { setShowLabelPrompt(false); setDeviceLabel(''); }}
                disabled={enrolling}
                className="px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {passkeys.length > 0 && !showLabelPrompt && (
            <span className="text-xs text-muted-foreground">
              {passkeys.length} device{passkeys.length !== 1 ? 's' : ''} registered
            </span>
          )}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-muted/30 rounded-xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">How biometric login works</h3>
        </div>
        <ul className="space-y-2 text-xs text-muted-foreground list-none">
          {[
            'Your biometric data never leaves your device. Only a cryptographic key pair is shared with Consty.',
            'Registering a device creates a secure passkey — a WebAuthn credential backed by your OS security chip.',
            'At login, your device signs a one-time challenge. If verified, Consty creates a full session — same as password login.',
            'Removing a device here permanently revokes the passkey. You can always re-register.',
            'Password login remains available at all times as a fallback.',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}

/** Auto-suggest a label based on the current user-agent. */
function autoDeviceLabel() {
  if (typeof navigator === 'undefined') return 'My Device';
  const ua = navigator.userAgent || '';
  if (/iPhone/.test(ua))                      return 'iPhone';
  if (/iPad/.test(ua))                        return 'iPad';
  if (/Android.*Mobile/.test(ua))             return 'Android Phone';
  if (/Android/.test(ua))                     return 'Android Tablet';
  if (/Macintosh/.test(ua))                   return 'Mac';
  if (/Windows NT/.test(ua))                  return 'Windows PC';
  if (/Linux/.test(ua))                       return 'Linux PC';
  if (/CrOS/.test(ua))                        return 'Chromebook';
  return 'My Device';
}
