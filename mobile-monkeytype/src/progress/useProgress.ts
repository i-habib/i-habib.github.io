import { useCallback, useRef, useState } from "react";
import type { RunResult } from "../types";
import { progressReducer } from "./reducer";
import { loadProgress, saveProgress } from "./storage";
import type { ProgressAction, ProgressPersistenceError, ProgressProfile, ProgressState } from "./types";

export function useProgress(storage: Storage = localStorage) {
  const loaded = useState(() => loadProgress(storage))[0];
  const [state, setState] = useState(loaded.state);
  const stateRef = useRef(loaded.state);
  const [persistenceError, setPersistenceError] = useState<ProgressPersistenceError | null>(loaded.error);
  const dispatch = useCallback((action: ProgressAction) => {
    const next = progressReducer(stateRef.current, action);
    stateRef.current = next;
    setState(next);
    setPersistenceError(saveProgress(storage, next));
  }, [storage]);
  return {
    state,
    progress: state,
    persistenceError,
    storageError: persistenceError?.message ?? null,
    migrated: loaded.migrated,
    clearPersistenceError: () => setPersistenceError(null),
    recordRun: (run: RunResult) => dispatch({ type: "RECORD_RUN", run }),
    importProgress: (progress: ProgressState) => dispatch({ type: "IMPORT_PROGRESS", progress }),
    setProfile: (profile: Partial<Pick<ProgressProfile, "displayName" | "dailyGoalTests">>) => dispatch({ type: "SET_PROFILE", profile }),
    clearRunHistory: () => dispatch({ type: "CLEAR_RUN_HISTORY" }),
    clearHistory: () => dispatch({ type: "CLEAR_RUN_HISTORY" }),
    resetAllProgress: () => dispatch({ type: "RESET_ALL_PROGRESS" }),
    resetAll: () => dispatch({ type: "RESET_ALL_PROGRESS" }),
  };
}
