'use client';

/**
 * Issues Management Page
 * Displays auto-logged errors and manual issue reports
 * Allows resolution tracking and filtering
 */

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Clock, X, RefreshCw, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-red-300 dark:border-red-700',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 border-orange-300 dark:border-orange-700',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
  low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-700',
};

const STATUS_COLORS = {
  open: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200',
  assigned: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200',
  'in-progress': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200',
  closed: 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

export default function IssuesPage() {
  const { addToast } = useToast();
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Fetch issues
  const fetchIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSeverity) params.append('severity', filterSeverity);
      if (filterStatus) params.append('status', filterStatus);

      const res = await fetch(`/api/issues?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch issues');
      const data = await res.json();
      setIssues(data.data || []);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to load issues',
      });
    } finally {
      setIsLoading(false);
    }
  }, [filterSeverity, filterStatus, addToast]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleResolveIssue = async (issueId) => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'resolved' }),
      });

      if (!res.ok) throw new Error('Failed to resolve issue');
      
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId ? { ...issue, status: 'resolved' } : issue
        )
      );

      addToast({
        type: 'success',
        title: 'Issue Resolved',
        message: 'The issue has been marked as resolved.',
      });

      setSelectedIssue(null);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err.message,
      });
    }
  };

  return (
    <div className="flex h-full gap-4 p-6 bg-background">
      {/* Issues List */}
      <div className="flex-1 flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">System Issues</h1>
          <p className="text-muted-foreground">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'} total
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <select
            value={filterSeverity || ''}
            onChange={(e) => setFilterSeverity(e.target.value || null)}
            className="px-3 py-2 bg-muted text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-3 py-2 bg-muted text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>

          <button
            onClick={() => {
              setFilterSeverity(null);
              setFilterStatus(null);
            }}
            className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Issues Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : issues.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No issues found
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2">
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className={`w-full text-left p-4 rounded-lg border transition ${
                    selectedIssue?.id === issue.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <h3 className="font-medium text-foreground truncate">
                          {issue.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {issue.error_code} • {new Date(issue.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${SEVERITY_COLORS[issue.severity]}`}>
                        {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[issue.status]}`}>
                        {issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Issue Details */}
      {selectedIssue && (
        <div className="w-96 flex flex-col bg-card border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-muted p-4 border-b border-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="font-bold text-foreground truncate">{selectedIssue.title}</h2>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-1 hover:bg-background rounded transition"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Error Code */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Error Code
              </label>
              <code className="block bg-background p-2 rounded text-sm text-foreground font-mono">
                {selectedIssue.error_code || 'N/A'}
              </code>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Description
              </label>
              <p className="text-sm text-foreground bg-background p-2 rounded max-h-32 overflow-y-auto">
                {selectedIssue.description || 'No description'}
              </p>
            </div>

            {/* Stack Trace */}
            {selectedIssue.error_stack && (
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Stack Trace
                </label>
                <pre className="text-xs bg-background p-2 rounded max-h-32 overflow-auto text-destructive font-mono">
                  {selectedIssue.error_stack}
                </pre>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Severity:</span>
                <p className="font-medium text-foreground uppercase">
                  {selectedIssue.severity}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-medium text-foreground uppercase">
                  {selectedIssue.status}
                </p>
              </div>
              <div col-Span-2>
                <span className="text-muted-foreground">Created:</span>
                <p className="font-medium text-foreground">
                  {new Date(selectedIssue.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border space-y-2">
            {selectedIssue.status !== 'resolved' && (
              <button
                onClick={() => handleResolveIssue(selectedIssue.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Resolved
              </button>
            )}
            <button
              onClick={() => setSelectedIssue(null)}
              className="w-full px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
