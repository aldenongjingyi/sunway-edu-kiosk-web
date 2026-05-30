export default function AvatarPlaceholder({ src, name }: { src?: string; name?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src.replace("http:", "https:")}
        alt={name ?? ""}
        className="w-11 h-11 rounded-full object-cover border border-gray-200 flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-11 h-11 rounded-full border border-gray-300 bg-white flex items-center justify-center flex-shrink-0">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#c7c7cc" strokeWidth="1.5" />
        <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="#c7c7cc" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
