'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity, RefreshCw, CheckCircle2, AlertTriangle, Zap, Server, Clock, Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const fmtMs = (n) => n == null ? '—' : `${Math.round(Number(n))} ms`;
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

export default function DraisHealthPage() {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [byEndpoint, setByEndpoint] = useState([]);
  const [byError, setByError] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [ping, setPing] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth('/api/drais/platform/calls?limit=100').then(x => x.json());
      if (r.success) {
        setCalls(r.calls || []);
        setStats(r.stats || null);
        setByEndpoint(r.by_endpoint || []);
        setByError(r.by_error || []);
      } else toast.error(r.error || 'Failed to load DRAIS call log');
    } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const pingHealth = async () => {
    setPinging(true);
    setPing(null);
    try {
      const r = await fetchWithAuth('/api/drais/platform/health').then(x => x.json());
      setPing(r);
      if (r.success) toast.success(`DRAIS healthy — ${r.meta?.latency_ms ?? '?'} ms`);
      else toast.error(r.error || 'DRAIS unhealthy');
      load();
    } finally { setPinging(false); }
  };

  const successRate = stats && stats.total > 0
    ? Math.round((stats.ok / stats.total) * 100)
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">DRAIS Platform Integration</h1>
            <p className="text-sm text-muted-foreground">Shadow-consumer observability for <code className="text-xs">/api/platform/v1</code>. Read-only.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={pingHealth} disabled={pinging}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
            {pinging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Test /health
          </button>
        </div>
      </div>

      {/* Ping result */}
      {ping && (
        <div className={`rounded-xl border p-4 ${
          ping.success
            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900'
            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900'
        }`}>
          <div className="flex items-start gap-3">
            {ping.success
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />}
            <div className="flex-1 text-sm">
              <div className="font-semibold text-foreground">
                {ping.success
                  ? `DRAIS responded healthy in ${ping.meta?.latency_ms ?? '?'} ms`
                  : (ping.error || 'DRAIS unhealthy')}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                {ping.meta?.request_id && <span>X-Request-Id: <code className="font-mono">{ping.meta.request_id}</code></span>}
                {ping.meta?.api_version && <span>API: {ping.meta.api_version}</span>}
                {ping.code && <span>Code: {ping.code}</span>}
                {ping.status && <span>HTTP: {ping.status}</span>}
                {ping.meta?.rate_limit?.remaining != null && (
                  <span>Rate limit: {ping.meta.rate_limit.remaining}/{ping.meta.rate_limit.limit}</span>
                )}
              </div>
              {ping.data && (
                <pre className="mt-2 text-xs font-mono bg-white/50 dark:bg-black/20 rounded p-2 overflow-x-auto">{JSON.stringify(ping.data, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 24-h stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Calls (24h)" value={stats?.total ?? 0} />
        <Stat label="Success rate" value={successRate == null ? '—' : `${successRate}%`} color={successRate == null ? '' : successRate >= 99 ? 'text-emerald-600' : successRate >= 95 ? 'text-amber-600' : 'text-red-600'} />
        <Stat label="Client errors" value={stats?.client_err ?? 0} color={(stats?.client_err || 0) > 0 ? 'text-amber-600' : ''} />
        <Stat label="Server errors" value={stats?.server_err ?? 0} color={(stats?.server_err || 0) > 0 ? 'text-red-600' : ''} />
        <Stat label="Network/timeout" value={stats?.network_err ?? 0} color={(stats?.network_err || 0) > 0 ? 'text-red-600' : ''} />
        <Stat label="p50 latency" value={fmtMs(stats?.p50)} />
        <Stat label="p95 latency" value={fmtMs(stats?.p95)} color={stats?.p95 > 1000 ? 'text-amber-600' : ''} />
      </div>

      {/* Per-endpoint + per-error breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="By endpoint (24h)" icon={<Activity className="w-4 h-4" />}>
          {byEndpoint.length === 0 ? <Empty text="No calls in the last 24 h." /> : (
            <SimpleTable
              headers={['Endpoint', 'Calls', 'p50', 'p95']}
              rows={byEndpoint.map(r => [
                <code key="e" className="font-mono text-xs truncate max-w-xs inline-block">{r.endpoint}</code>,
                r.n, fmtMs(r.p50), fmtMs(r.p95),
              ])}
            />
          )}
        </Card>
        <Card title="By error code (24h)" icon={<AlertTriangle className="w-4 h-4" />}>
          {byError.length === 0 ? <Empty text="No errors in the last 24 h." /> : (
            <SimpleTable
              headers={['Code', 'Count']}
              rows={byError.map(r => [
                <code key="c" className="font-mono text-xs">{r.error_code}</code>,
                r.n,
              ])}
            />
          )}
        </Card>
      </div>

      {/* Recent call log */}
      <Card title={`Recent calls (last ${calls.length})`} icon={<Clock className="w-4 h-4" />}>
        {loading ? <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
          : calls.length === 0 ? (
            <Empty text="No calls yet. Hit “Test /health” above to fire the first one." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border bg-muted/30">
                  <Th>When</Th><Th>Method</Th><Th>Endpoint</Th><Th>Status</Th><Th>Code</Th><Th>Latency</Th><Th>Bytes</Th><Th>Attempt</Th><Th>Request ID</Th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {calls.map(c => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(c.called_at)}</td>
                      <td className="px-2 py-1.5 font-mono">{c.method}</td>
                      <td className="px-2 py-1.5 font-mono truncate max-w-xs" title={c.endpoint}>{c.endpoint}</td>
                      <td className="px-2 py-1.5">
                        <StatusBadge code={c.status_code} />
                      </td>
                      <td className="px-2 py-1.5 font-mono">{c.error_code || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{c.latency_ms} ms</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{c.response_size ?? '—'}</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">{c.attempt}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground truncate max-w-[140px]" title={c.request_id}>{c.request_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <div className="text-xs text-muted-foreground">
        Configured via <code>DRAIS_PLATFORM_BASE_URL</code> and <code>DRAIS_PLATFORM_TOKEN</code>. This page only reads; no mutations are wired in this commit.
      </div>
    </div>
  );
}

function StatusBadge({ code }) {
  if (code == null) return <span className="text-muted-foreground">—</span>;
  let cls = 'bg-muted text-muted-foreground';
  if (code >= 200 && code < 300) cls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  else if (code === 429)         cls = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  else if (code >= 400 && code < 500) cls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  else if (code >= 500)          cls = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${cls}`}>{code}</span>;
}

function Stat({ label, value, color = 'text-foreground' }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
function Card({ title, icon, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">{icon} {title}</h2>
      {children}
    </div>
  );
}
function Empty({ text }) { return <div className="text-sm text-muted-foreground text-center py-4">{text}</div>; }
const Th = ({ children }) => <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">{children}</th>;
function SimpleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border">{headers.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1.5 text-foreground">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
