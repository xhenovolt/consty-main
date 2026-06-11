import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db.js';
import { getCurrentUser } from '@/lib/current-user.js';
import { BookOpen, ChevronLeft, Clock, Tag, Globe, Lock } from 'lucide-react';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const result = await query(`SELECT title FROM docs WHERE id = $1 OR slug = $1`, [id]).catch(() => null);
  return { title: result?.rows[0]?.title ? `${result.rows[0].title} — Consty Docs` : 'Doc — Consty Docs' };
}

export default async function DocDetailPage({ params }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const result = await query(
    `SELECT d.*, u.name AS author_name
     FROM docs d
     LEFT JOIN users u ON d.created_by = u.id
     WHERE d.id = $1 OR d.slug = $1`,
    [id]
  ).catch(() => null);

  const doc = result?.rows[0];
  if (!doc) notFound();

  const versionsResult = await query(
    `SELECT version, created_at FROM doc_versions WHERE doc_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [doc.id]
  ).catch(() => ({ rows: [] }));

  const CATEGORY_COLORS = {
    architecture: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    security:     'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    guides:       'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    modules:      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    general:      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  };
  const categoryColor = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.general;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/app/docs" className="hover:text-foreground flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          Docs
        </Link>
        <span>/</span>
        <span className="capitalize">{doc.category}</span>
        <span>/</span>
        <span className="text-foreground">{doc.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Header */}
          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{doc.title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColor}`}>
                    <Tag className="w-3 h-3 inline mr-1" />
                    {doc.category}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    v{doc.version}
                  </span>
                  {doc.is_public ? (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Public
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Internal
                    </span>
                  )}
                </div>
              </div>
              {user?.is_superadmin && (
                <Link
                  href={`/app/docs/${doc.id}/edit`}
                  className="text-xs px-3 py-1.5 border rounded-lg hover:bg-accent transition-colors"
                >
                  Edit
                </Link>
              )}
            </div>

            {/* Content rendered as pre-formatted markdown-like text */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <DocContent content={doc.content} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="bg-card border rounded-xl p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Metadata</h3>
            {doc.author_name && (
              <div>
                <span className="text-muted-foreground">Author</span>
                <div className="font-medium mt-0.5">{doc.author_name}</div>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Updated</span>
              <div className="font-medium mt-0.5">
                {new Date(doc.updated_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </div>
            </div>
          </div>

          {/* Version history */}
          {versionsResult.rows.length > 0 && (
            <div className="bg-card border rounded-xl p-4 space-y-3 text-sm">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Version History</h3>
              <div className="space-y-2">
                {versionsResult.rows.map((v, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">v{v.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <Link
            href="/app/docs"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Docs
          </Link>
        </div>
      </div>
    </div>
  );
}

// Simple content renderer — converts markdown headings and code blocks to HTML-ish JSX
function DocContent({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inCode = false;
  let codeLines = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        inCode = false;
        elements.push(
          <pre key={`code-${i}`} className="bg-muted rounded-lg p-4 overflow-x-auto my-3 text-xs font-mono">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        codeLang = '';
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold mt-6 mb-3 first:mt-0">{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-5 mb-2 border-b pb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} className="ml-4 list-disc text-sm">{renderInline(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={i} className="ml-4 list-decimal text-sm">{renderInline(line.replace(/^\d+\. /, ''))}</li>);
    } else if (line.startsWith('| ')) {
      // Table row — simplify as monospace line
      elements.push(<div key={i} className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded">{line}</div>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-1">{elements}</div>;
}

function renderInline(text) {
  // Handle `code` spans
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) =>
    part.startsWith('`') && part.endsWith('`')
      ? <code key={i} className="bg-muted px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>
      : part
  );
}
