import { loadDoc } from '@/lib/docs/content';
import { DocPage, DocUnavailable } from '@/components/docs/doc-page';

export const metadata = { title: 'API Reference' };

export default function DocsHomePage() {
  const doc = loadDoc('reference');
  if (!doc) return <DocUnavailable />;
  return <DocPage doc={doc} basePath="/docs" crumbs={[{ label: 'Docs', href: '/docs' }, { label: 'API Reference' }]} />;
}