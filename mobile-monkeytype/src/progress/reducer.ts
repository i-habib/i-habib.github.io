import type { RunResult, TestSettings } from "../types";
import {
  MAX_RECENT_RUNS,
  MAX_RUN_DETAILS,
  PROGRESS_VERSION,
  type DayActivity,
  type LifetimeTotals,
  type ProgressAction,
  type ProgressState,
  type RunSummary,
  type StoredTestSettings,
} from "./types";

const emptyTotals = (): LifetimeTotals => ({
  tests: 0, validTests: 0, timeMs: 0, typedChars: 0, fixes: 0, wpmTotal: 0, accuracyTotal: 0, consistencyTotal: 0,
});

export function localDay(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(value.getTime())) return localDay(new Date());
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createInitialProgress(now = new Date()): ProgressState {
  return {
    version: PROGRESS_VERSION,
    profile: { displayName: "", createdAt: now.toISOString(), dailyGoalTests: 1 },
    runs: [], details: {}, lifetime: emptyTotals(), days: {}, personalBests: {},
  };
}

export function storedSettings(settings: TestSettings): StoredTestSettings {
  return {
    mode: settings.mode,
    duration: settings.duration,
    wordCount: settings.wordCount,
    quoteLength: settings.quoteLength,
    punctuation: settings.punctuation,
    numbers: settings.numbers,
  };
}

export function variantKey(settings: Pick<TestSettings, "mode" | "duration" | "wordCount" | "quoteLength" | "punctuation" | "numbers">): string | null {
  const flags = `p${settings.punctuation ? 1 : 0}:n${settings.numbers ? 1 : 0}`;
  switch (settings.mode) {
    case "time": return `time:${settings.duration}:${flags}`;
    case "words": return `words:${settings.wordCount}:${flags}`;
    case "quote": return `quote:${settings.quoteLength}:${flags}`;
    case "zen":
    case "custom":
      return null;
    default:
      return null;
  }
}

export function summarizeRun(run: RunResult): RunSummary {
  return {
    id: run.id,
    completedAt: run.date,
    localDay: localDay(run.date),
    device: run.device,
    settings: { ...storedSettings(run.settings), customText: "" },
    variantKey: variantKey(run.settings) ?? "",
    elapsedMs: run.elapsedMs,
    wpm: run.wpm,
    rawWpm: run.rawWpm,
    accuracy: run.accuracy,
    consistency: run.consistency,
    correct: run.correct,
    incorrect: run.incorrect,
    extra: run.extra,
    missed: run.missed,
    fixes: run.fixes,
    assisted: run.assisted,
  };
}

function addTotals(base: LifetimeTotals, run: RunSummary): LifetimeTotals {
  const valid = !run.assisted && run.variantKey !== "";
  return {
    tests: base.tests + 1,
    validTests: base.validTests + (valid ? 1 : 0),
    timeMs: base.timeMs + run.elapsedMs,
    typedChars: base.typedChars + run.correct + run.incorrect + run.extra,
    fixes: base.fixes + run.fixes,
    wpmTotal: base.wpmTotal + (valid ? run.wpm : 0),
    accuracyTotal: base.accuracyTotal + (valid ? run.accuracy : 0),
    consistencyTotal: base.consistencyTotal + (valid ? run.consistency : 0),
  };
}

export function recordSummary(state: ProgressState, run: RunSummary, samples: RunResult["samples"] = []): ProgressState {
  if (state.runs.some(({ id }) => id === run.id)) return state;
  const runs = [run, ...state.runs].slice(0, MAX_RECENT_RUNS);
  const detailIds = new Set(runs.slice(0, MAX_RUN_DETAILS).map(({ id }) => String(id)));
  const details = Object.fromEntries(
    Object.entries({ ...state.details, ...(samples.length ? { [String(run.id)]: samples } : {}) })
      .filter(([id]) => detailIds.has(id)),
  );
  const previousDay = state.days[run.localDay] ?? { tests: 0, validTests: 0, timeMs: 0, typedChars: 0, fixes: 0, bestWpm: 0, wpmTotal: 0, accuracyTotal: 0, consistencyTotal: 0 };
  const valid = !run.assisted && run.variantKey !== "";
  const day: DayActivity = {
    tests: previousDay.tests + 1,
    validTests: previousDay.validTests + (valid ? 1 : 0),
    timeMs: previousDay.timeMs + run.elapsedMs,
    typedChars: previousDay.typedChars + run.correct + run.incorrect + run.extra,
    fixes: previousDay.fixes + run.fixes,
    wpmTotal: (previousDay.wpmTotal ?? 0) + (valid ? run.wpm : 0),
    accuracyTotal: (previousDay.accuracyTotal ?? 0) + (valid ? run.accuracy : 0),
    consistencyTotal: (previousDay.consistencyTotal ?? 0) + (valid ? run.consistency : 0),
    bestWpm: valid ? Math.max(previousDay.bestWpm, run.wpm) : previousDay.bestWpm,
  };
  const personalBests = { ...state.personalBests };
  if (!run.assisted && run.variantKey) {
    const current = personalBests[run.variantKey];
    if (!current || run.wpm > current.wpm || (run.wpm === current.wpm && run.accuracy > current.accuracy)) {
      personalBests[run.variantKey] = { runId: run.id, variantKey: run.variantKey, wpm: run.wpm, accuracy: run.accuracy, achievedAt: run.completedAt, settings: run.settings };
    }
  }
  return {
    ...state,
    runs,
    details,
    lifetime: addTotals(state.lifetime, run),
    days: { ...state.days, [run.localDay]: day },
    personalBests,
  };
}

export function mergeProgress(state: ProgressState, imported: ProgressState): ProgressState {
  return imported.runs
    .slice()
    .reverse()
    .reduce(
      (next, run) => recordSummary(next, run, imported.details[String(run.id)] ?? []),
      state,
    );
}

export function progressReducer(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case "RECORD_RUN": return recordSummary(state, summarizeRun(action.run), action.run.samples);
    case "IMPORT_PROGRESS": return mergeProgress(state, action.progress);
    case "SET_PROFILE": return {
      ...state,
      profile: {
        ...state.profile,
        ...(typeof action.profile.displayName === "string" ? { displayName: action.profile.displayName.slice(0, 80) } : {}),
        ...(Number.isInteger(action.profile.dailyGoalTests) && (action.profile.dailyGoalTests ?? 0) > 0
          ? { dailyGoalTests: action.profile.dailyGoalTests as number } : {}),
      },
    };
    case "CLEAR_RUN_HISTORY": return { ...state, runs: [], details: {} };
    case "RESET_ALL_PROGRESS": return createInitialProgress(action.now);
  }
}
