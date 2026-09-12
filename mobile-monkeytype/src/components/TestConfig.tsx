import { Asterisk, Clock3, FileText, Hash, Languages, Mountain, Settings2, TextCursorInput, Wrench } from "lucide-react";
import type { QuoteLength, TestMode, TestSettings } from "../types";

interface TestConfigProps {
  hidden?: boolean;
  settings: TestSettings;
  onChange: (settings: TestSettings) => void;
  onOpenMobile: () => void;
}

interface ConfigButtonProps {
  active?: boolean;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export function ConfigButton({ active, label, icon, onClick, className = "" }: ConfigButtonProps) {
  return (
    <button
      className={`config-button ${active ? "active" : ""} ${className}`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {icon}{label}
    </button>
  );
}

const MODE_ICONS: Record<TestMode, React.ReactNode> = {
  time: <Clock3 />,
  words: <TextCursorInput />,
  quote: <FileText />,
  zen: <Mountain />,
  custom: <Wrench />,
};

export function TestConfig({ hidden = false, settings, onChange, onOpenMobile }: TestConfigProps) {
  const set = <K extends keyof TestSettings>(key: K, value: TestSettings[K]) => onChange({ ...settings, [key]: value });
  const values = settings.mode === "time"
    ? [15, 30, 60, 120]
    : settings.mode === "words"
      ? [10, 25, 50, 100]
      : settings.mode === "quote"
        ? ["short", "medium", "long"]
        : [];

  return (
    <div className="config-wrap chrome-fade" aria-hidden={hidden || undefined} inert={hidden ? true : undefined}>
      <div className="test-config" aria-label="Test configuration">
        <div className="config-group">
          <ConfigButton active={settings.punctuation} icon={<Asterisk />} label="punctuation" onClick={() => set("punctuation", !settings.punctuation)} />
          <ConfigButton active={settings.numbers} icon={<Hash />} label="numbers" onClick={() => set("numbers", !settings.numbers)} />
        </div>
        <span className="config-divider" />
        <div className="config-group">
          {(["time", "words", "quote", "zen", "custom"] as const).map((mode) => (
            <ConfigButton key={mode} active={settings.mode === mode} icon={MODE_ICONS[mode]} label={mode} onClick={() => set("mode", mode)} />
          ))}
        </div>
        {values.length > 0 && <span className="config-divider" />}
        {values.length > 0 && (
          <div className="config-group compact-values">
            {values.map((value) => (
              <ConfigButton
                key={String(value)}
                active={
                  (settings.mode === "time" && settings.duration === value)
                  || (settings.mode === "words" && settings.wordCount === value)
                  || (settings.mode === "quote" && settings.quoteLength === value)
                }
                label={String(value)}
                onClick={() => {
                  if (settings.mode === "time") set("duration", value as TestSettings["duration"]);
                  else if (settings.mode === "words") set("wordCount", value as TestSettings["wordCount"]);
                  else set("quoteLength", value as QuoteLength);
                }}
              />
            ))}
          </div>
        )}
        <ConfigButton className="config-more" icon={<Settings2 />} label={<span className="sr-only">More settings</span>} onClick={onOpenMobile} />
      </div>
      <button className="mobile-test-settings" type="button" onClick={onOpenMobile}>
        <Settings2 /> test settings
      </button>
      <div className="language-row"><Languages /> english <span>• autocorrect on</span></div>
    </div>
  );
}
