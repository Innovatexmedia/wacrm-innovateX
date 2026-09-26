'use client';

import type { TocItem } from '@/lib/docs/markdown';
import { useActiveHeading } from '@/components/docs/use-active-heading';
import { cn } from '@/lib/utils';

export function OnThisPage({ toc }: { toc: TocItem[] }) {
  const active = useActiveHeading(toc.map((t) => t.id));
  if (toc.length === 0) return null;
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1.5 border-l border-border">
        {toc.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className={cn(
                '-ml-px block border-l py-0.5 transition-colors',
                t.level === 3 ? 'pl-6' : 'pl-3',
                active === t.id
                  ? 'border-primary font-medium text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}