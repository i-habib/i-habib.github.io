import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateConsistency,
  alignTypedToTarget,
  calculateFreeTypingMetrics,
  calculateSessionMetrics,
  calculateMetricsFromAlignment,
  detectHelpfulReplacement,
  normalizeForScoring,
  toGraphemes,
} from "../engine";
import type { FixRecord, PaceSample, RunResult, SessionPhase, TestSettings } from "../types";

interface UseTypingSessionOptions {
  target: string;
  settings: TestSettings;
  runId: number;
  onComplete: (result: RunResult) => void;
}

interface SelectionSnapshot {
  start: number;
  end: number;
}

export function useTypingSession({ target, settings, runId, onComplete }: UseTypingSessionOptions) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const targetRef = useRef(target);
  const settingsRef = useRef(settings);
  const completeRef = useRef(onComplete);
  const phaseRef = useRef<SessionPhase>("ready");
  const valueRef = useRef("");
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const composingRef = useRef(false);
  const selectionRef = useRef<SelectionSnapshot>({ start: 0, end: 0 });
  const hiddenAtRef = useRef<number | null>(null);
  const finalizingRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const resultTimerRef = useRef<number | null>(null);
  const compositionSuppressionTimerRef = useRef<number | null>(null);
  const generationRef = useRef(runId);
  const suppressCompositionCommitRef = useRef(false);
  const fixesRef = useRef<FixRecord[]>([]);
  const samplesRef = useRef<PaceSample[]>([]);
  const historyRef = useRef<Array<{ value: string; inputType: string; at: number }>>([]);
  const assistedRef = useRef(false);
  const lastSampleSecondRef = useRef(-1);

  const [phase, setPhaseState] = useState<SessionPhase>("ready");
  const [value, setValue] = useState("");
  const [elapsed, setElapsedState] = useState(0);
  const [fixes, setFixes] = useState<FixRecord[]>([]);
  const [assisted, setAssisted] = useState(false);
  const [selectionEnd, setSelectionEnd] = useState(0);

  targetRef.current = target;
  settingsRef.current = settings;
  completeRef.current = onComplete;

  const setPhase = useCallback((next: SessionPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const setElapsed = useCallback((next: number) => {
    elapsedRef.current = next;
    setElapsedState(next);
  }, []);

  const recordSample = useCallback((now: number) => {
    const second = Math.floor(now / 1000);
    if (second <= lastSampleSecondRef.current) return;
    lastSampleSecondRef.current = second;
    const metric = calculateSessionMetrics(
      valueRef.current,
      targetRef.current,
      Math.max(now, 100),
      settingsRef.current.mode,
    );
    samplesRef.current.push({
      second,
      wpm: Math.round(metric.wpm),
      raw: Math.round(metric.rawWpm),
      errors: metric.errors,
    });
  }, []);

  const start = useCallback(() => {
    if (startedAtRef.current != null || finalizingRef.current) return;
    startedAtRef.current = performance.now();
    setElapsed(0);
    setPhase("running");
    recordSample(0);
  }, [recordSample, setElapsed, setPhase]);

  const finishNow = useCallback(() => {
    if (finalizingRef.current || startedAtRef.current == null) return;
    finalizingRef.current = true;
    const generation = generationRef.current;
    const configuredMs = settingsRef.current.mode === "time" ? settingsRef.current.duration * 1000 : Number.POSITIVE_INFINITY;
    const elapsedMs = Math.max(100, Math.min(configuredMs, performance.now() - startedAtRef.current));
    setElapsed(elapsedMs);
    const input = inputRef.current;
    input?.blur();
    if (resultTimerRef.current != null) window.clearTimeout(resultTimerRef.current);
    resultTimerRef.current = window.setTimeout(() => {
      resultTimerRef.current = null;
      if (generation !== generationRef.current) return;
      const settledValue = input?.value ?? valueRef.current;
      if (settledValue !== valueRef.current) {
        valueRef.current = settledValue;
        setValue(settledValue);
      }
      recordSample(elapsedMs);
      const metrics = calculateSessionMetrics(
        valueRef.current,
        targetRef.current,
        elapsedMs,
        settingsRef.current.mode,
      );
      const result: RunResult = {
        id: Date.now(),
        date: new Date().toISOString(),
        device: "computer",
        settings: { ...settingsRef.current },
        elapsedMs: Math.round(elapsedMs),
        wpm: Math.round(metrics.wpm),
        rawWpm: Math.round(metrics.rawWpm),
        accuracy: Math.round(metrics.accuracy),
        consistency: Math.round(calculateConsistency(samplesRef.current)),
        correct: metrics.correct,
        incorrect: metrics.incorrect,
        extra: metrics.extra,
        missed: metrics.missed,
        fixes: fixesRef.current.length,
        assisted: assistedRef.current,
        samples: [...samplesRef.current],
        targetText: targetRef.current,
        typedText: valueRef.current,
        inputHistory: [...historyRef.current],
      };
      completeRef.current(result);
    }, 0);
  }, [recordSample, setElapsed]);

  const requestFinish = useCallback(() => {
    if (finalizingRef.current || startedAtRef.current == null) return;
    if (composingRef.current) {
      setPhase("settling");
      const generation = generationRef.current;
      if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(() => {
        if (generation === generationRef.current) finishNow();
      }, 300);
      return;
    }
    finishNow();
  }, [finishNow, setPhase]);

  const focusInput = useCallback(() => {
    if (phaseRef.current === "interrupted") return;
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    if (phaseRef.current === "ready") setPhase("focused");
  }, [setPhase]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleFocus = () => {
      if (phaseRef.current === "ready") setPhase("focused");
    };
    const handleSelect = () => {
      selectionRef.current = {
        start: input.selectionStart ?? input.value.length,
        end: input.selectionEnd ?? input.value.length,
      };
      setSelectionEnd(selectionRef.current.end);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      // Some platforms fire only keydown for return in a textarea, with no
      // insertLineBreak beforeinput to intercept.
      if (event.key !== "Enter" || event.isComposing || composingRef.current) return;
      if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      requestFinish();
    };
    const handleBeforeInput = (event: InputEvent) => {
      selectionRef.current = {
        start: input.selectionStart ?? input.value.length,
        end: input.selectionEnd ?? input.value.length,
      };
      setSelectionEnd(selectionRef.current.end);
      if (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph") {
        if (event.cancelable) event.preventDefault();
        requestFinish();
      }
    };
    const syncFromDom = (event: InputEvent | null) => {
      const nextValue = input.value;
      const previousValue = valueRef.current;
      const inputType = event?.inputType ?? "unknown";
      if (nextValue === previousValue) return;
      if (startedAtRef.current == null && nextValue !== previousValue) start();

      if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
        assistedRef.current = true;
        setAssisted(true);
      }

      const replacement = detectHelpfulReplacement(previousValue, nextValue, targetRef.current, {
        inputType,
        selectionCollapsed: selectionRef.current.start === selectionRef.current.end,
        composing: composingRef.current || suppressCompositionCommitRef.current || Boolean(event?.isComposing),
      });
      if (replacement && startedAtRef.current != null) {
        const fix: FixRecord = {
          at: Math.round(performance.now() - startedAtRef.current),
          removed: replacement.removed,
          inserted: replacement.inserted,
          expected: replacement.expected,
          strongSignal: replacement.strongSignal,
        };
        fixesRef.current = [...fixesRef.current, fix];
        setFixes(fixesRef.current);
      }

      valueRef.current = nextValue;
      setValue(nextValue);
      historyRef.current.push({
        value: nextValue,
        inputType,
        at: startedAtRef.current == null ? 0 : Math.round(performance.now() - startedAtRef.current),
      });
      selectionRef.current = {
        start: input.selectionStart ?? nextValue.length,
        end: input.selectionEnd ?? nextValue.length,
      };
      setSelectionEnd(selectionRef.current.end);

      if (startedAtRef.current != null) {
        const metrics = calculateSessionMetrics(
          nextValue,
          targetRef.current,
          Math.max(100, performance.now() - startedAtRef.current),
          settingsRef.current.mode,
        );
        const targetLength = toGraphemes(normalizeForScoring(targetRef.current)).length;
        const isComplete = settingsRef.current.mode !== "time" && settingsRef.current.mode !== "zen"
          && (normalizeForScoring(nextValue) === normalizeForScoring(targetRef.current)
            || metrics.alignment.targetProgress >= targetLength);
        if (isComplete) requestFinish();
      }
    };
    const handleInput = (event: Event) => syncFromDom(event as InputEvent);
    const handleCompositionStart = () => {
      if (compositionSuppressionTimerRef.current != null) window.clearTimeout(compositionSuppressionTimerRef.current);
      composingRef.current = true;
      suppressCompositionCommitRef.current = true;
      if (startedAtRef.current == null) start();
    };
    const handleCompositionEnd = () => {
      composingRef.current = false;
      queueMicrotask(() => {
        syncFromDom(null);
        if (phaseRef.current === "settling") {
          if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
          finishNow();
        }
      });
      compositionSuppressionTimerRef.current = window.setTimeout(() => {
        suppressCompositionCommitRef.current = false;
        compositionSuppressionTimerRef.current = null;
      }, 0);
    };

    input.addEventListener("focus", handleFocus);
    input.addEventListener("select", handleSelect);
    input.addEventListener("beforeinput", handleBeforeInput as EventListener);
    input.addEventListener("keydown", handleKeyDown);
    input.addEventListener("input", handleInput);
    input.addEventListener("compositionstart", handleCompositionStart);
    input.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
      if (resultTimerRef.current != null) window.clearTimeout(resultTimerRef.current);
      if (compositionSuppressionTimerRef.current != null) window.clearTimeout(compositionSuppressionTimerRef.current);
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("select", handleSelect);
      input.removeEventListener("beforeinput", handleBeforeInput as EventListener);
      input.removeEventListener("keydown", handleKeyDown);
      input.removeEventListener("input", handleInput);
      input.removeEventListener("compositionstart", handleCompositionStart);
      input.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [finishNow, requestFinish, setPhase, start]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (phaseRef.current !== "running" || startedAtRef.current == null) return;
      const next = performance.now() - startedAtRef.current;
      setElapsed(next);
      recordSample(next);
      if (settingsRef.current.mode === "time" && next >= settingsRef.current.duration * 1000) requestFinish();
    }, 250);
    return () => window.clearInterval(timer);
  }, [recordSample, requestFinish, setElapsed]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && phaseRef.current === "running") {
        hiddenAtRef.current = performance.now();
        setPhase("focused");
        return;
      }
      if (!document.hidden && hiddenAtRef.current != null) {
        const awayFor = performance.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (awayFor > 1000) {
          setPhase("interrupted");
          inputRef.current?.blur();
        } else if (startedAtRef.current != null) {
          startedAtRef.current += awayFor;
          setPhase("running");
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [setPhase]);

  useEffect(() => {
    const input = inputRef.current;
    if (input) input.value = "";
    generationRef.current = runId;
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
    if (resultTimerRef.current != null) window.clearTimeout(resultTimerRef.current);
    if (compositionSuppressionTimerRef.current != null) window.clearTimeout(compositionSuppressionTimerRef.current);
    settleTimerRef.current = null;
    resultTimerRef.current = null;
    compositionSuppressionTimerRef.current = null;
    valueRef.current = "";
    startedAtRef.current = null;
    elapsedRef.current = 0;
    composingRef.current = false;
    suppressCompositionCommitRef.current = false;
    finalizingRef.current = false;
    fixesRef.current = [];
    samplesRef.current = [];
    historyRef.current = [];
    assistedRef.current = false;
    lastSampleSecondRef.current = -1;
    setValue("");
    setElapsed(0);
    setFixes([]);
    setAssisted(false);
    setSelectionEnd(0);
    setPhase("ready");
  }, [runId, setElapsed, setPhase, target]);

  const alignment = useMemo(
    () => settings.mode === "zen"
      ? calculateFreeTypingMetrics(value, 100).alignment
      : alignTypedToTarget(value, target),
    [settings.mode, target, value],
  );
  const metrics = useMemo(
    () => calculateMetricsFromAlignment(alignment, Math.max(elapsed, 100)),
    [alignment, elapsed],
  );
  const limitMs = settings.mode === "time" ? settings.duration * 1000 : elapsed;
  const remainingSeconds = settings.mode === "time"
    ? Math.max(0, Math.ceil((limitMs - elapsed) / 1000))
    : Math.max(0, Math.floor(elapsed / 1000));

  return {
    inputRef,
    phase,
    value,
    elapsed,
    remainingSeconds,
    metrics,
    fixes,
    assisted,
    selectionEnd,
    focusInput,
    requestFinish,
  };
}
