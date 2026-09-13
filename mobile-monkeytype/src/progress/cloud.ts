import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunResult } from "../types";
import { createInitialProgress, mergeProgress, recordSummary, runClientId, summarizeRun, variantKey } from "./reducer";
import type { ProgressState, RunSummary } from "./types";

export const CLOUD_RUNS_TABLE = "typing_runs";

interface CloudRunRow {
  user_id: string;
  client_id: string;
  completed_at: string;
  device: "computer" | "mobile";
  mode: "time" | "words" | "quote" | "zen" | "custom";
  duration: number;
  word_count: number;
  quote_length: "short" | "medium" | "long";
  punctuation: boolean;
  numbers: boolean;
  variant_key: string;
  elapsed_ms: number;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  consistency: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  fixes: number;
  assisted: boolean;
  samples: unknown;
}

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toCloudRun(userId: string, run: RunSummary, samples: unknown[] = []): CloudRunRow {
  return {
    user_id: userId,
    client_id: run.clientId,
    completed_at: run.completedAt,
    device: run.device,
    mode: run.settings.mode,
    duration: run.settings.duration,
    word_count: run.settings.wordCount,
    quote_length: run.settings.quoteLength,
    punctuation: run.settings.punctuation,
    numbers: run.settings.numbers,
    variant_key: run.variantKey,
    elapsed_ms: run.elapsedMs,
    wpm: run.wpm,
    raw_wpm: run.rawWpm,
    accuracy: run.accuracy,
    consistency: run.consistency,
    correct: run.correct,
    incorrect: run.incorrect,
    extra: run.extra,
    missed: run.missed,
    fixes: run.fixes,
    assisted: run.assisted,
    samples,
  };
}

function fromCloudRun(row: CloudRunRow): RunSummary {
  const settings = {
    mode: row.mode,
    duration: finite(row.duration, 30),
    wordCount: finite(row.word_count, 25),
    quoteLength: row.quote_length,
    punctuation: row.punctuation === true,
    numbers: row.numbers === true,
    customText: "",
  } as const;
  return {
    id: Date.parse(row.completed_at) || Date.now(),
    clientId: row.client_id,
    completedAt: row.completed_at,
    localDay: row.completed_at.slice(0, 10),
    device: row.device === "mobile" ? "mobile" : "computer",
    settings,
    variantKey: row.variant_key || variantKey(settings) || "",
    elapsedMs: finite(row.elapsed_ms),
    wpm: finite(row.wpm),
    rawWpm: finite(row.raw_wpm),
    accuracy: finite(row.accuracy),
    consistency: finite(row.consistency),
    correct: finite(row.correct),
    incorrect: finite(row.incorrect),
    extra: finite(row.extra),
    missed: finite(row.missed),
    fixes: finite(row.fixes),
    assisted: row.assisted === true,
  };
}

function samplesFromCloud(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export interface CloudSyncResult {
  progress: ProgressState;
  error: string | null;
  uploaded: number;
}

export async function syncProgress(client: SupabaseClient, userId: string, progress: ProgressState): Promise<CloudSyncResult> {
  const rows = progress.runs.map((run) => toCloudRun(userId, run, progress.details[run.clientId] ?? progress.details[String(run.id)] ?? []));
  if (rows.length) {
    const { error } = await client.from(CLOUD_RUNS_TABLE).upsert(rows, { onConflict: "user_id,client_id" });
    if (error) return { progress, error: error.message, uploaded: 0 };
  }

  const { data, error } = await client
    .from(CLOUD_RUNS_TABLE)
    .select("user_id,client_id,completed_at,device,mode,duration,word_count,quote_length,punctuation,numbers,variant_key,elapsed_ms,wpm,raw_wpm,accuracy,consistency,correct,incorrect,extra,missed,fixes,assisted,samples")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(500);
  if (error) return { progress, error: error.message, uploaded: rows.length };

  let remote = createInitialProgress();
  for (const row of (data ?? []) as CloudRunRow[]) remote = recordSummary(remote, fromCloudRun(row), samplesFromCloud(row.samples) as RunResult["samples"]);
  return { progress: mergeProgress(progress, remote), error: null, uploaded: rows.length };
}

export async function saveCloudRun(client: SupabaseClient, userId: string, run: RunResult) {
  const summary = summarizeRun(run);
  const { error } = await client.from(CLOUD_RUNS_TABLE).upsert(
    toCloudRun(userId, summary, run.samples),
    { onConflict: "user_id,client_id" },
  );
  return error?.message ?? null;
}

export async function deleteCloudRuns(client: SupabaseClient, userId: string) {
  const { error } = await client.from(CLOUD_RUNS_TABLE).delete().eq("user_id", userId);
  return error?.message ?? null;
}

export function stableRunId(run: RunResult) {
  return run.clientId ?? runClientId(run);
}
