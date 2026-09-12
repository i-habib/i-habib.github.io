import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypingSession } from "../hooks/useTypingSession";
import type { TestSettings } from "../types";

const settings: TestSettings = {
  mode: "time",
  duration: 30,
  wordCount: 25,
  quoteLength: "medium",
  punctuation: true,
  numbers: false,
  customText: "custom practice text",
};

function Harness({ marker = 0 }: { marker?: number }) {
  const session = useTypingSession({ target: "the quick fox", settings, runId: marker, onComplete: vi.fn() });
  return (
    <div data-marker={marker}>
      <textarea ref={session.inputRef} aria-label="native" defaultValue="" />
      <output data-testid="fixes">{session.fixes.length}</output>
      <output data-testid="assisted">{String(session.assisted)}</output>
      <output data-testid="phase">{session.phase}</output>
      <output data-testid="value">{session.value}</output>
    </div>
  );
}

function emitInput(element: HTMLTextAreaElement, value: string, inputType: string, isComposing = false) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.setSelectionRange(value.length, value.length);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType, isComposing }));
}

function ZenHarness({ onComplete }: { onComplete: () => void }) {
  const session = useTypingSession({
    target: "",
    settings: { ...settings, mode: "zen" },
    runId: 0,
    onComplete,
  });
  return (
    <div>
      <textarea ref={session.inputRef} aria-label="native" defaultValue="" />
      <output data-testid="phase">{session.phase}</output>
      <output data-testid="value">{session.value}</output>
    </div>
  );
}

describe("native React input bridge", () => {
  it("counts one helpful replacement in StrictMode without duplicate listeners", async () => {
    render(<StrictMode><Harness /></StrictMode>);
    const input = screen.getByRole("textbox", { name: "native" }) as HTMLTextAreaElement;
    emitInput(input, "teh ", "insertText");
    emitInput(input, "the ", "insertReplacementText");
    await waitFor(() => expect(screen.getByTestId("fixes").textContent).toBe("1"));
    expect(screen.getByTestId("value").textContent).toBe("the ");
  });

  it("marks paste assisted and still accepts the resulting value", async () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "native" }) as HTMLTextAreaElement;
    emitInput(input, "the ", "insertFromPaste");
    await waitFor(() => expect(screen.getByTestId("assisted").textContent).toBe("true"));
    expect(screen.getByTestId("value").textContent).toBe("the ");
  });

  it("preserves the textarea node, DOM value, and selection across parent rerenders", () => {
    const view = render(<Harness marker={0} />);
    const input = screen.getByRole("textbox", { name: "native" }) as HTMLTextAreaElement;
    emitInput(input, "the ", "insertText");
    input.setSelectionRange(1, 2);
    fireEvent.select(input);
    view.rerender(<Harness marker={0} />);
    expect(screen.getByRole("textbox", { name: "native" })).toBe(input);
    expect(input.value).toBe("the ");
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 2]);
  });

  it("resets for a new run id even when the passage text is identical", async () => {
    const view = render(<Harness marker={1} />);
    const input = screen.getByRole("textbox", { name: "native" }) as HTMLTextAreaElement;
    emitInput(input, "the ", "insertText");
    await waitFor(() => expect(screen.getByTestId("value").textContent).toBe("the "));
    view.rerender(<Harness marker={2} />);
    await waitFor(() => expect(input.value).toBe(""));
    expect(screen.getByTestId("phase").textContent).toBe("ready");
  });

  it("suppresses fix inference during composition", async () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "native" }) as HTMLTextAreaElement;
    fireEvent.compositionStart(input, { data: "teh" });
    emitInput(input, "teh ", "insertCompositionText", true);
    emitInput(input, "the ", "insertReplacementText", true);
    fireEvent.compositionEnd(input, { data: "the" });
    await waitFor(() => expect(screen.getByTestId("value").textContent).toBe("the "));
    expect(screen.getByTestId("fixes").textContent).toBe("0");
  });

  it("finishes a zen run on return, even without an insertLineBreak beforeinput", async () => {
    const onComplete = vi.fn();
    render(<ZenHarness onComplete={onComplete} />);
    const input = screen.getByRole("textbox", { name: "native" }) as HTMLTextAreaElement;
    emitInput(input, "free writing", "insertText");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0].typedText).toBe("free writing");
  });

  it("ignores shift+return so a zen run can keep going", async () => {
    const onComplete = vi.fn();
    render(<ZenHarness onComplete={onComplete} />);
    const input = screen.getByRole("textbox", { name: "native" }) as HTMLTextAreaElement;
    emitInput(input, "free writing", "insertText");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    await waitFor(() => expect(screen.getByTestId("value").textContent).toBe("free writing"));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
