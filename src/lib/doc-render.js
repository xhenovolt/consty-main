/**
 * Tiny markdown → HTML renderer for document previews.
 *
 * Deliberately small (~100 lines) so we don't pull in a 50 KB dep for what
 * organisational documents actually need: paragraphs, headings, bold,
 * italic, lists, blockquotes, hr, inline code. No tables, no nested lists,
 * no images (documents embed those via branding helpers, not markdown).
 *
 * All output is HTML-escaped before formatting markers are applied, so
 * the resulting string is safe to put into dangerouslySetInnerHTML.
 *
 * Placeholders like {{token}} are wrapped in a styled <span> so the user
 * can visually distinguish unfilled slots in the preview.
 */

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ESC_MAP[c]);

function inlineFormat(text) {
  // Order matters: escape first, then apply inline markers on the escaped
  // text. Each replacement only matches inside a single line.
  let s = escapeHtml(text);
  s = s.replace(/`([^`\n]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">$1</code>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\b(https?:\/\/[^\s<]+)/g, '<a href="$1" class="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, '<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded text-sm font-mono">{{$1}}</span>');
  return s;
}

export function markdownToHtml(md) {
  if (!md) return '';
  const lines = String(md).split(/\r?\n/);
  const out = [];
  let inList = null; // 'ul' | 'ol' | null
  let inBlockquote = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p class="my-3 leading-relaxed">${inlineFormat(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) { out.push(`</${inList}>`); inList = null; }
  };
  const closeBlockquote = () => {
    if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushParagraph(); closeList(); closeBlockquote();
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList(); closeBlockquote();
      const lvl = heading[1].length;
      const sizes = { 1: 'text-3xl mt-6 mb-3', 2: 'text-2xl mt-5 mb-3', 3: 'text-xl mt-4 mb-2', 4: 'text-lg mt-3 mb-2', 5: 'text-base mt-2 mb-1', 6: 'text-sm mt-2 mb-1 uppercase tracking-wide' };
      out.push(`<h${lvl} class="font-semibold ${sizes[lvl]}">${inlineFormat(heading[2])}</h${lvl}>`);
      continue;
    }

    // Horizontal rule
    if (/^---+$|^\*\*\*+$/.test(line.trim())) {
      flushParagraph(); closeList(); closeBlockquote();
      out.push('<hr class="my-4 border-slate-300 dark:border-slate-700" />');
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      flushParagraph(); closeList();
      if (!inBlockquote) { out.push('<blockquote class="border-l-4 border-slate-300 dark:border-slate-600 pl-4 my-3 italic text-slate-600 dark:text-slate-400">'); inBlockquote = true; }
      out.push(`<p class="my-1">${inlineFormat(line.replace(/^>\s?/, ''))}</p>`);
      continue;
    } else {
      closeBlockquote();
    }

    // Unordered list
    const ul = line.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      if (inList !== 'ul') { closeList(); out.push('<ul class="list-disc pl-6 my-3 space-y-1">'); inList = 'ul'; }
      out.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }
    // Ordered list
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      if (inList !== 'ol') { closeList(); out.push('<ol class="list-decimal pl-6 my-3 space-y-1">'); inList = 'ol'; }
      out.push(`<li>${inlineFormat(ol[1])}</li>`);
      continue;
    }
    closeList();

    // Regular paragraph line
    paragraph.push(line);
  }
  flushParagraph(); closeList(); closeBlockquote();
  return out.join('\n');
}

/**
 * Render a document body for the on-screen preview, choosing the right
 * strategy by format. `html` is returned verbatim (caller is trusted —
 * templates are authored by staff with documents.manage). `markdown` and
 * `rich` go through markdownToHtml. `plain` is wrapped in a single <pre>
 * to preserve whitespace.
 */
export function renderDocumentBody(body, format = 'markdown') {
  if (!body) return '';
  if (format === 'html' || format === 'rich') return body;
  if (format === 'plain') return `<pre class="whitespace-pre-wrap font-sans leading-relaxed">${escapeHtml(body)}</pre>`;
  return markdownToHtml(body);
}
