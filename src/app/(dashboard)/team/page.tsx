'use client';

import { MembersTab } from '@/components/settings/members-tab';

/**
 * Standalone top-level Team page — same situation as Templates.
 * MembersTab renders its own heading via SettingsPanelHead, so this
 * route is a thin wrapper only — no logic change, no duplicate title.
 */
export default function TeamPage() {
  return <MembersTab />;
}