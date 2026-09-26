import type { Metadata } from 'next';

import { loadNav } from '@/lib/docs/content';
import { DocsShell } from '@/components/docs/docs-shell';

// Docs are for signed-in users only (see middleware) — keep them out of
// search indexes as well.
export const metadata: Metadata = {
  title: { default: 'Docs — InnovateX CRM', template: '%s — InnovateX Docs' },
  robots: { index: false, follow: false },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell nav={loadNav()}>{children}</DocsShell>;
}