import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { RunResult } from "../types";
import { supabase } from "../lib/supabase";
import type { ProgressState } from "./types";
import { deleteCloudRuns, saveCloudRun, syncProgress } from "./cloud";

export type CloudStatus = "local" | "syncing" | "synced" | "error";

export function useCloudProgress(user: User | null, progress: ProgressState, importProgress: (state: ProgressState) => ProgressState) {
  const [status, setStatus] = useState<CloudStatus>(user && supabase ? "syncing" : "local");
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  const syncNow = useCallback(async (snapshot: ProgressState = progress) => {
    if (!supabase || !userId) {
      setStatus("local");
      return null;
    }
    setStatus("syncing");
    setError(null);
    let result;
    try {
      result = await syncProgress(supabase, userId, snapshot);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not reach Supabase.";
      setStatus("error");
      setError(message);
      return { progress: snapshot, error: message, uploaded: 0 };
    }
    if (result.error) {
      setStatus("error");
      setError(result.error);
      return result;
    }
    setStatus("synced");
    importProgress(result.progress);
    return result;
  }, [importProgress, progress, userId]);

  useEffect(() => {
    if (!userId || !supabase) {
      setStatus("local");
      setError(null);
      return;
    }
    void syncNow(progress);
  }, [userId]);

  const saveRun = useCallback(async (run: RunResult) => {
    if (!supabase || !userId) return;
    let message: string | null;
    try {
      message = await saveCloudRun(supabase, userId, run);
    } catch (cause) {
      message = cause instanceof Error ? cause.message : "Could not reach Supabase.";
    }
    if (message) {
      setStatus("error");
      setError(message);
    } else {
      setStatus("synced");
    }
  }, [userId]);

  const clearRemote = useCallback(async () => {
    if (!supabase || !userId) return;
    let message: string | null;
    try {
      message = await deleteCloudRuns(supabase, userId);
    } catch (cause) {
      message = cause instanceof Error ? cause.message : "Could not reach Supabase.";
    }
    if (message) {
      setStatus("error");
      setError(message);
    } else {
      setStatus("synced");
    }
  }, [userId]);

  return { status, error, syncNow, saveRun, clearRemote };
}
