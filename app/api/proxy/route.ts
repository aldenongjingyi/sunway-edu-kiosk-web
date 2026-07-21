export const dynamic = "force-static";
import { NextRequest, NextResponse } from "next/server";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

const ALLOWED_HOSTS = [
  "sunwayedu3-data.indoorcms.com",
  "izone.sunway.edu.my",
  "maps-sunwayedu.getmallapp.com",
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: res.status });

  const buf = Buffer.from(await res.arrayBuffer());

  // JavaScript files — return as-is with correct MIME type
  if (url.endsWith(".js")) {
    return new NextResponse(buf, {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "s-maxage=86400" },
    });
  }

  let json: string;
  if (url.endsWith(".gz")) {
    try {
      const decompressed = await gunzip(buf);
      json = decompressed.toString("utf8");
    } catch {
      // Not actually gzip — treat as plain text/json
      json = buf.toString("utf8");
    }
  } else {
    json = buf.toString("utf8");
  }

  return new NextResponse(json, {
    headers: { "Content-Type": "application/json", "Cache-Control": "s-maxage=1800" },
  });
}
