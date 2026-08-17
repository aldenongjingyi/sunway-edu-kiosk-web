"use client";
import { useState } from "react";

const PersonIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="#c7c7cc" strokeWidth="1.5" />
    <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="#c7c7cc" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function AvatarPlaceholder({ src, name }: { src?: string; name?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  if (!src || status === "error") {
    return (
      <div className="w-11 h-11 rounded-full bg-[#e5e5ea] flex items-center justify-center flex-shrink-0">
        <PersonIcon />
      </div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-full flex-shrink-0 relative">
      {status === "loading" && (
        <div className="absolute inset-0 rounded-full bg-[#e5e5ea] flex items-center justify-center">
          <PersonIcon />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src.replace("http:", "https:")}
        alt={name ?? ""}
        className="w-11 h-11 rounded-full object-cover border border-gray-200"
        style={{ opacity: status === "loaded" ? 1 : 0 }}
        onLoad={() => setStatus("loaded")}
        onError={(e) => { e.nativeEvent.stopPropagation(); setStatus("error"); }}
      />
    </div>
  );
}
