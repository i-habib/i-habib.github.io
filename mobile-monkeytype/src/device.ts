import type { DeviceType } from "./types";

export function detectDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "computer";

  const userAgent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile|tablet/.test(userAgent)) return "mobile";

  if (typeof window !== "undefined" && "ontouchstart" in window
    && Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 900) {
    return "mobile";
  }

  return "computer";
}
