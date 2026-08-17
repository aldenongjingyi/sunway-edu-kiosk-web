"use client";
import { useEffect } from "react";
import { initHDX } from "@/lib/hdx";

export default function HyperDXInit() {
  useEffect(() => { initHDX(); }, []);
  return null;
}
