'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Users, Building2, Calendar, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { deptId } = params;

  const [department, setDepartment] = useState(null);
  const [members, setMembers] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    fetchDepartmentDetails();
  }, [deptId]);

  const fetchDepartmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch department details
      const deptRes = await fetchWithAuth(`/api/departments/${deptId}`);
      if (!deptRes.ok) throw new Error('Failed to fetch department');
      const deptData = await deptRes.json();
      setDepartment(deptData.data);

      // Fetch operations log (audit logs for this department)
      try {
        const opsRes = await fetchWithAuth(`/api/audit-logs?entity_id=${deptId}&entity_type=department&limit=50`);
        if (opsRes.ok) {
          const opsData = await opsRes.json();
          setOperations(opsData.data || []);
        }
      } catch {
        // API may not exist, continue
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-500 mb-4">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted text-foreground"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="p-6">
        <span className="text-muted-foreground">Department not found</span>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted text-foreground mt-4"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft size={20} className="text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 size={28} />
            {department.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{department.description || 'No description'}</p>
        </div>
      </div>

      {/* Department Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Department Code</p>
          <p className="text-lg font-semibold text-foreground">{department.code || '—'}</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            <Users size={14} /> Members
          </p>
          <p className="text-lg font-semibold text-foreground">{members.length}</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            <Calendar size={14} /> Created
          </p>
          <p className="text-lg font-semibold text-foreground text-sm">
            {new Date(department.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overview'
              ? 'text-foreground border-blue-500'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab('members')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members'
              ? 'text-foreground border-blue-500'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Members ({members.length})
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'activity'
              ? 'text-foreground border-blue-500'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-muted/50 border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">Department Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground">{department.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium text-foreground">{department.description || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground capitalize">{department.status || 'active'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created At</p>
                  <p className="font-medium text-foreground">
                    {new Date(department.created_at).toLocaleString('en-US')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="bg-muted/50 border border-border rounded-xl overflow-hidden">
            {members.length === 0 ? (
              <div className="p-12 text-center">
                <Users size={40} className="mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground">No members in this department</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <div key={member.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{member.name || member.email}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-blue-500/15 text-blue-400">
                        {member.role || 'member'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="bg-muted/50 border border-border rounded-xl overflow-hidden">
            {operations.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar size={40} className="mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground">No activity on this department</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {operations.map((op) => (
                  <div key={op.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground text-sm">{op.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(op.created_at).toLocaleString('en-US')}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-blue-500/15 text-blue-400">
                        {op.entity_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
