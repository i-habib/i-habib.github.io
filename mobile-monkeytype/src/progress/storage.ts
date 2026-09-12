import type { DeviceType, PaceSample, RunResult, TestSettings } from "../types";
import { createInitialProgress, progressReducer, recordSummary, summarizeRun } from "./reducer";
import { PROGRESS_VERSION, type LoadProgressResult, type ProgressPersistenceError, type ProgressState } from "./types";

export const PROGRESS_STORAGE_KEY = "thumbtype.progress.v2";
export const LEGACY_HISTORY_KEY = "thumbtype.react.history.v1";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const error = (operation: ProgressPersistenceError["operation"], cause: unknown): ProgressPersistenceError => ({
  operation,
  message: cause instanceof Error ? cause.message : String(cause),
  cause,
});
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function isProgressState(value: unknown): value is ProgressState {
  if (!object(value) || value.version !== PROGRESS_VERSION || !object(value.profile) || !Array.isArray(value.runs)
    || !object(value.details) || !object(value.lifetime) || !object(value.days) || !object(value.personalBests)) return false;
  return true;
}

function normalizeDevice(value: unknown): DeviceType {
  return value === "mobile" ? "mobile" : "computer";
}

export function normalizeProgressState(value: ProgressState): ProgressState {
  return {
    ...value,
    runs: value.runs.map((run) => ({ ...run, device: normalizeDevice(run.device) })),
  };
}

function parseState(value: unknown): ProgressState | null {
  return isProgressState(value) ? normalizeProgressState(value) : null;
}

function legacyRun(value: unknown): RunResult | null {
  if (!object(value) || !finite(value.id) || typeof value.date !== "string" || !object(value.settings)) return null;
  const settings = value.settings;
  const mode = settings.mode;
  if (!(["time", "words", "quote", "zen", "custom"] as unknown[]).includes(mode)) return null;
  const numeric = ["elapsedMs", "wpm", "rawWpm", "accuracy", "consistency", "correct", "incorrect", "extra", "missed", "fixes"] as const;
  if (numeric.some((key) => !finite(value[key]))) return null;
  const safeSettings: TestSettings = {
    mode: mode as TestSettings["mode"],
    duration: finite(settings.duration) ? settings.duration : 30,
    wordCount: finite(settings.wordCount) ? settings.wordCount : 25,
    quoteLength: (["short", "medium", "long"] as unknown[]).includes(settings.quoteLength) ? settings.quoteLength as TestSettings["quoteLength"] : "medium",
    punctuation: settings.punctuation === true,
    numbers: settings.numbers === true,
    customText: "",
  };
  const samples: PaceSample[] = Array.isArray(value.samples)
    ? value.samples.filter((sample): sample is PaceSample => object(sample) && finite(sample.second) && finite(sample.wpm) && finite(sample.raw) && finite(sample.errors))
    : [];
  return {
    id: value.id, date: value.date, settings: safeSettings,
    elapsedMs: value.elapsedMs as number, wpm: value.wpm as number, rawWpm: value.rawWpm as number,
    accuracy: value.accuracy as number, consistency: value.consistency as number,
    correct: value.correct as number, incorrect: value.incorrect as number, extra: value.extra as number,
    missed: value.missed as number, fixes: value.fixes as number, assisted: value.assisted === true,
    samples, targetText: "", typedText: "", inputHistory: [],
    device: normalizeDevice(value.device),
  };
}

export function saveProgress(storage: StorageLike, state: ProgressState): ProgressPersistenceError | null {
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch (cause) {
    return error("save", cause);
  }
}

export function loadProgress(storage: StorageLike, now = new Date()): LoadProgressResult {
  let raw: string | null;
  try { raw = storage.getItem(PROGRESS_STORAGE_KEY); } catch (cause) {
    return { state: createInitialProgress(now), error: error("load", cause), migrated: false };
  }
  if (raw !== null) {
    try {
      const state = parseState(JSON.parse(raw));
      return state ? { state, error: null, migrated: false } : { state: createInitialProgress(now), error: error("load", new Error("Invalid progress data")), migrated: false };
    } catch (cause) {
      return { state: createInitialProgress(now), error: error("load", cause), migrated: false };
    }
  }
  let legacyRaw: string | null;
  try { legacyRaw = storage.getItem(LEGACY_HISTORY_KEY); } catch (cause) {
    return { state: createInitialProgress(now), error: error("load", cause), migrated: false };
  }
  if (!legacyRaw) return { state: createInitialProgress(now), error: null, migrated: false };
  try {
    const parsed: unknown = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed)) throw new Error("Invalid legacy history");
    const valid = parsed.map(legacyRun).filter((run): run is RunResult => run !== null).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    let state = createInitialProgress(now);
    for (const run of valid) state = recordSummary(state, summarizeRun(run), run.samples);
    const saveError = saveProgress(storage, state);
    if (saveError) return { state, error: { ...saveError, operation: "migrate" }, migrated: false };
    storage.removeItem(LEGACY_HISTORY_KEY);
    return { state, error: null, migrated: true };
  } catch (cause) {
    return { state: createInitialProgress(now), error: error("migrate", cause), migrated: false };
  }
}

export function applyAndSave(storage: StorageLike, state: ProgressState, action: Parameters<typeof progressReducer>[1]) {
  const next = progressReducer(state, action);
  return { state: next, error: saveProgress(storage, next) };
}
