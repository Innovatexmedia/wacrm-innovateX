'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Zap, CalendarClock, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface NewCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which entry the user picked — the builder locks to this mode for
   *  the rest of the flow (no toggle inside it), but this component
   *  carries no send/schedule logic of its own; onChoose just tells
   *  the caller which option was picked so it can navigate into the
   *  same wizard, already in that mode. */
  onChoose: (mode: 'now' | 'schedule') => void;
}

/**
 * Pure UI — a campaign-type selection screen shown before entering
 * the existing broadcast wizard (src/app/(dashboard)/broadcasts/new/
 * page.tsx). Wider, SaaS-style version: side-by-side cards, fixed
 * (non-theme-accent) colors so "Send now" never reads as a red/
 * destructive action regardless of the account's chosen accent color.
 */
export function NewCampaignModal({ open, onOpenChange, onChoose }: NewCampaignModalProps) {
  const t = useTranslations('Broadcasts.newCampaignModal');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover sm:max-w-[740px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-popover-foreground">{t('title')}</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
          <OptionCard
            icon={<Zap className="h-7 w-7" />}
            iconWrapClassName="bg-emerald-500/10 text-emerald-400"
            title={t('sendNowTitle')}
            description={t('sendNowDesc')}
            badge={t('sendNowBadge')}
            badgeClassName="bg-emerald-500/10 text-emerald-400"
            onClick={() => onChoose('now')}
          />
          <OptionCard
            icon={<CalendarClock className="h-7 w-7" />}
            iconWrapClassName="bg-blue-500/10 text-blue-400"
            title={t('scheduleTitle')}
            description={t('scheduleDesc')}
            badge={t('scheduleBadge')}
            badgeClassName="bg-blue-500/10 text-blue-400"
            onClick={() => onChoose('schedule')}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OptionCard({
  icon,
  iconWrapClassName,
  title,
  description,
  badge,
  badgeClassName,
  onClick,
}: {
  icon: React.ReactNode;
  iconWrapClassName: string;
  title: string;
  description: string;
  badge: string;
  badgeClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-4 rounded-2xl border border-border bg-card/50 p-6 text-left transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
    >
      <div className="flex w-full items-start justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${iconWrapClassName}`}>
          {icon}
        </div>
        <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>

      <div>
        <span
          className={`mb-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClassName}`}
        >
          {badge}
        </span>
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}