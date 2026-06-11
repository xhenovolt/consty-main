'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Upload, Palette } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function DocumentSettingsPage() {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const response = await fetch('/api/documents/branding');
      const data = await response.json();
      if (data.success) {
        setBranding(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch branding:', error);
      toast({
        title: 'Error',
        description: 'Failed to load branding settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/documents/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Branding settings saved successfully',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to save branding:', error);
      toast({
        title: 'Error',
        description: 'Failed to save branding settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setBranding(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Document Settings</h1>
        <p className="text-gray-600">Configure branding, security, and system settings</p>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Organization Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="organization_name">Organization Name</Label>
                    <Input
                      id="organization_name"
                      value={branding.organization_name || ''}
                      onChange={(e) => handleInputChange('organization_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="header_text">Header Text</Label>
                    <Input
                      id="header_text"
                      value={branding.header_text || ''}
                      onChange={(e) => handleInputChange('header_text', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <Input
                      id="primary_color"
                      type="color"
                      value={branding.primary_color || '#1F2937'}
                      onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="secondary_color">Secondary Color</Label>
                    <Input
                      id="secondary_color"
                      type="color"
                      value={branding.secondary_color || '#374151'}
                      onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="accent_color">Accent Color</Label>
                    <Input
                      id="accent_color"
                      type="color"
                      value={branding.accent_color || '#3B82F6'}
                      onChange={(e) => handleInputChange('accent_color', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                      id="logo_url"
                      value={branding.logo_url || ''}
                      onChange={(e) => handleInputChange('logo_url', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="logo_width">Logo Width</Label>
                      <Input
                        id="logo_width"
                        type="number"
                        value={branding.logo_width || 100}
                        onChange={(e) => handleInputChange('logo_width', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="logo_height">Logo Height</Label>
                      <Input
                        id="logo_height"
                        type="number"
                        value={branding.logo_height || 60}
                        onChange={(e) => handleInputChange('logo_height', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="signature_url">Signature URL</Label>
                    <Input
                      id="signature_url"
                      value={branding.signature_url || ''}
                      onChange={(e) => handleInputChange('signature_url', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signature_name">Signature Name</Label>
                    <Input
                      id="signature_name"
                      value={branding.signature_name || ''}
                      onChange={(e) => handleInputChange('signature_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signature_title">Signature Title</Label>
                    <Input
                      id="signature_title"
                      value={branding.signature_title || ''}
                      onChange={(e) => handleInputChange('signature_title', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={branding.address_line1 || ''}
                      onChange={(e) => handleInputChange('address_line1', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={branding.city || ''}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="postal_code">Postal Code</Label>
                      <Input
                        id="postal_code"
                        value={branding.postal_code || ''}
                        onChange={(e) => handleInputChange('postal_code', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={branding.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={branding.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={branding.website || ''}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveBranding} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Branding'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Document security settings are managed through environment variables and database configuration.
                Contact your system administrator for advanced security settings.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Default document settings and templates are configured through the database.
                Use the Templates page to manage default templates.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}