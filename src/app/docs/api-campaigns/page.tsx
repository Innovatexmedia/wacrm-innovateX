import { loadDoc } from '@/lib/docs/content';
import { getOrigin } from '@/lib/docs/origin';
import { DocPage, DocUnavailable } from '@/components/docs/doc-page';

export const metadata = { title: 'API Campaigns' };

export default async function ApiCampaignsDocsPage() {
  const doc = loadDoc('api-campaigns', {
    __ORIGIN__: await getOrigin(),
    __CAMPAIGN_ID__: 'YOUR_CAMPAIGN_ID',
    __CAMPAIGN_INTRO__: '',
  });
  if (!doc) return <DocUnavailable />;
  return (
    <DocPage
      doc={doc}
      basePath="/docs/api-campaigns"
      crumbs={[{ label: 'Docs', href: '/docs' }, { label: 'API Campaigns' }]}
    />
  );
}