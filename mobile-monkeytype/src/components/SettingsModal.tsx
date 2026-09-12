import { useEffect, useState } from "react";
import { Asterisk, Clock3, FileText, Hash, Mountain, TextCursorInput, Wrench } from "lucide-react";
import type { QuoteLength, TestSettings } from "../types";
import { ConfigButton } from "./TestConfig";
import { Modal } from "./Modal";

interface SettingsModalProps {
  open: boolean;
  settings: TestSettings;
  onChange: (settings: TestSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ open, settings, onChange, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);
  const set = <K extends keyof TestSettings>(key: K, value: TestSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const apply = () => {
    const normalized = {
      ...draft,
      duration: Math.max(10, Math.min(300, Math.round(draft.duration || 30))),
      wordCount: Math.max(5, Math.min(200, Math.round(draft.wordCount || 25))),
    };
    onChange(normalized);
    onClose();
  };
  return (
    <Modal open={open} title="test settings" label="choose a test" onClose={onClose} className="settings-modal">
      <div className="settings-section">
        <h3>content</h3>
        <div className="settings-grid two">
          <ConfigButton active={draft.punctuation} icon={<Asterisk />} label="punctuation" onClick={() => set("punctuation", !draft.punctuation)} />
          <ConfigButton active={draft.numbers} icon={<Hash />} label="numbers" onClick={() => set("numbers", !draft.numbers)} />
        </div>
      </div>
      <div className="settings-section">
        <h3>mode</h3>
        <div className="settings-grid mode-grid">
          <ConfigButton active={draft.mode === "time"} icon={<Clock3 />} label="time" onClick={() => set("mode", "time")} />
          <ConfigButton active={draft.mode === "words"} icon={<TextCursorInput />} label="words" onClick={() => set("mode", "words")} />
          <ConfigButton active={draft.mode === "quote"} icon={<FileText />} label="quote" onClick={() => set("mode", "quote")} />
          <ConfigButton active={draft.mode === "zen"} icon={<Mountain />} label="zen" onClick={() => set("mode", "zen")} />
          <ConfigButton active={draft.mode === "custom"} icon={<Wrench />} label="custom" onClick={() => set("mode", "custom")} />
        </div>
      </div>
      {(draft.mode === "time" || draft.mode === "words" || draft.mode === "quote") && <div className="settings-section">
        <h3>{draft.mode === "time" ? "seconds" : draft.mode === "words" ? "word count" : "quote length"}</h3>
        <div className="settings-grid values">
          {draft.mode === "time" && ([15, 30, 60, 120] as const).map((value) => (
            <ConfigButton key={value} active={draft.duration === value} label={value} onClick={() => set("duration", value)} />
          ))}
          {draft.mode === "words" && ([10, 25, 50, 100] as const).map((value) => (
            <ConfigButton key={value} active={draft.wordCount === value} label={value} onClick={() => set("wordCount", value)} />
          ))}
          {draft.mode === "quote" && (["short", "medium", "long"] as QuoteLength[]).map((value) => (
            <ConfigButton key={value} active={draft.quoteLength === value} label={value} onClick={() => set("quoteLength", value)} />
          ))}
        </div>
        {(draft.mode === "time" || draft.mode === "words") && (
          <label className="custom-amount">
            <span>or enter a custom {draft.mode === "time" ? "duration" : "count"}</span>
            <input
              type="number"
              inputMode="numeric"
              min={draft.mode === "time" ? 10 : 5}
              max={draft.mode === "time" ? 300 : 200}
              value={draft.mode === "time" ? draft.duration : draft.wordCount}
              onChange={(event) => set(draft.mode === "time" ? "duration" : "wordCount", Number(event.target.value))}
            />
          </label>
        )}
      </div>}
      {draft.mode === "zen" && (
        <div className="mode-explainer"><strong>free typing</strong><p>Write anything with no target or time limit. Press return when you are done.</p></div>
      )}
      {draft.mode === "custom" && (
        <label className="custom-text-field">
          <span>your text</span>
          <textarea
            value={draft.customText}
            onChange={(event) => set("customText", event.target.value)}
            placeholder="Paste or type the passage you want to practice…"
            rows={6}
            spellCheck
          />
          <small>{draft.customText.trim().split(/\s+/).filter(Boolean).length} words · stored only for this session</small>
        </label>
      )}
      <div className="autocorrect-callout">
        <strong>native keyboard mode</strong>
        <p>Autocorrect, prediction taps, swipe typing, and smart punctuation stay enabled.</p>
      </div>
      <div className="settings-actions">
        <button className="modal-cancel" type="button" onClick={onClose}>cancel</button>
        <button className="modal-done" type="button" onClick={apply} disabled={draft.mode === "custom" && !draft.customText.trim()}>apply</button>
      </div>
    </Modal>
  );
}
