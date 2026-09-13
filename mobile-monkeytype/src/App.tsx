import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "./auth/useAuth";
import { buildPassage, DEFAULT_CUSTOM_TEXT } from "./corpus";
import { AboutModal } from "./components/AboutModal";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ProgressPage } from "./components/ProgressPage";
import { Results } from "./components/Results";
import { SettingsModal } from "./components/SettingsModal";
import { TestConfig } from "./components/TestConfig";
import { TypingSurface } from "./components/TypingSurface";
import { detectDeviceType } from "./device";
import { useVisualViewport } from "./hooks/useVisualViewport";
import { selectPersonalBest, useProgress } from "./progress";
import { useCloudProgress } from "./progress/useCloudProgress";
import { downloadProgress, parseTransfer } from "./progress/transfer";
import type { RunResult, TestSettings } from "./types";

const DEFAULT_SETTINGS: TestSettings = {
  mode: "time",
  duration: 30,
  wordCount: 25,
  quoteLength: "medium",
  punctuation: true,
  numbers: false,
  customText: DEFAULT_CUSTOM_TEXT,
};

type AppView = "test" | "progress";

export default function App() {
  const [settings, setSettings] = useState<TestSettings>(DEFAULT_SETTINGS);
  const [target, setTarget] = useState(() => buildPassage(DEFAULT_SETTINGS));
  const [runId, setRunId] = useState(1);
  const [result, setResult] = useState<RunResult | null>(null);
  const [view, setView] = useState<AppView>("test");
  const [active, setActive] = useState(false);
  const [promoVisible, setPromoVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const viewport = useVisualViewport();
  const auth = useAuth();
  const { progress, storageError, recordRun, importProgress, clearHistory, resetAll } = useProgress();
  const cloud = useCloudProgress(auth.user, progress, importProgress);

  const begin = useCallback((nextSettings = settings, repeat = false) => {
    setView("test");
    setActive(false);
    setResult(null);
    setRunId((current) => current + 1);
    setTarget((current) => repeat ? current : buildPassage(nextSettings));
  }, [settings]);

  const changeSettings = useCallback((next: TestSettings) => {
    setSettings(next);
    begin(next);
  }, [begin]);

  const complete = useCallback((nextResult: RunResult) => {
    setActive(false);
    const resultWithDevice = { ...nextResult, device: detectDeviceType() };
    setResult(resultWithDevice);
    recordRun(resultWithDevice);
    void cloud.saveRun(resultWithDevice);
  }, [cloud.saveRun, recordRun]);

  const exportData = useCallback(() => downloadProgress(progress), [progress]);
  const importData = useCallback(async (file: File) => {
    try {
      const imported = parseTransfer(await file.text());
      const next = importProgress(imported);
      void cloud.syncNow(next);
      setTransferError(null);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Could not import that file.");
    }
  }, [cloud, importProgress]);

  const clearHistoryAndCloud = useCallback(() => {
    clearHistory();
    void cloud.clearRemote();
  }, [clearHistory, cloud.clearRemote]);

  const resetAllAndCloud = useCallback(() => {
    resetAll();
    void cloud.clearRemote();
  }, [cloud.clearRemote, resetAll]);

  const currentBest = result ? selectPersonalBest(progress, result.settings) : null;

  return (
    <div className={`app ${active ? "test-running" : ""} ${viewport.keyboardOpen ? "keyboard-open" : ""} ${promoVisible ? "has-promo" : ""}`}>
      {promoVisible && (
        <aside className="promo-bar">
          <span>phone-friendly typing</span><strong>autocorrect stays on</strong>
          <button type="button" aria-label="Dismiss announcement" onClick={() => setPromoVisible(false)}><X /></button>
        </aside>
      )}
      <div className="app-grid">
        <Header
          hidden={active}
          onHome={() => begin()}
          onHistory={() => { setActive(false); setResult(null); setView("progress"); }}
          onAbout={() => setAboutOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          auth={auth}
        />
        <main className="main-content">
          {view === "progress" ? (
            <ProgressPage
              progress={progress}
              storageError={storageError}
              transferError={transferError}
              onNewTest={() => begin()}
              onClearHistory={clearHistoryAndCloud}
              onResetAll={resetAllAndCloud}
              onExport={exportData}
              onImport={importData}
              auth={auth}
              cloudStatus={cloud.status}
              cloudError={cloud.error}
              onCloudSync={() => void cloud.syncNow(progress)}
            />
          ) : !result ? (
            <>
              <TestConfig hidden={active} settings={settings} onChange={changeSettings} onOpenMobile={() => setSettingsOpen(true)} />
              <TypingSurface
                target={target}
                settings={settings}
                runId={runId}
                onComplete={complete}
                onRestart={() => begin()}
                onActiveChange={setActive}
              />
            </>
          ) : (
            <Results
              result={result}
              bestWpm={currentBest?.wpm ?? null}
              isNewBest={currentBest?.runId === result.id}
              onNext={() => begin()}
              onRepeat={() => begin(settings, true)}
              onProgress={() => { setResult(null); setView("progress"); }}
            />
          )}
        </main>
        <Footer hidden={active} onAbout={() => setAboutOpen(true)} />
      </div>

      <SettingsModal open={settingsOpen} settings={settings} onChange={changeSettings} onClose={() => setSettingsOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <div className="sr-only" aria-live="polite">{result ? `Test complete. ${result.wpm} words per minute and ${result.accuracy} percent accuracy.` : ""}</div>
    </div>
  );
}
