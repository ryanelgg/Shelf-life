import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { MealPlanDay } from '../types';

// Maps the meal-plan day labels to JS weekday numbers (0 = Sunday … 6 = Saturday).
const DAY_TO_WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// The next date (today or within the next 6 days) that falls on `weekday`, so a
// plan always lands in the upcoming week.
function nextDateForWeekday(weekday: number): Date {
  const d = new Date();
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  d.setHours(18, 0, 0, 0); // dinner — 6pm local
  return d;
}

// Floating local date-time, e.g. 20260615T180000 (no Z = calendar app uses local).
function icsLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

function icsEscape(text: string): string {
  return text.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

function buildIcs(plan: MealPlanDay[]): string {
  const stamp = icsLocal(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pantre//Meal Plan//EN',
    'CALSCALE:GREGORIAN',
  ];
  plan.forEach((day, i) => {
    const weekday = DAY_TO_WEEKDAY[day.day];
    if (weekday === undefined || !day.meal) return;
    const start = nextDateForWeekday(weekday);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1-hour block
    lines.push(
      'BEGIN:VEVENT',
      `UID:pantre-${icsLocal(start)}-${i}@usepantre.me`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsLocal(start)}`,
      `DTEND:${icsLocal(end)}`,
      `SUMMARY:${icsEscape(`🥑 ${day.meal}`)}`,
      `DESCRIPTION:${icsEscape(day.toBuy > 0 ? `${day.toBuy} ingredient(s) to buy` : 'Everything\'s in your pantry')}`,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  // iCalendar requires CRLF line endings.
  return lines.join('\r\n');
}

/** Builds an .ics from the meal plan and hands it to the OS (share sheet / download). */
export async function exportMealPlanToCalendar(plan: MealPlanDay[]): Promise<void> {
  const ics = buildIcs(plan);
  const filename = 'pantre-meal-plan.ics';

  if (Capacitor.isNativePlatform()) {
    const writeRes = await Filesystem.writeFile({
      path: filename,
      data: ics,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'Pantre meal plan',
      text: 'Add your week of meals to your calendar.',
      url: writeRes.uri,
      dialogTitle: 'Add to calendar',
    });
  } else {
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
