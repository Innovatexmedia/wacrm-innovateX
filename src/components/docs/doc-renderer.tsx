import Link from 'next/link';
import { ExternalLink, Link2 } from 'lucide-react';

import type { Block, Inline } from '@/lib/docs/markdown';
import { CodeBlock, EndpointLine } from '@/components/docs/code-block';
import { cn } from '@/lib/utils';

const LINK_CLASS =
  'font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary';

/** `#hash` → this page; `/path` → in-app; `https://` → external; else null. */
function resolveHref(
  href: string,
  basePath: string,
): { href: string; external: boolean } | null {
  if (href.startsWith('#')) return { href: `${basePath}${href}`, external: false };
  if (href.startsWith('/')) return { href, external: false };
  if (/^https?:\/\//.test(href)) return { href, external: true };
  return null;
}

function Inlines({ nodes, basePath }: { nodes: Inline[]; basePath: string }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return <span key={i}>{n.v}</span>;
          case 'code':
            return (
              <code
                key={i}
                className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-medium text-foreground"
              >
                {n.v}
              </code>
            );
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-foreground">
                <Inlines nodes={n.c} basePath={basePath} />
              </strong>
            );
          case 'em':
            return (
              <em key={i}>
                <Inlines nodes={n.c} basePath={basePath} />
              </em>
            );
          case 'link': {
            const r = resolveHref(n.href, basePath);
            if (!r) return <Inlines key={i} nodes={n.c} basePath={basePath} />;
            if (r.external) {
              return (
                <a
                  key={i}
                  href={r.href}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(LINK_CLASS, 'inline-flex items-center gap-0.5')}
                >
                  <Inlines nodes={n.c} basePath={basePath} />
                  <ExternalLink className="size-3" />
                </a>
              );
            }
            return (
              <Link key={i} href={r.href} className={LINK_CLASS}>
                <Inlines nodes={n.c} basePath={basePath} />
              </Link>
            );
          }
        }
      })}
    </>
  );
}

const ENDPOINT_RE =
  /^((?:GET|POST|PUT|PATCH|DELETE)(?:\s*\/\s*(?:GET|POST|PUT|PATCH|DELETE))*)\s+(\/\S+)$/;

function AnchorLink({ id }: { id: string }) {
  return (
    <a
      href={`#${id}`}
      aria-label="Link to this section"
      className="ml-2 inline-flex align-middle text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
    >
      <Link2 className="size-4" />
    </a>
  );
}

function Heading({
  block,
  basePath,
}: {
  block: Extract<Block, { t: 'heading' }>;
  basePath: string;
}) {
  const { level, id, c, text } = block;
  const common = 'group scroll-mt-20';

  if (level === 1) {
    return (
      <h1 id={id} className={cn(common, 'text-3xl font-bold tracking-tight text-foreground')}>
        <Inlines nodes={c} basePath={basePath} />
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2
        id={id}
        className={cn(
          common,
          'mt-14 border-b border-border pb-2 text-2xl font-semibold tracking-tight text-foreground',
        )}
      >
        <Inlines nodes={c} basePath={basePath} />
        <AnchorLink id={id} />
      </h2>
    );
  }

  const ep = level === 3 ? text.match(ENDPOINT_RE) : null;
  if (ep) {
    return (
      <h3 id={id} className={cn(common, 'mt-10 text-lg font-semibold text-foreground')}>
        <EndpointLine methods={ep[1].split(/\s*\/\s*/)} path={ep[2]} />
        <AnchorLink id={id} />
      </h3>
    );
  }
  const Tag = level === 3 ? 'h3' : 'h4';
  return (
    <Tag
      id={id}
      className={cn(
        common,
        level === 3
          ? 'mt-10 text-lg font-semibold text-foreground'
          : 'mt-6 text-base font-semibold text-foreground',
      )}
    >
      <Inlines nodes={c} basePath={basePath} />
      <AnchorLink id={id} />
    </Tag>
  );
}

export function DocRenderer({ blocks, basePath }: { blocks: Block[]; basePath: string }) {
  return (
    <div className="text-[15px] leading-7 text-foreground/90">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'heading':
            return <Heading key={i} block={b} basePath={basePath} />;
          case 'p':
            return (
              <p key={i} className="mt-4">
                <Inlines nodes={b.c} basePath={basePath} />
              </p>
            );
          case 'code':
            return <CodeBlock key={i} code={b.v} lang={b.lang} />;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag
                key={i}
                className={cn(
                  'mt-4 space-y-1.5 pl-6',
                  b.ordered ? 'list-decimal' : 'list-disc',
                  'marker:text-muted-foreground',
                )}
              >
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines nodes={it} basePath={basePath} />
                  </li>
                ))}
              </Tag>
            );
          }
          case 'table':
            return (
              <div key={i} className="my-5 overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      {b.head.map((h, j) => (
                        <th
                          key={j}
                          className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold text-foreground"
                        >
                          <Inlines nodes={h} basePath={basePath} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-border last:border-0">
                        {r.map((c, k) => (
                          <td key={k} className="px-3 py-2 align-top">
                            <Inlines nodes={c} basePath={basePath} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'quote':
            return (
              <blockquote
                key={i}
                className="my-5 rounded-r-lg border-l-4 border-primary/60 bg-muted/30 px-4 py-1 [&>p]:my-2"
              >
                <DocRenderer blocks={b.c} basePath={basePath} />
              </blockquote>
            );
          case 'hr':
            return <hr key={i} className="my-8 border-border" />;
        }
      })}
    </div>
  );
}