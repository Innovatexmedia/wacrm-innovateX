import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { loadDoc } from '@/lib/docs/content';
import { getOrigin } from '@/lib/docs/origin';
import { DocPage, DocUnavailable } from '@/components/docs/doc-page';

export const metadata = { title: 'API Campaign integration' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Values are interpolated into Markdown — strip characters it treats
// as syntax so a campaign name can't alter the page structure.
const safe = (s: string) => s.replace(/[`*_[\]<>#|]/g, '').trim();

export default async function CampaignIntegrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // RLS scopes this to the signed-in user's account.
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from('broadcasts')
    .select('id, name, template_name, template_language')
    .eq('id', id)
    .eq('kind', 'api')
    .maybeSingle();
  if (!campaign) notFound();

  const doc = loadDoc('api-campaigns', {
    __ORIGIN__: await getOrigin(),
    __CAMPAIGN_ID__: id,
    __CAMPAIGN_INTRO__: `> **Campaign:** ${safe(campaign.name)} · **Template:** \`${safe(campaign.template_name)}\` (${safe(campaign.template_language)})`,
  });
  if (!doc) return <DocUnavailable />;

  return (
    <DocPage
      doc={doc}
      basePath={`/docs/api-campaigns/${id}`}
      crumbs={[
        { label: 'Docs', href: '/docs' },
        { label: 'API Campaigns', href: '/docs/api-campaigns' },
        { label: safe(campaign.name) },
      ]}
    />
  );
}