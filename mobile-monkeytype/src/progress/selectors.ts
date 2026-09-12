import type { TestSettings } from "../types";
import { localDay, variantKey } from "./reducer";
import type { DayActivity, ProgressState, RunSummary } from "./types";

export function selectOverview(state: ProgressState) {
  const { lifetime } = state;
  return {
    ...lifetime,
    averageWpm: lifetime.validTests ? lifetime.wpmTotal / lifetime.validTests : 0,
    averageAccuracy: lifetime.validTests ? lifetime.accuracyTotal / lifetime.validTests : 0,
    averageConsistency: lifetime.validTests ? lifetime.consistencyTotal / lifetime.validTests : 0,
    fixesPerHundredWords: lifetime.typedChars ? lifetime.fixes / (lifetime.typedChars / 5) * 100 : 0,
  };
}

export function selectPersonalBest(state: ProgressState, settings: TestSettings) {
  const key = variantKey(settings);
  return key ? state.personalBests[key] ?? null : null;
}

const dayOrdinal = (day: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000) : NaN;
};

export function selectStreak(state: ProgressState, now = new Date()) {
  const active = new Set(Object.entries(state.days).filter(([, value]) => value.tests > 0).map(([day]) => dayOrdinal(day)));
  const today = dayOrdinal(localDay(now));
  let cursor = active.has(today) ? today : active.has(today - 1) ? today - 1 : NaN;
  let current = 0;
  while (active.has(cursor)) { current += 1; cursor -= 1; }
  const sorted = [...active].filter(Number.isFinite).sort((a, b) => a - b);
  let best = 0;
  let chain = 0;
  let previous = Number.NEGATIVE_INFINITY;
  for (const day of sorted) {
    chain = day === previous + 1 ? chain + 1 : 1;
    best = Math.max(best, chain);
    previous = day;
  }
  return { current, best };
}

export function selectTrend(state: ProgressState, now = new Date(), length = 30): Array<{ day: string; activity: DayActivity | null }> {
  const end = dayOrdinal(localDay(now));
  return Array.from({ length: Math.max(0, length) }, (_, index) => {
    const date = new Date((end - (length - index - 1)) * 86_400_000);
    const day = date.toISOString().slice(0, 10);
    return { day, activity: state.days[day] ?? null };
  });
}

export interface HistoryFilters {
  mode?: TestSettings["mode"];
  assisted?: boolean;
  limit?: number;
}

export function selectHistory(state: ProgressState, filters: HistoryFilters = {}): RunSummary[] {
  return state.runs
    .filter((run) => filters.mode === undefined || run.settings.mode === filters.mode)
    .filter((run) => filters.assisted === undefined || run.assisted === filters.assisted)
    .slice(0, filters.limit ?? state.runs.length);
}
