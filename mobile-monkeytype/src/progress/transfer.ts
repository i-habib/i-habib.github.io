import type { DeviceType, RunResult, TestMode, TestSettings } from "../types";
import { createInitialProgress, recordSummary, summarizeRun } from "./reducer";
import { isProgressState, normalizeProgressState } from "./storage";
import type { ProgressState } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const number = (value: string | undefined, fallback = 0) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function exportProgress(progress: ProgressState): string {
  return JSON.stringify({
    app: "thumbtype",
    format: "progress",
    version: 1,
    exportedAt: new Date().toISOString(),
    progress,
  }, null, 2);
}

export function downloadProgress(progress: ProgressState) {
  const blob = new Blob([exportProgress(progress)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `thumbtype-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);

  const headers = (rows.shift() ?? []).map(normalizeHeader);
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function field(row: Record<string, string>, ...names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return undefined;
}

function booleanField(row: Record<string, string>, ...names: string[]) {
  return /^(true|1|yes|on)$/i.test(field(row, ...names) ?? "");
}

function parseDate(value: string | undefined, index: number) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
  }
  const parsed = value ? new Date(value) : new Date();
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(Date.now() + index);
}

function parseDevice(value: string | undefined): DeviceType {
  return /mobile|phone|tablet|android|iphone|ipad/i.test(value ?? "") ? "mobile" : "computer";
}

function parseMode(row: Record<string, string>): { mode: TestMode; amount: number } {
  const label = (field(row, "test mode", "mode") ?? "time").toLowerCase();
  const embeddedAmount = Number(label.match(/\d+/)?.[0] ?? "");
  const separateAmount = number(field(row, "mode 2", "mode2", "duration", "test duration"), 0);
  const amount = separateAmount || embeddedAmount || 30;
  if (label.includes("word")) return { mode: "words", amount };
  if (label.includes("quote")) return { mode: "quote", amount: 0 };
  if (label.includes("zen")) return { mode: "zen", amount: 0 };
  if (label.includes("custom")) return { mode: "custom", amount: 0 };
  return { mode: "time", amount };
}

function parseCharacters(value: string | undefined) {
  const [correct, incorrect, extra, missed] = (value ?? "").split(/[/:]/).map((part) => number(part, 0));
  return { correct, incorrect, extra, missed };
}

function monkeytypeRun(row: Record<string, string>, index: number): RunResult | null {
  const wpm = number(field(row, "wpm"), NaN);
  if (!Number.isFinite(wpm)) return null;
  const date = parseDate(field(row, "timestamp", "date", "completed at"), index);
  const mode = parseMode(row);
  const characters = parseCharacters(field(row, "characters", "char stats", "chars"));
  const settings: TestSettings = {
    mode: mode.mode,
    duration: mode.mode === "time" ? mode.amount : 30,
    wordCount: mode.mode === "words" ? mode.amount : 25,
    quoteLength: "medium",
    punctuation: booleanField(row, "punctuation"),
    numbers: booleanField(row, "numbers"),
    customText: "",
  };
  return {
    id: Math.max(1, date.getTime() + index),
    date: date.toISOString(),
    device: parseDevice(field(row, "device", "platform")),
    settings,
    elapsedMs: Math.max(100, number(field(row, "test duration", "duration"), settings.duration) * 1000),
    wpm: Math.round(wpm),
    rawWpm: Math.round(number(field(row, "raw wpm", "raw"), wpm)),
    accuracy: Math.round(number(field(row, "accuracy", "acc"), 0)),
    consistency: Math.round(number(field(row, "consistency"), 0)),
    ...characters,
    fixes: 0,
    assisted: false,
    samples: [],
    targetText: "",
    typedText: "",
    inputHistory: [],
  };
}

function progressFromRuns(runs: RunResult[], now: Date): ProgressState {
  return runs
    .slice()
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
    .reduce((state, run) => recordSummary(state, summarizeRun(run), run.samples), createInitialProgress(now));
}

export function parseTransfer(text: string, now = new Date()): ProgressState {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (!trimmed) throw new Error("The selected file is empty.");

  if (trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    const candidate = isObject(parsed) && isProgressState(parsed.progress) ? parsed.progress : parsed;
    if (!isProgressState(candidate)) throw new Error("This JSON file is not a Thumbtype progress export.");
    return normalizeProgressState(candidate);
  }

  const runs = parseCsv(trimmed)
    .map(monkeytypeRun)
    .filter((run): run is RunResult => run !== null);
  if (!runs.length) throw new Error("No typing results were found. Use a Thumbtype JSON export or a Monkeytype CSV export.");
  return progressFromRuns(runs, now);
}
