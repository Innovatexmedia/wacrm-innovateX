'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ApiCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Creates an "API campaign": a broadcast row (kind = 'api', status
 * 'active') bound to one approved template. It has no audience — each
 * POST /api/v1/campaigns/{id}/send adds one recipient. After creating
 * it we open its detail page, which shows the endpoint and an example.
 */
export function ApiCampaignDialog({ open, onOpenChange }: ApiCampaignDialogProps) {
  const t = useTranslations('Broadcasts.apiCampaign');
  const router = useRouter();
  const { accountId } = useAuth();

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        // Only APPROVED templates can be sent via Meta.
        const { data, error } = await supabase
          .from('message_templates')
          .select('*')
          .eq('status', 'APPROVED')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setTemplates(data ?? []);

      } catch {
        if (!cancelled) toast.error(t('loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setName('');
    setTemplateId('');
  }

  async function handleCreate() {
    const template = templates.find((x) => x.id === templateId);
    if (!template || !name.trim()) return;

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error(t('toastNotSignedIn'));
      return;
    }
    if (!accountId) {
      toast.error(t('toastNotLinked'));
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('broadcasts')
      .insert({
        user_id: user.id,
        account_id: accountId,
        name: name.trim(),
        template_name: template.name,
        template_language: template.language ?? 'en_US',
        status: 'active',
        kind: 'api',
        total_recipients: 0,
      })
      .select('id')
      .single();
    setSaving(false);

    if (error || !data) {
      toast.error(t('toastFailed'));
      return;
    }
    toast.success(t('toastCreated'));
    reset();
    onOpenChange(false);
    router.push(`/broadcasts/${data.id}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-border bg-popover sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl text-popover-foreground">
            {t('dialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t('dialogDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="api-campaign-name">{t('nameLabel')}</Label>
            <Input
              id="api-campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-campaign-template">{t('templateLabel')}</Label>
            {loading ? (
              <div className="flex h-10 items-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noTemplates')}</p>
            ) : (
              <select
                id="api-campaign-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t('templatePlaceholder')}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            {t('apiKeyHint')}{' '}
            <Link
              href="/settings?tab=api"
              onClick={() => onOpenChange(false)}
              className="font-medium text-primary hover:underline"
            >
              {t('manageKeys')}
            </Link>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !name.trim() || !templateId}
            >
              {saving ? t('creating') : t('create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}