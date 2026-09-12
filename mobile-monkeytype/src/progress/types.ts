import type { DeviceType, PaceSample, RunResult, TestSettings } from "../types";

export const PROGRESS_VERSION = 2 as const;
export const MAX_RECENT_RUNS = 500;
export const MAX_RUN_DETAILS = 20;

export interface StoredTestSettings {
  mode: TestSettings["mode"];
  duration: number;
  wordCount: number;
  quoteLength: TestSettings["quoteLength"];
  punctuation: boolean;
  numbers: boolean;
}

export interface RunSummary {
  id: number;
  completedAt: string;
  localDay: string;
  device: DeviceType;
  settings: TestSettings;
  /** Empty for non-comparable zen/custom runs. */
  variantKey: string;
  elapsedMs: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  fixes: number;
  assisted: boolean;
}

export interface LifetimeTotals {
  tests: number;
  validTests: number;
  timeMs: number;
  typedChars: number;
  fixes: number;
  wpmTotal: number;
  accuracyTotal: number;
  consistencyTotal: number;
}

export interface DayActivity {
  tests: number;
  validTests: number;
  timeMs: number;
  typedChars: number;
  fixes: number;
  bestWpm: number;
  wpmTotal?: number;
  accuracyTotal?: number;
  consistencyTotal?: number;
}

export interface PersonalBest {
  runId: number;
  variantKey: string;
  wpm: number;
  accuracy: number;
  achievedAt: string;
  settings: TestSettings;
}

export interface ProgressProfile {
  displayName?: string;
  createdAt: string;
  dailyGoalTests: number;
}

export interface ProgressOverview {
  tests: number;
  validTests: number;
  timeMs: number;
  typedChars: number;
  fixes: number;
  averageWpm: number;
  averageAccuracy: number;
  averageConsistency: number;
  fixesPerHundredWords: number;
}

export interface StreakSummary { current: number; best: number }

export interface ProgressState {
  version: typeof PROGRESS_VERSION;
  profile: ProgressProfile;
  runs: RunSummary[];
  details: Record<string, PaceSample[]>;
  lifetime: LifetimeTotals;
  days: Record<string, DayActivity>;
  personalBests: Record<string, PersonalBest>;
}

export type ProgressStore = ProgressState;

export type ProgressAction =
  | { type: "RECORD_RUN"; run: RunResult }
  | { type: "IMPORT_PROGRESS"; progress: ProgressState }
  | { type: "SET_PROFILE"; profile: Partial<Pick<ProgressProfile, "displayName" | "dailyGoalTests">> }
  | { type: "CLEAR_RUN_HISTORY" }
  | { type: "RESET_ALL_PROGRESS"; now?: Date };

export interface ProgressPersistenceError {
  operation: "load" | "save" | "migrate";
  message: string;
  cause?: unknown;
}

export interface LoadProgressResult {
  state: ProgressState;
  error: ProgressPersistenceError | null;
  migrated: boolean;
}
