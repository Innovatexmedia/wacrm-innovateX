'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the id of the heading currently near the top of the viewport
 * (or the one the URL hash points at). `ids` must be in document order.
 */
export function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = list.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      // Count a heading as "current" once it is in the upper part of the
      // viewport, below the sticky top bar.
      { rootMargin: '-80px 0px -70% 0px' },
    );
    for (const id of list) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    const onHash = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (h && list.includes(h)) setActive(h);
    };
    const initial = setTimeout(onHash, 0);
    window.addEventListener('hashchange', onHash);
    return () => {
      clearTimeout(initial);
      observer.disconnect();
      window.removeEventListener('hashchange', onHash);
    };
  }, [key]);

  return active;
}