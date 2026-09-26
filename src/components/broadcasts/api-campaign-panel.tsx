'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { CopyButton } from '@/components/docs/code-block';

/**
 * Shown on the detail page of an API campaign: the endpoint that sends
 * this campaign's template to one contact per request, plus links into
 * the developer docs, where the full request/response reference, the
 * error codes and copy-paste examples live. The API key itself is
 * created and managed in Settings → API keys.
 */
export function ApiCampaignPanel({ campaignId }: { campaignId: string }) {
  const t = useTranslations('Broadcasts.apiCampaign');
  const path = `/api/v1/campaigns/${campaignId}/send`;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{t('panelTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('panelDesc')}</p>
        </div>
        <Link
          href={`/docs/api-campaigns/${campaignId}`}
          className="inline-flex shrink-0 items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('integration')}
        </Link>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t('endpointLabel')}</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
            POST {path}
          </code>
          <CopyButton text={path} label={t('copy')} />
        </div>
      </div>
    </div>
  );
}