"use client";
import { useEffect } from "react";
import { initHDX } from "@/lib/hdx";

export default function HyperDXInit() {
  useEffect(() => {
    initHDX();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
