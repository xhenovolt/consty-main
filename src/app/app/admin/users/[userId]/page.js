'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { confirmDangerous } from '@/lib/confirm';

export default function UserDetailPage({ params }) {
  const { userId } = params;
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch user details
      const userResponse = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include',
      });

      if (!userResponse.ok) throw new Error('Failed to fetch user');
      const userData = await userResponse.json();
      setUser(userData.data);
      setFormData(userData.data);
      setRoles(userData.data.roles);
      setPermissions(userData.data.permissions);

      // Fetch all roles
      const rolesResponse = await fetch('/api/admin/roles', {
        credentials: 'include',
      });

      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setAllRoles(rolesData.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: formData.full_name,
          username: formData.username,
          department: formData.department,
          profile_photo_url: formData.profile_photo_url,
          phone_number: formData.phone_number,
          status: formData.status,
          role_ids: formData.role_ids || roles.map((r) => r.id),
        }),
      });

      if (!response.ok) throw new Error('Failed to save user');

      setEditMode(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!await confirmDangerous('This will suspend the user.', 'Suspend User')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete user');

      router.push('/admin/users');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return <div className="p-8 text-red-600">User not found</div>;
  }

  const getAvatarText = () => {
    return (user.full_name || user.email)
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/app/admin/users" className="text-blue-600 hover:underline">
            ← Back to Users
          </Link>
          <h1 className="text-3xl font-bold mt-2">{user.full_name || user.username}</h1>
        </div>
        <div className="flex gap-2">
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-blue-600 text-foreground rounded hover:bg-blue-700"
            >
              Edit
            </button>
          )}
          {!user.is_superadmin && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-foreground rounded hover:bg-red-700"
            >
              Delete User
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: User Profile */}
        <div className="col-span-2 space-y-6">
          {/* Profile Section */}
          <div className="bg-card rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">Profile Information</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-6 mb-6">
                {user.profile_photo_url ? (
                  <img
                    src={user.profile_photo_url}
                    alt={user.username}
                    className="w-20 h-20 rounded-full"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-600 text-foreground text-2xl font-semibold flex items-center justify-center">
                    {getAvatarText()}
                  </div>
                )}

                {editMode && (
                  <input
                    type="url"
                    value={formData.profile_photo_url || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, profile_photo_url: e.target.value })
                    }
                    placeholder="Profile photo URL"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                  />
                )}
              </div>

              {editMode ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.full_name || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={formData.department || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone_number || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone_number: e.target.value,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="dormant">Dormant</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-green-600 text-foreground rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setFormData(user);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <div className="font-medium">{user.email}</div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">Username</span>
                    <div className="font-medium">{user.username || 'Not set'}</div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">Department</span>
                    <div className="font-medium">
                      {user.department || 'Not assigned'}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="font-medium capitalize">{user.status}</div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">Created</span>
                    <div className="font-medium">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sessions Section */}
          {user.sessions && user.sessions.length > 0 && (
            <div className="bg-card rounded-lg p-6 shadow">
              <h2 className="text-xl font-bold mb-4">Active Sessions</h2>

              <div className="space-y-3">
                {user.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="border rounded p-4 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">
                        {session.device_name} - {session.browser}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {session.country}, {session.city} • {session.ip_address}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last active:{' '}
                        {new Date(session.last_activity).toLocaleString()}
                      </div>
                    </div>

                    {session.is_active && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch(
                              `/api/admin/users/${userId}/sessions/${session.id}`,
                              { method: 'DELETE', credentials: 'include' }
                            );
                            fetchData();
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                        className="px-3 py-1 bg-red-600 text-foreground rounded text-sm hover:bg-red-700"
                      >
                        Kill Session
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Roles & Permissions */}
        <div className="space-y-6">
          {/* Roles Card */}
          <div className="bg-card rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">Roles</h2>

            {user.is_superadmin ? (
              <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 rounded text-sm dark:bg-purple-900/30 dark:text-purple-300">
                Superadmin (immutable)
              </div>
            ) : (
              <div className="space-y-2">
                {roles.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No roles assigned</p>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      className="p-2 bg-blue-50 border border-blue-200 rounded text-sm"
                    >
                      <div className="font-medium">{role.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {role.description}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Status Card */}
          <div className="bg-card rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">Account Status</h2>

            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Current Status</span>
                <div className="text-lg font-bold capitalize">{user.status}</div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Last Seen</span>
                <div className="font-medium">
                  {user.last_seen
                    ? new Date(user.last_seen).toLocaleString()
                    : 'Never'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-card rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Sessions</span>
                <span className="font-medium">
                  {user.sessions?.filter((s) => s.is_active).length || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Roles Assigned</span>
                <span className="font-medium">{roles.length}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Permissions</span>
                <span className="font-medium">{permissions.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
