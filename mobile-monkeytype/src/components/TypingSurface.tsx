import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MousePointer2, RotateCcw, Sparkles } from "lucide-react";
import { useTypingSession } from "../hooks/useTypingSession";
import { toGraphemes, type AlignmentOperation } from "../engine";
import type { RunResult, TestSettings } from "../types";

interface TypingSurfaceProps {
  target: string;
  settings: TestSettings;
  runId: number;
  onComplete: (result: RunResult) => void;
  onRestart: () => void;
  onActiveChange: (active: boolean) => void;
}

interface RenderToken {
  char: string;
  state: AlignmentOperation["type"] | "pending" | "caret";
  key: string;
}

function createRenderTokens(operations: AlignmentOperation[], target: string[], progress: number, caretTypedIndex: number): RenderToken[] {
  const tokens: RenderToken[] = [];
  let consumedTyped = 0;
  let caretInserted = false;
  operations.forEach((operation, index) => {
    if (!caretInserted && caretTypedIndex === consumedTyped) {
      tokens.push({ char: "", state: "caret", key: "caret" });
      caretInserted = true;
    }
    tokens.push({
      char: operation.type === "insert" ? operation.actual : operation.expected,
      state: operation.type,
      key: `done-${index}`,
    });
    if (operation.type !== "delete") consumedTyped += 1;
  });
  if (!caretInserted) tokens.push({ char: "", state: "caret", key: "caret" });
  for (let index = progress; index < target.length; index += 1) {
    tokens.push({ char: target[index], state: "pending", key: `pending-${index}` });
  }
  return tokens;
}

function PromptMirror({ operations, target, progress, value, caretTypedIndex }: {
  operations: AlignmentOperation[];
  target: string[];
  progress: number;
  value: string;
  caretTypedIndex: number;
}) {
  const promptRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);
  const tokens = useMemo(
    () => createRenderTokens(operations, target, progress, caretTypedIndex),
    [caretTypedIndex, operations, progress, target],
  );
  const groups = useMemo(() => {
    const output: RenderToken[][] = [];
    let current: RenderToken[] = [];
    for (const token of tokens) {
      if (token.char === " ") {
        current.push(token);
        output.push(current);
        current = [];
      } else {
        current.push(token);
      }
    }
    if (current.length) output.push(current);
    return output;
  }, [tokens]);

  useLayoutEffect(() => {
    const prompt = promptRef.current;
    const caret = caretRef.current;
    if (!prompt || !caret) return;
    const lineHeight = Number.parseFloat(getComputedStyle(prompt).lineHeight) || 48;
    const row = Math.round(caret.offsetTop / lineHeight);
    setOffset(Math.max(0, row - 1) * lineHeight);
  }, [caretTypedIndex, value]);

  return (
    <div className="prompt-window" aria-hidden="true">
      <div ref={promptRef} className="prompt-mirror" style={{ transform: `translateY(${-offset}px)` }}>
        {groups.map((group, groupIndex) => (
          <span className="prompt-word" key={`word-${groupIndex}`}>
            {group.map((token) => token.state === "caret" ? (
              <span ref={caretRef} className="prompt-caret" key={token.key} />
            ) : (
              <span className={`prompt-char ${token.state} ${token.char === " " ? "space" : ""}`} key={token.key}>
                {token.char}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TypingSurface({ target, settings, runId, onComplete, onRestart, onActiveChange }: TypingSurfaceProps) {
  const session = useTypingSession({ target, settings, runId, onComplete });
  const [fixFlash, setFixFlash] = useState(false);
  const active = session.phase === "running" || session.phase === "settling";
  const focused = session.phase !== "ready";
  const progress = settings.mode === "time"
    ? Math.min(1, session.elapsed / Math.max(1, settings.duration * 1000))
    : settings.mode === "zen"
      ? 0
      : Math.min(1, session.metrics.alignment.targetProgress / Math.max(1, session.metrics.alignment.targetLength));
  const progressLabel = settings.mode === "time"
    ? `${session.remainingSeconds}s`
    : settings.mode === "zen"
      ? `${session.remainingSeconds}s`
      : `${Math.round(progress * 100)}%`;

  useEffect(() => onActiveChange(active), [active, onActiveChange]);
  useEffect(() => {
    if (!session.fixes.length) return;
    setFixFlash(true);
    const timer = window.setTimeout(() => setFixFlash(false), 280);
    return () => window.clearTimeout(timer);
  }, [session.fixes.length]);

  const restart = () => {
    session.inputRef.current?.focus({ preventScroll: true });
    onRestart();
  };

  if (session.phase === "interrupted") {
    return (
      <section className="interrupted-state" aria-labelledby="interrupted-title">
        <span>run interrupted</span>
        <h1 id="interrupted-title">let’s try that one again</h1>
        <p>Background time was left out so the result stays honest.</p>
        <button type="button" onClick={onRestart}><RotateCcw /> restart test</button>
      </section>
    );
  }

  return (
    <section className={`typing-test ${focused ? "is-focused" : ""} ${active ? "is-active" : ""} ${fixFlash ? "just-fixed" : ""}`}>
      <div className="test-meta">
        {active && (
          <>
            <span className="test-time">{progressLabel}</span>
            <span className="live-fixes"><Sparkles /> {session.fixes.length} {session.fixes.length === 1 ? "fix" : "fixes"}</span>
          </>
        )}
      </div>
      {active && settings.mode !== "zen" && (
        <div className="test-progress" role="progressbar" aria-label="Test progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}

      <div
        className="typing-surface"
        onPointerDown={session.focusInput}
        data-testid="typing-surface"
      >
        <PromptMirror
          operations={session.metrics.alignment.operations}
          target={session.metrics.alignment.target}
          progress={session.metrics.alignment.targetProgress}
          value={session.value}
          caretTypedIndex={toGraphemes(session.value.slice(0, session.selectionEnd)).length}
        />
        {settings.mode === "zen" && !session.value && (
          <div className="zen-placeholder" aria-hidden="true">type anything…</div>
        )}
        <textarea
          ref={session.inputRef}
          className="native-typing-input"
          defaultValue=""
          aria-label="Typing test input"
          aria-describedby="native-input-help target-text"
          autoCorrect="on"
          autoCapitalize={settings.punctuation ? "sentences" : "none"}
          autoComplete="on"
          enterKeyHint="done"
          inputMode="text"
          lang="en"
          rows={3}
          spellCheck
        />
        {!focused && (
          <div className="focus-message" aria-hidden="true">
            <MousePointer2 /> <span>Click here or tap to focus</span>
          </div>
        )}
      </div>

      <p className="sr-only" id="target-text">{settings.mode === "zen" ? "Free typing mode. Write anything and press return to finish." : `Text to type: ${target}`}</p>
      <p className="sr-only" id="native-input-help">Type normally. Your phone keyboard, autocorrect, and suggestions are enabled.</p>
      <button className="restart-test" type="button" onClick={restart} aria-label="Restart test" title="Restart test">
        <RotateCcw />
      </button>
      {!active && (
        <p className="mobile-autocorrect-hint"><Sparkles /> {settings.mode === "zen" ? "press return to finish" : "autocorrect and suggestions count"}</p>
      )}
    </section>
  );
}
