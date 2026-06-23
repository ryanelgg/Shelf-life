import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PantryItem } from '../types';
import { parseLocalDate, formatLocalDate } from '../types';
import * as debug from './debug';

// Publishes the "expiring soonest" snapshot into a shared App Group so the iOS
// home-screen / lock-screen widget can render it. The widget is a separate
// WidgetKit extension (see ios/WIDGET_SETUP.md) that reads the same App Group
// suite ("group.com.elghazzali.shelflife", key "pantreWidgetData").
//
// Everything here is a no-op off iOS — the native method simply isn't
// implemented on web/Android, so calls reject and are swallowed.

export const WIDGET_KEY = 'pantreWidgetData';

// Custom Capacitor plugin implemented in ios/App/App/PantreWidgetPlugin.swift.
interface PantreWidgetPlugin {
  setData(options: { value: string }): Promise<void>;
}
const PantreWidget = registerPlugin<PantreWidgetPlugin>('PantreWidget');

export interface WidgetItem {
  name: string;
  daysLeft: number;
  expirationDate: string;
}

export interface WidgetPayload {
  updatedAt: string;
  /** How many items expire within 3 days (incl. already expired). */
  expiringCount: number;
  /** Up to 3 soonest-expiring items. */
  items: WidgetItem[];
}

// Pure + deterministic so it can be unit-tested with an injected `now`.
export function buildWidgetPayload(items: PantryItem[], now: Date = new Date()): WidgetPayload {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const withDays = items.map(i => {
    const exp = parseLocalDate(i.expirationDate);
    const daysLeft = Math.round((exp.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    return { name: i.name, expirationDate: i.expirationDate, daysLeft };
  });
  withDays.sort((a, b) => a.daysLeft - b.daysLeft);
  return {
    updatedAt: formatLocalDate(now),
    expiringCount: withDays.filter(i => i.daysLeft <= 3).length,
    items: withDays.slice(0, 3),
  };
}

let lastSerialized = '';

export async function publishWidgetData(items: PantryItem[]): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return;
  const value = JSON.stringify(buildWidgetPayload(items));
  if (value === lastSerialized) return; // nothing changed — skip the native call
  lastSerialized = value;
  try {
    // Writes to the App Group suite and calls WidgetCenter.reloadAllTimelines().
    await PantreWidget.setData({ value });
  } catch (e) {
    debug.error('[widget] publish failed', e);
  }
}
