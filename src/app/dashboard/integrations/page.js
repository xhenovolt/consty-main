/**
 * /dashboard/integrations
 * 
 * External system connection management
 * - View all connections
 * - Add new connection
 * - Test connections
 * - Activate/deactivate
 * - Delete connections
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Plus,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SecureConnectionCard from '@/components/integrations/SecureConnectionCard';

export default function IntegrationsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showReveal, setShowReveal] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_type: 'drais',
    base_url: '',
    api_key: '',
    api_secret: '',
    is_active: false,
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Load connections
  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/connections');
      if (!response.ok) throw new Error('Failed to load connections');
      const data = await response.json();
      setConnections(data.data || []);
    } catch (error) {
      console.error('Failed to load connections:', error);
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/integrations/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create connection');
      }

      toast.success('Connection created successfully');
      setFormData({
        name: '',
        description: '',
        system_type: 'drais',
        base_url: '',
        api_key: '',
        api_secret: '',
        is_active: false,
      });
      setFormErrors({});
      setShowForm(false);
      loadConnections();
    } catch (error) {
      console.error('Failed to create connection:', error);
      toast.error(error.message || 'Failed to create connection');
    } finally {
      setSubmitting(false);
    }
  }

  async function testConnection(conn) {
    setTesting(conn.id);
    try {
      const response = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: conn.base_url,
          api_key: 'sk_' + Math.random(), // Will fail, but we're testing connectivity
          api_secret: 'ss_' + Math.random(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Connection verified!');
        // Update connection's last tested time
        loadConnections();
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Connection test failed');
    } finally {
      setTesting(null);
    }
  }

  async function toggleActive(conn) {
    try {
      const response = await fetch(`/api/integrations/connections/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !conn.is_active }),
      });

      if (!response.ok) throw new Error('Failed to update connection');

      toast.success(
        conn.is_active ? 'Connection deactivated' : 'Connection activated'
      );
      loadConnections();
    } catch (error) {
      console.error('Failed to update connection:', error);
      toast.error('Failed to update connection');
    }
  }

  async function deleteConnection(conn) {
    setDeleting(null);
    try {
      const response = await fetch(`/api/integrations/connections/${conn.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete connection');

      toast.success('Connection deleted');
      loadConnections();
    } catch (error) {
      console.error('Failed to delete connection:', error);
      toast.error('Failed to delete connection');
    }
  }

  function validateForm() {
    const errors = {};

    if (!formData.name.trim()) errors.name = 'Name required';
    if (!formData.base_url.trim()) errors.base_url = 'Base URL required';
    if (!formData.api_key.trim()) errors.api_key = 'API Key required';
    if (!formData.api_secret.trim()) errors.api_secret = 'API Secret required';

    try {
      new URL(formData.base_url);
    } catch {
      errors.base_url = 'Invalid URL format';
    }

    return errors;
  }

  function toggleReveal(id) {
    setShowReveal((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">External Integrations</h1>
          <p className="text-gray-600 mt-1">
            Manage API connections for external systems
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Connection
        </Button>
      </div>

      {/* Status */}
      {connections.length === 0 && !loading && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            No external connections configured. Add one below to enable DRAIS control
            features.
          </AlertDescription>
        </Alert>
      )}

      {/* Create Form */}
      {showForm && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle>Add External Connection</CardTitle>
            <CardDescription>
              Secure credentials for connecting to external systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="e.g., DRAIS Production"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={formErrors.name ? 'border-red-500' : ''}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">System Type</label>
                  <select
                    value={formData.system_type}
                    onChange={(e) =>
                      setFormData({ ...formData, system_type: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="drais">DRAIS</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Optional notes about this connection"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Base URL</label>
                <Input
                  type="url"
                  placeholder="https://api.example.com"
                  value={formData.base_url}
                  onChange={(e) =>
                    setFormData({ ...formData, base_url: e.target.value })
                  }
                  className={formErrors.base_url ? 'border-red-500' : ''}
                />
                {formErrors.base_url && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.base_url}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    placeholder="sk_..."
                    value={formData.api_key}
                    onChange={(e) =>
                      setFormData({ ...formData, api_key: e.target.value })
                    }
                    className={formErrors.api_key ? 'border-red-500' : ''}
                  />
                  {formErrors.api_key && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.api_key}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">API Secret</label>
                  <Input
                    type="password"
                    placeholder="ss_..."
                    value={formData.api_secret}
                    onChange={(e) =>
                      setFormData({ ...formData, api_secret: e.target.value })
                    }
                    className={formErrors.api_secret ? 'border-red-500' : ''}
                  />
                  {formErrors.api_secret && (
                    <p className="text-xs text-red-600 mt-1">
                      {formErrors.api_secret}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                  />
                  <span className="text-sm">Set as active connection</span>
                </label>

                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Connection'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Connections List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading connections...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No connections yet. Create your first connection above.
        </div>
      ) : (
        <div className="grid gap-6">
          {connections.map((conn) => (
            <SecureConnectionCard
              key={conn.id}
              connection={conn}
              onDelete={() => loadConnections()}
              onToggleActive={() => loadConnections()}
              onRefresh={() => loadConnections()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
