#!/usr/bin/env node
/**
 * Deploy script for Sunway Edu Kiosk web app.
 * Run with: node --env-file=.env.local scripts/deploy.mjs
 *
 * Steps:
 *  1. Fetch wayfinder-map.min.js from upstream and save to public/
 *  2. next build  (output: export → writes to out/)
 *  3. Sync out/ to DO Spaces, with correct content-type + cache headers
 *  4. Cleanup wayfinder JS from public/
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Env ────────────────────────────────────────────────────────────────────
const {
  DO_SPACES_KEY,
  DO_SPACES_SECRET,
  DO_SPACES_REGION,
  DO_SPACES_BUCKET,
  DO_SPACES_PATH = "",
} = process.env;

for (const [k, v] of Object.entries({ DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_REGION, DO_SPACES_BUCKET })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
}

const WAYFINDER_URL = "https://maps-sunwayedu.getmallapp.com/wayfinder-map.min.js";
const WAYFINDER_LOCAL = join(ROOT, "public", "wayfinder-map.min.js");
const OUT_DIR = join(ROOT, "out");
const SPACE_PREFIX = DO_SPACES_PATH ? DO_SPACES_PATH.replace(/\/?$/, "/") : "";

// ── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
  ".html":  "text/html; charset=utf-8",
  ".css":   "text/css",
  ".js":    "application/javascript",
  ".mjs":   "application/javascript",
  ".json":  "application/json",
  ".txt":   "text/plain",
  ".xml":   "application/xml",
  ".svg":   "image/svg+xml",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".webp":  "image/webp",
  ".gif":   "image/gif",
  ".ico":   "image/x-icon",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".mp4":   "video/mp4",
  ".webm":  "video/webm",
};

function mimeFor(file) {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}

function cacheFor(key) {
  if (key.includes("/_next/static/")) return "public, max-age=31536000, immutable";
  if (key.endsWith(".html"))          return "no-store";
  return "public, max-age=3600";
}

// ── Walk directory ──────────────────────────────────────────────────────────
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    statSync(full).isDirectory() ? walk(full, files) : files.push(full);
  }
  return files;
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  // 1. Fetch wayfinder JS
  console.log("⬇  Fetching wayfinder-map.min.js…");
  const res = await fetch(WAYFINDER_URL, {
    headers: { "User-Agent": "deploy-script/1.0" },
  });
  if (!res.ok) throw new Error(`Failed to fetch wayfinder JS: ${res.status}`);
  const js = await res.text();
  writeFileSync(WAYFINDER_LOCAL, js, "utf-8");
  console.log(`   Saved ${(js.length / 1024).toFixed(1)} KB`);

  // 2. Build
  console.log("\n🔨 Building…");
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });

  // 3. Sync to DO Spaces
  console.log("\n☁  Syncing to DO Spaces…");
  const client = new S3Client({
    endpoint: `https://${DO_SPACES_REGION}.digitaloceanspaces.com`,
    region: DO_SPACES_REGION,
    credentials: { accessKeyId: DO_SPACES_KEY, secretAccessKey: DO_SPACES_SECRET },
    forcePathStyle: false,
  });

  const files = walk(OUT_DIR);
  let uploaded = 0;

  for (const file of files) {
    const rel = relative(OUT_DIR, file).replace(/\\/g, "/");
    const key = SPACE_PREFIX + rel;
    const body = readFileSync(file);

    await client.send(new PutObjectCommand({
      Bucket: DO_SPACES_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeFor(file),
      CacheControl: cacheFor(key),
      ACL: "public-read",
    }));

    process.stdout.write(`\r   ${++uploaded}/${files.length} files`);
  }

  console.log(`\n   ✓ ${uploaded} files uploaded`);

  // 4. Cleanup
  unlinkSync(WAYFINDER_LOCAL);
  console.log("\n✅ Deploy complete.");
  console.log(`   https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.cdn.digitaloceanspaces.com`);
})().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
