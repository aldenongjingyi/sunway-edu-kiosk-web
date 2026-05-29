import { NextRequest, NextResponse } from "next/server";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

const ALLOWED_HOSTS = [
  "sunwayedu3-data.indoorcms.com",
  "izone.sunway.edu.my",
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

  let json: string;
  if (url.endsWith(".gz")) {
    const decompressed = await gunzip(buf);
    json = decompressed.toString("utf8");
  } else {
    json = buf.toString("utf8");
  }

  return new NextResponse(json, {
    headers: { "Content-Type": "application/json", "Cache-Control": "s-maxage=1800" },
  });
}
