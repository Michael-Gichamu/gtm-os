/**
 * Send-window + jitter scheduling.
 *
 * Phase 2 treats all times in UTC. The campaign owner's send window
 * (sendWindowStart/End hours, 0-23) is interpreted in UTC; the worker:
 *
 *   1. If "now" is inside the window, schedule at now + jitter.
 *   2. If "now" is before the window, snap up to the window's start today.
 *   3. If "now" is past the window, snap to the window's start tomorrow.
 *
 * Jitter is uniform in [-jitterMinutes, +jitterMinutes] so two enrollments
 * advancing at the same nominal time don't fire in lockstep (matches the
 * marketer's "look human" intuition without anything fancier).
 *
 * Phase 3 will swap UTC for the lead's own timezone — the only change is
 * computing the start-of-day in their tz before adding the hour offset.
 */
export interface SendWindow {
  sendWindowStart: number; // hour 0-23 UTC
  sendWindowEnd: number;   // hour 0-23 UTC (exclusive)
  jitterMinutes: number;
}

function startOfHourUTC(d: Date, hour: number): Date {
  const x = new Date(d);
  x.setUTCHours(hour, 0, 0, 0);
  return x;
}

function jitter(rangeMinutes: number): number {
  if (rangeMinutes <= 0) return 0;
  // Uniform in [-r, +r], whole minutes
  return Math.floor((Math.random() * 2 - 1) * rangeMinutes) * 60_000;
}

/**
 * Compute when to fire a send given an earliest-eligible base time and the
 * campaign's window. base = max(now, lastSent + delayDays).
 */
export function scheduleSendAt(base: Date, window: SendWindow, now: Date = new Date()): Date {
  const startToday = startOfHourUTC(base, window.sendWindowStart);
  const endToday = startOfHourUTC(base, window.sendWindowEnd);
  const startTomorrow = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);

  let target: Date;
  if (base < startToday) {
    target = startToday;
  } else if (base >= endToday) {
    target = startTomorrow;
  } else {
    target = base;
  }

  const withJitter = new Date(target.getTime() + jitter(window.jitterMinutes));
  // Never schedule earlier than "now" — jitter could pull us slightly back.
  return withJitter < now ? now : withJitter;
}
