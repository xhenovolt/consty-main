'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';
import { withApprovalPrompt } from '@/lib/approval-prompt';
import {
  Image as ImgIcon, Video, Music, FileText, Archive, File as FileIco,
  Upload, Search, Download, Eye, Trash2, X, Loader2, AlertTriangle,
} from 'lucide-react';

// ─── File-type taxonomy ────────────────────────────────────────────────────
const FILE_TYPES = [
  { key: 'all',      label: 'All Files',  icon: FileIco,   match: () => true },
  { key: 'image',    label: 'Images',     icon: ImgIcon,   match: (m) => m?.startsWith('image/') },
  { key: 'video',    label: 'Videos',     icon: Video,     match: (m) => m?.startsWith('video/') },
  { key: 'audio',    label: 'Audio',      icon: Music,     match: (m) => m?.startsWith('audio/') },
  { key: 'document', label: 'Documents',  icon: FileText,  match: (m) => /pdf|word|excel|spreadsheet|presentation|csv|text|rtf|opendocument/.test(m || '') },
  { key: 'archive',  label: 'Archives',   icon: Archive,   match: (m) => /zip|tar|gzip|rar|7z/.test(m || '') },
];

const ENTITY_TYPES = [
  { value: '', label: 'All' },
  { value: 'system', label: 'System' },
  { value: 'deal', label: 'Deal' },
  { value: 'client', label: 'Client' },
  { value: 'staff', label: 'Staff' },
  { value: 'resource', label: 'Resource' },
  { value: 'general', label: 'General' },
];

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

function FileTypeBadge({ mime }) {
  const cls = 'w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold';
  if (!mime) return <div className={`${cls} bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300`}>?</div>;
  if (mime.startsWith('image/')) return <div className={`${cls} bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300`}>IMG</div>;
  if (mime.startsWith('video/')) return <div className={`${cls} bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300`}>VID</div>;
  if (mime.startsWith('audio/')) return <div className={`${cls} bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300`}>AUD</div>;
  if (mime.includes('pdf'))      return <div className={`${cls} bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300`}>PDF</div>;
  if (/zip|tar|gzip|rar|7z/.test(mime)) return <div className={`${cls} bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300`}>ZIP</div>;
  return <div className={`${cls} bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300`}>FILE</div>;
}

export default function MediaPage() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState('');   // surface RBAC denial
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ entity_type: 'general', entity_id: '', tags: '', quality: 'original' });
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  const toast = useToast();

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setPermError('');
    try {
      let url = '/api/media?';
      if (entityFilter) url += `entity_type=${entityFilter}&`;
      if (tagFilter)    url += `tag=${encodeURIComponent(tagFilter)}&`;
      const res = await fetchWithAuth(url);
      if (res?.success) {
        setMedia(res.data || []);
      } else {
        setPermError(res?.error || 'You do not have permission to view the media library.');
      }
    } catch (e) {
      setPermError(e?.message || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [entityFilter, tagFilter]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', uploadForm.entity_type);
      if (uploadForm.entity_id) formData.append('entity_id', uploadForm.entity_id);
      if (uploadForm.tags)      formData.append('tags', uploadForm.tags);
      formData.append('quality', uploadForm.quality);

      // withApprovalPrompt: if the server returns 403 with
      // can_request_approval, the user is prompted to open an approval
      // request instead of seeing a silent denial.
      const result = await withApprovalPrompt(
        '/api/media/upload',
        { method: 'POST', body: formData },
        { actionLabel: `Upload "${file.name}" to ${uploadForm.entity_type}` }
      );
      if (result.ok) {
        toast.success(`Uploaded "${file.name}"`);
        setShowUpload(false);
        setUploadForm({ entity_type: 'general', entity_id: '', tags: '', quality: 'original' });
        fetchMedia();
        return;
      }
      if (result.requestedApproval) {
        toast.success(result.error);   // "Approval requested for ..."
        setShowUpload(false);
        return;
      }
      setUploadError(result.error || 'Upload failed');
      toast.error(result.error || 'Upload failed');
    } catch (e) {
      const msg = e?.message || 'Network error during upload';
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (m) => {
    if (!await confirmDelete(m.original_filename || m.filename || 'this file')) return;
    try {
      const res = await fetchWithAuth(`/api/media?id=${m.id}`, { method: 'DELETE' });
      if (res?.success) { toast.success('File deleted'); fetchMedia(); }
      else              { toast.error(res?.error || 'Failed to delete'); }
    } catch (e) { toast.error(e?.message || 'Failed to delete'); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDownload = (m) => {
    // Hits the server proxy that forces Content-Disposition: attachment with the
    // original filename + extension preserved. Same-tab navigation is fine here;
    // the browser will trigger a save-dialog and stay on the page.
    const a = document.createElement('a');
    a.href = `/api/media/${m.id}/download`;
    a.download = m.original_filename || m.filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Downloading ${a.download}`);
  };

  // ─── Derived stats (Number()-correct, not string-concat) ────────────────
  const totals = media.reduce(
    (acc, m) => {
      const size = Number(m.file_size) || 0;
      acc.total++;
      acc.totalBytes += size;
      if (m.mime_type?.startsWith('image/'))      { acc.images++;    acc.imageBytes    += size; }
      else if (m.mime_type?.startsWith('video/')) { acc.videos++;    acc.videoBytes    += size; }
      else if (m.mime_type?.startsWith('audio/')) { acc.audios++;    acc.audioBytes    += size; }
      else if (/pdf|word|excel|spreadsheet|presentation|csv|text|rtf|opendocument/.test(m.mime_type || '')) {
                                                    acc.documents++; acc.documentBytes += size; }
      else if (/zip|tar|gzip|rar|7z/.test(m.mime_type || ''))
                                                  { acc.archives++; acc.archiveBytes  += size; }
      else                                        { acc.other++;    acc.otherBytes    += size; }
      return acc;
    },
    { total: 0, totalBytes: 0, images: 0, imageBytes: 0, videos: 0, videoBytes: 0,
      audios: 0, audioBytes: 0, documents: 0, documentBytes: 0,
      archives: 0, archiveBytes: 0, other: 0, otherBytes: 0 }
  );

  // ─── Client-side filtering ──────────────────────────────────────────────
  const filtered = media.filter(m => {
    const t = FILE_TYPES.find(t => t.key === typeFilter);
    if (t && !t.match(m.mime_type)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${m.original_filename || ''} ${m.filename || ''} ${(m.tags || []).join(' ')} ${m.entity_type || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload, preview, and download files with proper filenames preserved.</p>
        </div>
        <button onClick={() => { setShowUpload(s => !s); setUploadError(''); }}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium inline-flex items-center gap-2 cursor-pointer">
          <Upload className="w-4 h-4" />{showUpload ? 'Cancel' : 'Upload'}
        </button>
      </div>

      {/* Permission/loader gating */}
      {loading && <div className="p-8 text-center text-muted-foreground">Loading…</div>}

      {permError && !loading && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-sm">{permError}</div>
        </div>
      )}

      {/* Stats */}
      {!loading && !permError && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Files"     count={totals.total}     bytes={totals.totalBytes} />
          <StatCard label="Images"    count={totals.images}    bytes={totals.imageBytes} />
          <StatCard label="Videos"    count={totals.videos}    bytes={totals.videoBytes} />
          <StatCard label="Audio"     count={totals.audios}    bytes={totals.audioBytes} />
          <StatCard label="Documents" count={totals.documents} bytes={totals.documentBytes} />
          <StatCard label="Archives"  count={totals.archives}  bytes={totals.archiveBytes} />
        </div>
      )}

      {/* Upload Zone */}
      {showUpload && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Upload File</h3>
          {uploadError && (
            <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{uploadError}</div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Entity Type">
              <select value={uploadForm.entity_type} onChange={e => setUploadForm(s => ({ ...s, entity_type: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm [&>option]:bg-background">
                {ENTITY_TYPES.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Tags (comma-separated)">
              <input type="text" value={uploadForm.tags} onChange={e => setUploadForm(s => ({ ...s, tags: e.target.value }))}
                placeholder="logo, branding"
                className="w-full rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm" />
            </Field>
            <Field label="Quality">
              <select value={uploadForm.quality} onChange={e => setUploadForm(s => ({ ...s, quality: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm [&>option]:bg-background">
                <option value="original">Original</option>
                <option value="optimized">Optimized (auto-compress)</option>
              </select>
            </Field>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-border hover:border-muted-foreground/50'
            }`}>
            <input ref={fileRef} type="file" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} />
            {uploading ? (
              <div className="text-primary font-medium flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</div>
            ) : (
              <>
                <div className="text-lg font-medium text-foreground">Drop a file or click to browse</div>
                <div className="text-xs text-muted-foreground mt-2">Images up to 10 MB · Videos up to 100 MB</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && !permError && (
        <>
          <div className="flex flex-wrap gap-2">
            {FILE_TYPES.map(t => {
              const Icon = t.icon;
              const active = typeFilter === t.key;
              const count = t.key === 'all' ? media.length : media.filter(m => t.match(m.mime_type)).length;
              return (
                <button key={t.key} onClick={() => setTypeFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-1.5 border transition cursor-pointer ${
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted text-foreground'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                  <span className={`text-xs ${active ? 'opacity-80' : 'text-muted-foreground'}`}>· {count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by filename, tag, entity…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
              className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm [&>option]:bg-background">
              {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input value={tagFilter} onChange={e => setTagFilter(e.target.value)} placeholder="Tag…"
              className="rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm" />
          </div>
        </>
      )}

      {/* Grid */}
      {!loading && !permError && (
        filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileIco className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-lg font-medium">No files match</p>
            <p className="text-sm mt-1">{media.length === 0 ? 'Upload your first file to get started.' : 'Try clearing filters.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => (
              <MediaCard key={m.id} m={m}
                onPreview={() => setPreview(m)}
                onDownload={() => handleDownload(m)}
                onDelete={() => handleDelete(m)} />
            ))}
          </div>
        )
      )}

      {/* Preview modal */}
      {preview && (
        <PreviewModal m={preview} onClose={() => setPreview(null)} onDownload={() => handleDownload(preview)} />
      )}
    </div>
  );
}

function MediaCard({ m, onPreview, onDownload, onDelete }) {
  const isImage = m.mime_type?.startsWith('image/');
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden group">
      <div className="h-40 bg-muted overflow-hidden cursor-pointer flex items-center justify-center" onClick={onPreview}>
        {isImage && (m.thumbnail_url || m.secure_url) ? (
          <img src={m.thumbnail_url || m.secure_url} alt={m.original_filename}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <FileTypeBadge mime={m.mime_type} />
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="font-medium text-sm text-foreground truncate" title={m.original_filename}>
          {m.original_filename || m.filename || `media-${m.id}`}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>{formatSize(m.file_size)}</span>
          {m.width && m.height && <span>{m.width}×{m.height}</span>}
          {m.format && <span className="uppercase">{m.format}</span>}
        </div>
        {m.entity_type && (
          <div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {m.entity_type}
            </span>
          </div>
        )}
        {Array.isArray(m.tags) && m.tags.length > 0 && m.tags[0] !== '' && (
          <div className="flex flex-wrap gap-1">
            {m.tags.map((t, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">{m.created_at?.split('T')[0]}</span>
          <div className="flex gap-1">
            <button onClick={onPreview} title="Preview"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
              <Eye className="w-4 h-4" />
            </button>
            <button onClick={onDownload} title="Download"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onDelete} title="Delete"
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ m, onClose, onDownload }) {
  const previewUrl = `/api/media/${m.id}/preview`;
  const mime = m.mime_type || '';
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-5xl max-h-[92vh] w-full relative bg-card rounded-xl border border-border overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-3 border-b border-border">
          <div className="truncate text-sm font-medium text-foreground">{m.original_filename || m.filename}</div>
          <div className="flex gap-1.5">
            <button onClick={onDownload} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30 p-3">
          {mime.startsWith('image/') ? (
            <img src={previewUrl} alt={m.original_filename} className="max-w-full max-h-[80vh] object-contain rounded" />
          ) : mime.startsWith('video/') ? (
            <video src={previewUrl} controls className="max-w-full max-h-[80vh] rounded" />
          ) : mime.startsWith('audio/') ? (
            <audio src={previewUrl} controls className="w-full max-w-md" />
          ) : mime.includes('pdf') ? (
            <iframe src={previewUrl} title={m.original_filename} className="w-full h-[80vh] rounded bg-white" />
          ) : (
            <div className="text-center text-muted-foreground p-12">
              <FileIco className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No inline preview for <code>{mime || 'this type'}</code>.</p>
              <button onClick={onDownload} className="mt-3 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm inline-flex items-center gap-1.5 cursor-pointer">
                <Download className="w-4 h-4" /> Download to open
              </button>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-3">
          <span>{formatSize(m.file_size)}</span>
          {m.width && m.height && <span>{m.width}×{m.height}</span>}
          {m.format && <span className="uppercase">{m.format}</span>}
          <span>{mime || '—'}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, count, bytes }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-foreground mt-1">{count}</div>
      <div className="text-xs text-muted-foreground">{formatSize(bytes)}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
