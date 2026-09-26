import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';

import type { LoadedDoc } from '@/lib/docs/content';
import { DocRenderer } from '@/components/docs/doc-renderer';
import { OnThisPage } from '@/components/docs/on-this-page';

export interface Crumb {
  label: string;
  href?: string;
}

/** Article + "On this page" rail for one loaded doc. */
export function DocPage({
  doc,
  basePath,
  crumbs,
}: {
  doc: LoadedDoc;
  basePath: string;
  crumbs: Crumb[];
}) {
  return (
    <div className="flex gap-10 px-4 py-8 lg:px-10">
      <article className="min-w-0 max-w-3xl flex-1 pb-24">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5" />}
              {c.href ? (
                <Link href={c.href} className="hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <DocRenderer blocks={doc.blocks} basePath={basePath} />
      </article>
      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-8">
          <OnThisPage toc={doc.toc} />
        </div>
      </aside>
    </div>
  );
}

export function DocUnavailable() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <AlertTriangle className="mx-auto size-8 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold text-foreground">Documentation unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page could not be loaded. Try again in a moment.
      </p>
      <Link href="/docs" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Back to API Reference
      </Link>
    </div>
  );
}