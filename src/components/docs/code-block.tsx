'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { highlight, type TokenType } from '@/lib/docs/highlight';
import { cn } from '@/lib/utils';

const TOKEN_CLASS: Record<TokenType, string> = {
  plain: '',
  str: 'text-emerald-500',
  num: 'text-amber-500',
  kw: 'text-violet-500',
  com: 'italic text-muted-foreground',
  key: 'text-sky-500',
  flag: 'text-amber-500',
  var: 'text-pink-500',
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Small "Copy" button that flips to "Copied" for a moment. */
export function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      aria-label={done ? 'Copied' : `${label} to clipboard`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {done ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const tokens = highlight(code, lang);
  return (
    <div className="my-5 overflow-hidden rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {lang || 'text'}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-foreground">
        <code>
          {tokens.map((t, i) =>
            t.type === 'plain' ? (
              t.v
            ) : (
              <span key={i} className={TOKEN_CLASS[t.type]}>
                {t.v}
              </span>
            ),
          )}
        </code>
      </pre>
    </div>
  );
}

const METHOD_CLASS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  POST: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  PUT: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  PATCH: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/30',
};

/** "POST  /api/v1/…" with a coloured method badge and a copy button. */
export function EndpointLine({ methods, path }: { methods: string[]; path: string }) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2">
      {methods.map((m) => (
        <span
          key={m}
          className={cn(
            'rounded-md border px-2 py-0.5 text-xs font-bold tracking-wide',
            METHOD_CLASS[m] ?? 'border-border text-muted-foreground',
          )}
        >
          {m}
        </span>
      ))}
      <code className="min-w-0 break-all rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-medium">
        {path}
      </code>
      <CopyButton text={path} label="Copy path" className="text-[11px]" />
    </span>
  );
}