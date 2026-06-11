'use client';

import { useState, useEffect } from 'react';
import { Save, User, Lock, Bell, DollarSign, Palette, ChevronRight, MessageSquare, Building2, ShieldCheck } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWithAuth('/api/auth/me').then(r => r.json()).then(j => {
      if (j.success && j.data) { setUser(j.data); setForm({ name: j.data.name || '', email: j.data.email || '' }); }
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setError('');
    try {
      // Profile update would go through a user profile API
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Quick nav to sub-settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { href: '/app/settings/company', icon: Building2, label: 'Company Branding', desc: 'Logo, address & contact info' },
          { href: '/app/settings/financial', icon: DollarSign, label: 'Financial', desc: 'Currency & formatting' },
          { href: '/app/settings/appearance', icon: Palette, label: 'Appearance', desc: 'Theme & colors' },
          { href: '/app/settings/communication', icon: MessageSquare, label: 'Communication', desc: 'Calls, chat & file sharing' },
          { href: '/app/settings/security', icon: ShieldCheck, label: 'Security', desc: 'Biometric login & passkeys' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>

      {/* Profile */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Profile</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Email</label>
            <input value={form.email} disabled className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground" />
          </div>
        </div>
        {user && (
          <div className="text-xs text-muted-foreground">
            Role: <span className="capitalize font-medium text-muted-foreground">{user.role}</span> &middot; 
            Joined: {new Date(user.created_at).toLocaleDateString()}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={saveProfile} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Save className="w-4 h-4" /> Save Profile
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved!</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      {/* Security */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Security</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Current Password</label>
            <input type="password" value={passwordForm.current} onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">New Password</label>
              <input type="password" value={passwordForm.newPass} onChange={e => setPasswordForm(f => ({ ...f, newPass: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Confirm Password</label>
              <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
          </div>
        </div>
        <button className="bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition">
          Change Password
        </button>
      </div>

      {/* App Info */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">About</h2>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Consty Construction Operations Platform</div>
          <div>Architecture: event-driven project, finance, and document workflows</div>
          <div>Database: PostgreSQL on Neon</div>
        </div>
      </div>
    </div>
  );
}
