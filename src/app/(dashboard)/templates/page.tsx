'use client';

import { TemplateManager } from '@/components/settings/template-manager';

/**
 * Standalone top-level Templates page — this used to be a Settings
 * tab (?tab=templates), but the settings page's tab list
 * (settings-sections.ts) no longer includes it. TemplateManager
 * renders its own heading via SettingsPanelHead, so this route is a
 * thin wrapper only — no logic change, no duplicate title.
 */
export default function TemplatesPage() {
  return <TemplateManager />;
}