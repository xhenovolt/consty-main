'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Download, Eye, MoreHorizontal, Filter, CheckSquare, Square, Trash2, RefreshCw } from 'lucide-react';
import { ResponsiveTable, MobileCardTable } from '@/components/ui/ResponsiveTable';
// "MMM dd, yyyy" via Intl — no extra dependency.
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export default function GeneratedDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useState({
    search: '',
    status: 'all',
    document_type: 'all',
    category_id: 'all',
    recipient_email: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    fetchDocuments();
  }, [searchParams]);

  const fetchDocuments = async () => {
    try {
      const queryString = new URLSearchParams(searchParams).toString();
      const response = await fetch(`/api/documents/search?${queryString}&limit=50`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (field, value) => {
    setSearchParams(prev => ({ ...prev, [field]: value }));
  };

  const handleBulkAction = async (action) => {
    if (selectedDocuments.length === 0) return;

    try {
      const response = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          document_ids: selectedDocuments,
          reason: `Bulk ${action} operation`
        })
      });

      const data = await response.json();
      if (data.success) {
        await fetchDocuments();
        setSelectedDocuments([]);
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  const toggleDocumentSelection = (docId) => {
    setSelectedDocuments(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const toggleAllSelection = () => {
    setSelectedDocuments(
      selectedDocuments.length === documents.length
        ? []
        : documents.map(doc => doc.id)
    );
  };

  const handleDownloadPDF = async (docId) => {
    window.open(`/api/documents/pdf/${docId}`, '_blank');
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: 'default',
      revoked: 'destructive',
      expired: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const renderTableRow = (doc) => [
    <div key="select" className="flex items-center">
      <input
        type="checkbox"
        checked={selectedDocuments.includes(doc.id)}
        onChange={() => toggleDocumentSelection(doc.id)}
        className="rounded"
      />
    </div>,
    <div key="id" className="font-mono text-sm">{doc.unique_id}</div>,
    <div key="title" className="font-medium">{doc.title}</div>,
    <Badge key="type" variant="outline">{doc.document_type}</Badge>,
    <div key="recipient" className="text-sm">{doc.recipient_name}</div>,
    <div key="email" className="text-sm text-muted-foreground max-w-xs truncate">{doc.recipient_email}</div>,
    getStatusBadge(doc.status),
    <div key="generated" className="text-sm">{fmtDate(doc.generated_at)}</div>,
    <div key="actions" className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={() => window.open(`/verify/${doc.unique_id}`, '_blank')}>
        <Eye className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(doc.unique_id)}>
        <Download className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm">
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </div>
  ];

  const renderCard = (doc) => (
    <Card key={doc.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedDocuments.includes(doc.id)}
              onChange={() => toggleDocumentSelection(doc.id)}
              className="rounded"
            />
            <div>
              <CardTitle className="text-lg">{doc.title}</CardTitle>
              <p className="text-sm text-muted-foreground font-mono">{doc.unique_id}</p>
            </div>
          </div>
          {getStatusBadge(doc.status)}
        </div>
        <div className="space-y-1 text-sm">
          <p><strong>Type:</strong> {doc.document_type}</p>
          <p><strong>Recipient:</strong> {doc.recipient_name}</p>
          <p><strong>Email:</strong> {doc.recipient_email}</p>
          <p><strong>Generated:</strong> {fmtDate(doc.generated_at)}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/verify/${doc.unique_id}`, '_blank')}>
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(doc.unique_id)}>
            <Download className="w-4 h-4 mr-1" />
            Download PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="p-6">Loading documents...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Generated Documents</h1>
          <p className="text-gray-600">View and manage all generated documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDocuments}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => window.open('/api/documents/export?type=documents&format=csv', '_blank')}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedDocuments.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleBulkAction('revoke')} className="text-orange-600">
                  Revoke Selected
                </Button>
                <Button variant="outline" onClick={() => handleBulkAction('restore')} className="text-green-600">
                  Restore Selected
                </Button>
                <Button variant="outline" onClick={() => handleBulkAction('delete')} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters {showFilters ? 'Hide' : 'Show'}
            </Button>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${showFilters ? '' : 'hidden'}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search documents..."
                value={searchParams.search}
                onChange={(e) => handleSearchChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={searchParams.status}
              onChange={(e) => handleSearchChange('status', e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
            </select>
            <select
              value={searchParams.document_type}
              onChange={(e) => handleSearchChange('document_type', e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Types</option>
              <option value="internship_acceptance">Internship</option>
              <option value="job_offer">Job Offer</option>
              <option value="certificate">Certificate</option>
            </select>
            <Input
              placeholder="Recipient email"
              value={searchParams.recipient_email}
              onChange={(e) => handleSearchChange('recipient_email', e.target.value)}
            />
            <Input
              type="date"
              value={searchParams.date_from}
              onChange={(e) => handleSearchChange('date_from', e.target.value)}
              placeholder="From date"
            />
            <Input
              type="date"
              value={searchParams.date_to}
              onChange={(e) => handleSearchChange('date_to', e.target.value)}
              placeholder="To date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <ResponsiveTable>
        <MobileCardTable
          headers={[
            <div key="select" className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedDocuments.length === documents.length && documents.length > 0}
                onChange={toggleAllSelection}
                className="rounded"
              />
              Select All
            </div>,
            'Document ID',
            'Title',
            'Type',
            'Recipient',
            'Email',
            'Status',
            'Generated',
            'Actions'
          ]}
          rows={documents}
          renderRow={renderTableRow}
          renderCard={renderCard}
          keyExtractor={(item) => item.id}
          emptyMessage="No documents found matching your criteria."
        />
      </ResponsiveTable>

      {documents.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {documents.length} documents
        </div>
      )}
    </div>
  );
}