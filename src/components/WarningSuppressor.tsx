
"use client";
import { useEffect } from "react";
export function WarningSuppressor() {
  useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (typeof args[0] === "string" && args[0].includes("THREE.Clock: This module has been deprecated")) return;
      if (typeof args[0] === "string" && args[0].includes("Realtime send() is automatically falling back to REST")) return;
      originalWarn.apply(console, args);
    };
    return () => { console.warn = originalWarn; };
  }, []);
  return null;
}
