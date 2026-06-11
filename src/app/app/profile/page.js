'use client';

/**
 * Profile Page — Full Identity Layer
 * Tabs: Overview, Activity, Permissions, Devices
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Camera, Shield, Activity, Monitor, Edit3, Save, X,
  Clock, Globe, Phone, Mail, Building2, ChevronRight, Trash2,
  Loader2, Image as ImageIcon, Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { PageTransition } from '@/components/ui/PageTransition';

const TABS = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'devices', label: 'Devices', icon: Monitor },
];

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-40 bg-muted rounded-xl" />
      <div className="flex items-end gap-4 -mt-12 px-6">
        <div className="w-24 h-24 rounded-full bg-muted border-4 border-background" />
        <div className="space-y-2 pb-2">
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      </div>
      <div className="px-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function AvatarPickerModal({ isOpen, onClose, onSelect, currentAvatar }) {
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('all');

  const styles = [
    'all', 'adventurer', 'avataaars', 'big-smile', 'bottts',
    'fun-emoji', 'lorelei', 'micah', 'pixel-art', 'thumbs',
  ];

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.get(`/api/profile/avatars?style=${selectedStyle}`, { silent: true })
      .then(res => {
        if (res.ok) setAvatars(res.data);
      })
      .finally(() => setLoading(false));
  }, [isOpen, selectedStyle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Choose Avatar</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Style Filter */}
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-2">
          {styles.map(s => (
            <button
              key={s}
              onClick={() => setSelectedStyle(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedStyle === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'All Styles' : s}
            </button>
          ))}
        </div>

        {/* Avatar Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
              {avatars.map(av => (
                <button
                  key={av.id}
                  onClick={() => { onSelect(av); onClose(); }}
                  className={`relative rounded-xl p-1 transition hover:ring-2 hover:ring-primary ${
                    currentAvatar === av.id ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted'
                  }`}
                >
                  <img
                    src={av.thumbnail}
                    alt={av.id}
                    className="w-full aspect-square rounded-lg"
                    loading="lazy"
                  />
                  {currentAvatar === av.id && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function OverviewTab({ profile, isEditing, setIsEditing, onSave, saving }) {
  const [form, setForm] = useState({
    full_name: '',
    bio: '',
    phone: '',
    timezone: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        timezone: profile.timezone || 'UTC',
      });
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard icon={Mail} label="Email" value={profile?.email} />
        <InfoCard icon={Building2} label="Department" value={profile?.department || 'Not assigned'} />
        <InfoCard icon={Shield} label="Role" value={profile?.role?.toUpperCase()} />
        <InfoCard icon={Globe} label="Timezone" value={profile?.timezone || 'UTC'} />
        <InfoCard icon={Clock} label="Member since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'} />
        <InfoCard icon={Clock} label="Last login" value={profile?.last_login ? new Date(profile.last_login).toLocaleDateString() : 'Never'} />
      </div>

      {/* Edit Form */}
      {isEditing ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border border-border rounded-xl p-6 space-y-4 bg-card"
        >
          <h3 className="font-semibold text-foreground">Edit Profile</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
              <input
                value={form.full_name}
                onChange={e => handleChange('full_name', e.target.value)}
                className="w-full px-3 py-2 bg-muted text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 bg-muted text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Timezone</label>
              <select
                value={form.timezone}
                onChange={e => handleChange('timezone', e.target.value)}
                className="w-full px-3 py-2 bg-muted text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Intl.supportedValuesOf('timeZone').map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={e => handleChange('bio', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-muted text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <LoadingButton variant="ghost" onClick={() => setIsEditing(false)}>Cancel</LoadingButton>
            <LoadingButton loading={saving} onClick={() => onSave(form)} loadingText="Saving...">
              <Save className="w-4 h-4 mr-1" /> Save
            </LoadingButton>
          </div>
        </motion.div>
      ) : (
        <div className="border border-border rounded-xl p-6 bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Bio</h3>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          </div>
          <p className="text-muted-foreground text-sm">
            {profile?.bio || 'No bio yet. Click edit to add one.'}
          </p>
        </div>
      )}

      {/* Staff Linkage */}
      {profile?.staff_id && (
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Staff Account: {profile.staff_name}</p>
              <p className="text-xs text-muted-foreground">Linked staff ID: #{profile.staff_id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ userId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchActivity = useCallback(async (newOffset = 0) => {
    setLoading(true);
    const res = await api.get(`/api/profile/activity?limit=20&offset=${newOffset}`, { silent: true });
    if (res.ok) {
      setActivities(prev => newOffset === 0 ? res.data : [...prev, ...res.data]);
      setTotal(res.data ? parseInt(res.data.length) : 0);
      setOffset(newOffset);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const activityIcons = {
    login: '🔐', logout: '🚪', profile_updated: '✏️', password_changed: '🔒',
    deal_created: '💼', payment_made: '💰', message_sent: '💬',
  };

  return (
    <div className="space-y-3">
      {loading && activities.length === 0 ? (
        [...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No activity recorded yet</p>
        </div>
      ) : (
        <>
          {activities.map((act, i) => (
            <motion.div
              key={act.id || i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
                {activityIcons[act.action] || '📋'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground capitalize">
                  {act.action?.replace(/_/g, ' ')}
                </p>
                {act.entity_type && (
                  <p className="text-xs text-muted-foreground">
                    {act.entity_type}{act.entity_id ? ` #${act.entity_id}` : ''}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(act.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </motion.div>
          ))}
          {activities.length >= 20 && (
            <LoadingButton
              variant="ghost"
              loading={loading}
              onClick={() => fetchActivity(offset + 20)}
              className="w-full"
            >
              Load More
            </LoadingButton>
          )}
        </>
      )}
    </div>
  );
}

function PermissionsTab({ permissions = [], role }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <p className="font-semibold text-foreground">Role: {role?.toUpperCase()}</p>
          <p className="text-sm text-muted-foreground">
            {role === 'superadmin' ? 'Full system access — all permissions granted' : `${permissions.length} permissions granted`}
          </p>
        </div>
      </div>

      {role === 'superadmin' ? (
        <p className="text-sm text-muted-foreground italic px-2">
          Superadmin bypasses all permission checks. All system operations are available.
        </p>
      ) : permissions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No explicit permissions assigned</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {permissions.map((perm, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{perm.name}</p>
                {perm.description && (
                  <p className="text-xs text-muted-foreground">{perm.description}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function DevicesTab({ devices = [], onRemoveDevice }) {
  const [removing, setRemoving] = useState(null);

  const handleRemove = async (deviceId) => {
    setRemoving(deviceId);
    await onRemoveDevice(deviceId);
    setRemoving(null);
  };

  const osIcons = {
    Windows: '🖥️', Mac: '🍎', macOS: '🍎', Linux: '🐧',
    iOS: '📱', Android: '📱', Chrome: '🌐',
  };

  return (
    <div className="space-y-3">
      {devices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No devices recorded yet</p>
        </div>
      ) : (
        devices.map((device, i) => (
          <motion.div
            key={device.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-4 p-4 rounded-xl border transition ${
              device.is_current
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-card hover:bg-muted/30'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
              {osIcons[device.os] || '💻'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {device.browser || 'Unknown'} on {device.os || 'Unknown'}
                </p>
                {device.is_current && (
                  <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-medium">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                IP: {device.ip_address || 'Unknown'} · Last active: {
                  device.last_active_at
                    ? new Date(device.last_active_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Unknown'
                }
              </p>
            </div>
            {!device.is_current && (
              <LoadingButton
                variant="ghost"
                size="sm"
                loading={removing === device.id}
                onClick={() => handleRemove(device.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </LoadingButton>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/api/profile', { silent: true });
    if (res.ok) {
      setProfile(res.data);
    } else {
      toast.error('Failed to load profile');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async (form) => {
    setSaving(true);
    const res = await api.patch('/api/profile', form, {
      successMessage: 'Profile updated successfully',
    });
    if (res.ok) {
      setProfile(prev => ({ ...prev, ...res.data }));
      setIsEditing(false);
    }
    setSaving(false);
  };

  const handleAvatarSelect = async (avatar) => {
    const res = await api.patch('/api/profile', {
      avatar_id: avatar.id,
      profile_image_url: avatar.url,
    }, { successMessage: 'Avatar updated!' });
    if (res.ok) {
      setProfile(prev => ({ ...prev, avatar_id: avatar.id, profile_image_url: avatar.url }));
    }
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Get upload config
    const configRes = await api.get('/api/profile/upload-config', { silent: true });
    if (!configRes.ok) {
      toast.error('Upload not configured');
      return;
    }

    const { cloudName, uploadPreset, folder } = configRes.data;

    if (!cloudName || !uploadPreset) {
      toast.error('Cloudinary not configured. Using avatar system instead.');
      return;
    }

    toast.info('Uploading image...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);

    try {
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );
      const uploadData = await uploadRes.json();

      if (uploadData.secure_url) {
        const saveRes = await api.post('/api/profile/upload-config', {
          imageUrl: uploadData.secure_url,
          imageType: type,
        }, { successMessage: `${type === 'profile' ? 'Profile' : 'Cover'} image updated!` });

        if (saveRes.ok) {
          setProfile(prev => ({
            ...prev,
            [type === 'profile' ? 'profile_image_url' : 'cover_image_url']: uploadData.secure_url,
          }));
        }
      }
    } catch {
      toast.error('Upload failed. Try again.');
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    const res = await api.delete('/api/profile/devices', {
      body: { deviceId },
      successMessage: 'Device removed',
    });
    if (res.ok) {
      setProfile(prev => ({
        ...prev,
        devices: prev.devices.filter(d => d.id !== deviceId),
      }));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ProfileSkeleton />
      </div>
    );
  }

  const avatarUrl = profile?.profile_image_url
    || (profile?.avatar_id ? `https://api.dicebear.com/9.x/${profile.avatar_id.split('-')[0]}/svg?seed=${profile.avatar_id.split('-').slice(1).join('-')}&size=128` : null)
    || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(profile?.full_name || profile?.email || 'U')}&size=128`;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Cover + Avatar Header */}
        <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
          {/* Cover Image */}
          <div className="h-40 sm:h-52 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 relative">
            {profile?.cover_image_url && (
              <img src={profile.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
            )}
            <label className="absolute top-3 right-3 p-2 bg-background/80 backdrop-blur rounded-lg cursor-pointer hover:bg-background transition">
              <Camera className="w-4 h-4 text-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'cover')} />
            </label>
          </div>

          {/* Avatar + Name */}
          <div className="px-6 pb-6 -mt-12 flex items-end gap-4">
            <div className="relative group">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-24 h-24 rounded-full border-4 border-background bg-muted object-cover"
              />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                <button
                  onClick={() => setShowAvatarPicker(true)}
                  className="p-1.5 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition"
                  title="Choose avatar"
                >
                  <User className="w-4 h-4 text-white" />
                </button>
                <label className="p-1.5 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition cursor-pointer" title="Upload photo">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'profile')} />
                </label>
              </div>
            </div>
            <div className="pb-1">
              <h1 className="text-xl font-bold text-foreground">{profile?.full_name || 'User'}</h1>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  {profile?.role?.toUpperCase()}
                </span>
                {profile?.department && (
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                    {profile.department}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl border border-border">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <OverviewTab
                profile={profile}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                onSave={handleSave}
                saving={saving}
              />
            )}
            {activeTab === 'activity' && <ActivityTab userId={profile?.id} />}
            {activeTab === 'permissions' && (
              <PermissionsTab permissions={profile?.permissions} role={profile?.role} />
            )}
            {activeTab === 'devices' && (
              <DevicesTab devices={profile?.devices} onRemoveDevice={handleRemoveDevice} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Avatar Picker Modal */}
        <AnimatePresence>
          {showAvatarPicker && (
            <AvatarPickerModal
              isOpen={showAvatarPicker}
              onClose={() => setShowAvatarPicker(false)}
              onSelect={handleAvatarSelect}
              currentAvatar={profile?.avatar_id}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
