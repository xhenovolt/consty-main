'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ExternalLink, RefreshCw } from 'lucide-react';

// "MMM dd, yyyy HH:mm" via Intl — no extra dependency.
const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
};

export default function VerificationPortalPage() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchVerificationLogs();
  }, []);

  const fetchVerificationLogs = async () => {
    try {
      const response = await fetch('/api/documents/export?type=verification_logs&limit=100');
      const data = await response.json();
      if (data.success) {
        setVerifications(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch verification logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVerifications = verifications.filter(log =>
    log.document_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.verification_status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const variants = {
      success: 'default',
      failed: 'destructive',
      tampered: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (loading) {
    return <div className="p-6">Loading verification logs...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Document Verification Portal</h1>
          <p className="text-gray-600">Monitor document verification attempts and security</p>
        </div>
        <Button onClick={fetchVerificationLogs}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {verifications.filter(v => v.verification_status === 'success').length}
            </div>
            <p className="text-sm text-gray-600">Successful Verifications</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {verifications.filter(v => v.verification_status === 'failed').length}
            </div>
            <p className="text-sm text-gray-600">Failed Attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {verifications.filter(v => v.verification_status === 'tampered').length}
            </div>
            <p className="text-sm text-gray-600">Tampered Documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {new Set(verifications.map(v => v.document_id)).size}
            </div>
            <p className="text-sm text-gray-600">Unique Documents</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search verification logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Verification Logs Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Document ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>User Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVerifications.map((log, index) => (
              <TableRow key={index}>
                <TableCell>{fmtDateTime(log.verified_at)}</TableCell>
                <TableCell className="font-mono text-sm">{log.document_id}</TableCell>
                <TableCell>{log.document_title}</TableCell>
                <TableCell className="font-mono text-sm">{log.ip_address}</TableCell>
                <TableCell className="max-w-xs truncate" title={log.user_agent}>
                  {log.user_agent}
                </TableCell>
                <TableCell>{getStatusBadge(log.verification_status)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/verify/${log.document_id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {filteredVerifications.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No verification logs found.</p>
        </div>
      )}
    </div>
  );
}