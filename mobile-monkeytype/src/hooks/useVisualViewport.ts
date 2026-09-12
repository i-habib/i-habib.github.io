import { useEffect, useRef, useState } from "react";

export function useVisualViewport() {
  const baselineHeight = useRef(typeof window === "undefined" ? 900 : window.innerHeight);
  const baselineWidth = useRef(typeof window === "undefined" ? 1200 : window.innerWidth);
  const [viewport, setViewport] = useState(() => ({
    height: typeof window === "undefined" ? 900 : window.visualViewport?.height ?? window.innerHeight,
    width: typeof window === "undefined" ? 1200 : window.visualViewport?.width ?? window.innerWidth,
    keyboardOpen: false,
  }));

  useEffect(() => {
    const update = () => {
      const visual = window.visualViewport;
      const height = visual?.height ?? window.innerHeight;
      const width = visual?.width ?? window.innerWidth;
      if (Math.abs(width - baselineWidth.current) > 100) {
        baselineWidth.current = width;
        baselineHeight.current = Math.max(window.innerHeight, height);
      }
      baselineHeight.current = Math.max(baselineHeight.current, window.innerHeight, height);
      const textInputFocused = document.activeElement?.matches("textarea, input:not([type='button']), [contenteditable='true']") ?? false;
      const keyboardOpen = textInputFocused
        && (window.innerHeight - height > 150 || baselineHeight.current - height > 150);
      document.documentElement.style.setProperty("--visual-height", `${height}px`);
      document.documentElement.style.setProperty("--visual-offset-top", `${visual?.offsetTop ?? 0}px`);
      setViewport({ height, width, keyboardOpen });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return viewport;
}
