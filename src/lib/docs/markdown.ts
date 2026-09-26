// ============================================================
// Tiny Markdown parser for the developer docs (docs/*.md).
//
// Deliberately dependency-free and limited to the subset those files
// use: headings (with optional `{#custom-id}`), paragraphs, fenced code,
// lists, tables, blockquotes, hr, and inline code / bold / italic /
// links. Pure functions — safe on server and client.
// ============================================================

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'bold'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] };

export type Block =
  | { t: 'heading'; level: number; id: string; text: string; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'list'; ordered: boolean; items: Inline[][] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'quote'; c: Block[] }
  | { t: 'hr' };

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.t === 'text' || n.t === 'code') return n.v;
      return plainText(n.c);
    })
    .join('');
}

/** Stable, readable anchor slug: "Creating a key" → "creating-a-key". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const INLINE_SRC = '`([^`]+)`|\\[([^\\]]+)\\]\\(([^)\\s]+)\\)|\\*\\*(.+?)\\*\\*|\\*(.+?)\\*';

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  // A fresh regex per call: parseInline recurses (bold/link text), and a
  // shared global regex would have its lastIndex clobbered by the inner call.
  const re = new RegExp(INLINE_SRC, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[2] !== undefined) {
      out.push({ t: 'link', href: m[3], c: parseInline(m[2]) });
    } else if (m[4] !== undefined) out.push({ t: 'bold', c: parseInline(m[4]) });
    else if (m[5] !== undefined) out.push({ t: 'em', c: parseInline(m[5]) });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
  return out;
}

const LIST_RE = /^\s*([-*]|\d+\.)\s+(.*)$/;
const FENCE_RE = /^```(\S*)/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^\s*(-{3,}|\*{3,})\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function startsBlock(line: string, next: string | undefined): boolean {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    line.startsWith('>') ||
    LIST_RE.test(line) ||
    (line.trim().startsWith('|') && next !== undefined && TABLE_SEP_RE.test(next))
  );
}

function parseLines(lines: string[], used: Map<string, number>): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ t: 'code', lang: fence[1] || '', v: buf.join('\n') });
      continue;
    }

    const h = line.match(HEADING_RE);
    if (h) {
      let raw = h[2].trim();
      let custom: string | null = null;
      const c = raw.match(/\s*\{#([a-z0-9-]+)\}\s*$/);
      if (c) {
        custom = c[1];
        raw = raw.slice(0, c.index).trim();
      }
      const inline = parseInline(raw);
      const text = plainText(inline);
      const base = custom ?? (slugify(text) || 'section');
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      blocks.push({
        t: 'heading',
        level: h[1].length,
        id: n === 0 ? base : `${base}-${n + 1}`,
        text,
        c: inline,
      });
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ t: 'quote', c: parseLines(buf, used) });
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const head = splitRow(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ t: 'table', head, rows });
      continue;
    }

    const li = line.match(LIST_RE);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) {
          // A blank line continues the list only if the next non-blank
          // line is another item or an indented continuation.
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && (LIST_RE.test(lines[j]) || /^\s{2,}\S/.test(lines[j]))) {
            i = j;
            continue;
          }
          break;
        }
        const m = cur.match(LIST_RE);
        if (m) items.push(m[2]);
        else if (/^\s+\S/.test(cur) && items.length) items[items.length - 1] += ' ' + cur.trim();
        else break;
        i++;
      }
      blocks.push({ t: 'list', ordered, items: items.map(parseInline) });
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && startsBlock(lines[i], lines[i + 1]))) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ t: 'p', c: parseInline(buf.join(' ')) });
  }
  return blocks;
}

export function parseMarkdown(md: string): Block[] {
  return parseLines(md.replace(/\r\n/g, '\n').split('\n'), new Map());
}

export function extractToc(blocks: Block[]): TocItem[] {
  const toc: TocItem[] = [];
  for (const b of blocks) {
    if (b.t === 'heading' && (b.level === 2 || b.level === 3)) {
      toc.push({ id: b.id, text: b.text, level: b.level });
    }
  }
  return toc;
}

export function firstTitle(blocks: Block[], fallback: string): string {
  const h = blocks.find((b) => b.t === 'heading' && b.level === 1);
  return h && h.t === 'heading' ? h.text : fallback;
}