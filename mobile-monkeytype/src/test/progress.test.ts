import { describe, expect, it } from "vitest";
import type { RunResult, TestSettings } from "../types";
import { createInitialProgress, progressReducer, selectHistory, selectOverview, selectPersonalBest, selectStreak, variantKey } from "../progress";
import { LEGACY_HISTORY_KEY, PROGRESS_STORAGE_KEY, loadProgress } from "../progress/storage";
import { exportProgress, parseTransfer } from "../progress/transfer";

const settings: TestSettings = { mode: "time", duration: 30, wordCount: 25, quoteLength: "medium", punctuation: true, numbers: false, customText: "private" };
const run = (id: number, overrides: Partial<RunResult> = {}): RunResult => ({
  id, date: `2026-08-${String(id).padStart(2, "0")}T12:00:00.000Z`, device: "computer", settings, elapsedMs: 30_000,
  wpm: 50 + id, rawWpm: 55 + id, accuracy: 96, consistency: 90, correct: 125, incorrect: 2,
  extra: 1, missed: 0, fixes: 2, assisted: false, samples: [{ second: 1, wpm: 50, raw: 55, errors: 1 }],
  targetText: "secret target", typedText: "secret typed", inputHistory: [{ value: "secret", inputType: "insertText", at: 1 }], ...overrides,
});

describe("progress data layer", () => {
  it("records privacy-safe totals and a variant-scoped PB", () => {
    const state = progressReducer(createInitialProgress(), { type: "RECORD_RUN", run: run(1) });
    expect(state.runs[0]).not.toHaveProperty("inputHistory");
    expect(JSON.stringify(state)).not.toContain("secret");
    expect(selectOverview(state)).toMatchObject({ tests: 1, validTests: 1, typedChars: 128, averageWpm: 51 });
    expect(selectPersonalBest(state, settings)?.runId).toBe(1);
    expect(variantKey({ ...settings, mode: "custom" })).toBeNull();
  });

  it("excludes assisted runs from PBs but includes activity, and clear history preserves aggregates", () => {
    let state = progressReducer(createInitialProgress(), { type: "RECORD_RUN", run: run(1) });
    state = progressReducer(state, { type: "RECORD_RUN", run: run(2, { wpm: 200, assisted: true }) });
    expect(selectPersonalBest(state, settings)?.runId).toBe(1);
    expect(state.lifetime).toMatchObject({ tests: 2, validTests: 1 });
    state = progressReducer(state, { type: "CLEAR_RUN_HISTORY" });
    expect(selectHistory(state)).toEqual([]);
    expect(state.lifetime.tests).toBe(2);
    expect(progressReducer(state, { type: "RESET_ALL_PROGRESS", now: new Date("2026-09-01") }).lifetime.tests).toBe(0);
  });

  it("keeps the device on each stored run and merges imported runs", () => {
    const state = progressReducer(createInitialProgress(), { type: "RECORD_RUN", run: run(1, { device: "mobile" }) });
    const imported = progressReducer(createInitialProgress(), { type: "RECORD_RUN", run: run(2, { device: "computer" }) });
    const merged = progressReducer(state, { type: "IMPORT_PROGRESS", progress: imported });
    expect(merged.runs.map((item) => item.device)).toEqual(["computer", "mobile"]);
  });

  it("calculates today/yesterday streaks by calendar day", () => {
    let state = createInitialProgress();
    state = progressReducer(state, { type: "RECORD_RUN", run: run(10, { date: "2026-08-10T12:00:00" }) });
    state = progressReducer(state, { type: "RECORD_RUN", run: run(11, { date: "2026-08-11T12:00:00" }) });
    expect(selectStreak(state, new Date("2026-08-12T12:00:00"))).toEqual({ current: 2, best: 2 });
  });

  it("migrates only valid v1 records, saves v2 before deleting legacy, and strips private text", () => {
    const values = new Map<string, string>([[LEGACY_HISTORY_KEY, JSON.stringify([run(1), { broken: true }])]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const loaded = loadProgress(storage as Storage, new Date("2026-08-12"));
    expect(loaded.migrated).toBe(true);
    expect(loaded.state.runs).toHaveLength(1);
    expect(values.has(LEGACY_HISTORY_KEY)).toBe(false);
    expect(values.get(PROGRESS_STORAGE_KEY)).not.toContain("secret");
  });

  it("reports persistence failures and leaves legacy data intact", () => {
    const storage = { getItem: (key: string) => key === LEGACY_HISTORY_KEY ? JSON.stringify([run(1)]) : null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("must not delete"); } };
    const loaded = loadProgress(storage as unknown as Storage);
    expect(loaded.error).toMatchObject({ operation: "migrate", message: "quota" });
    expect(loaded.migrated).toBe(false);
  });

  it("round-trips Thumbtype JSON and reads Monkeytype CSV results", () => {
    const original = progressReducer(createInitialProgress(), { type: "RECORD_RUN", run: run(1, { device: "mobile" }) });
    const roundTrip = parseTransfer(exportProgress(original));
    expect(roundTrip.runs[0]).toMatchObject({ device: "mobile", wpm: 51 });

    const csv = [
      "wpm,accuracy,raw wpm,consistency,test mode,mode 2,test duration,timestamp,characters,device",
      "80,98,82,91,time,30,30,1735689600000,120/2/1/3,mobile",
    ].join("\n");
    const imported = parseTransfer(csv, new Date("2026-01-01T00:00:00.000Z"));
    expect(imported.runs[0]).toMatchObject({ device: "mobile", wpm: 80, accuracy: 98, settings: { mode: "time", duration: 30 } });
  });
});
