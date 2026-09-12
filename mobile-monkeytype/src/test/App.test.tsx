import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";

describe("React app", () => {
  beforeEach(() => localStorage.clear());

  it("renders a real uncontrolled mobile textarea with native keyboard features", () => {
    render(<App />);
    const input = screen.getByRole("textbox", { name: "Typing test input" }) as HTMLTextAreaElement;
    expect(input.getAttribute("autocorrect")).toBe("on");
    expect(input.getAttribute("autocapitalize")).toBe("sentences");
    expect(input.getAttribute("inputmode")).toBe("text");
    expect(input.getAttribute("spellcheck")).toBe("true");
    expect(input.value).toBe("");
  });

  it("focuses from the visual surface and mirrors native input events", async () => {
    render(<App />);
    const input = screen.getByRole("textbox", { name: "Typing test input" }) as HTMLTextAreaElement;
    const surface = screen.getByTestId("typing-surface");
    fireEvent.pointerDown(surface);
    expect(document.activeElement).toBe(input);

    const target = screen.getByText(/Text to type:/).textContent?.replace("Text to type: ", "") ?? "";
    const first = target[0];
    fireEvent.input(input, { target: { value: first }, inputType: "insertText", data: first });
    await waitFor(() => expect(surface.querySelector(".prompt-char.match")?.textContent).toBe(first));
  });

  it("opens the mobile settings dialog and updates the test mode", () => {
    render(<App />);
    const settingsButtons = screen.getAllByRole("button", { name: /test settings/i });
    fireEvent.click(settingsButtons[0]);
    const dialog = screen.getByRole("dialog", { name: "test settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "words" }));
    expect(within(dialog).getByRole("button", { name: "words" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("offers zen and custom modes through draft settings", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /test settings/i })[0]);
    const dialog = screen.getByRole("dialog", { name: "test settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "zen" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "apply" }));
    expect(screen.getByText(/Free typing mode/)).toBeTruthy();
  });

  it("opens a first-class progress view", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Your progress" }));
    expect(screen.getByRole("heading", { name: "your progress" })).toBeTruthy();
    expect(screen.getByText("your results will appear here")).toBeTruthy();
  });

  it("shows proportional progress once a run starts", async () => {
    render(<App />);
    const input = screen.getByRole("textbox", { name: "Typing test input" }) as HTMLTextAreaElement;
    fireEvent.input(input, { target: { value: "a" }, inputType: "insertText", data: "a" });
    await waitFor(() => expect(screen.getByRole("progressbar", { name: "Test progress" })).toBeTruthy());
  });
});
