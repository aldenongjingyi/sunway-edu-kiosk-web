#!/usr/bin/env node
/**
 * Deploys the kiosk web app as the mobile QR experience to:
 *   maps-sunwayedu.getmallapp.com/qrcode/
 *
 * Run with: node --env-file=.env.local scripts/deploy-qrcode.mjs
 *
 * Uses DEPLOY_TARGET=qrcode so next.config.ts sets the correct assetPrefix
 * and NEXT_PUBLIC_WAYFINDER_URL for this deploy target.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const MAPS_BUCKET   = "maps-sunwayedu.getmallapp.com";
const MAPS_KEY      = "DO801ZN38CGHWHG6FNZ7";
const MAPS_SECRET   = "TCkRo9LpAyYuOc6ZPDGEB3Vwg4Q76y42fnkwpEMw4ZY";
const MAPS_REGION   = "sgp1";
const SPACE_PREFIX  = "qrcode/";

const WAYFINDER_URL   = "https://maps-sunwayedu.getmallapp.com/wayfinder-map.min.js";
const WAYFINDER_LOCAL = join(ROOT, "public", "wayfinder-map.min.js");
const STAFF_URL       = "https://izone.sunway.edu.my/segfeeds/staff/mycampus/bd2fd99be3e0c4b144e3c3c3a3f7a22999cf8615";
const OUT_DIR         = join(ROOT, "out");

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

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    statSync(full).isDirectory() ? walk(full, files) : files.push(full);
  }
  return files;
}

(async () => {
  // 1. Fetch wayfinder JS
  console.log("⬇  Fetching wayfinder-map.min.js…");
  const res = await fetch(WAYFINDER_URL, { headers: { "User-Agent": "deploy-script/1.0" } });
  if (!res.ok) throw new Error(`Failed to fetch wayfinder JS: ${res.status}`);
  writeFileSync(WAYFINDER_LOCAL, await res.text(), "utf-8");
  console.log("   Saved");

  // 2. Build with qrcode target
  console.log("\n🔨 Building (DEPLOY_TARGET=qrcode)…");
  execSync("npm run build", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DEPLOY_TARGET: "qrcode", NODE_ENV: "production" },
  });

  // 3. Upload to maps-sunwayedu.getmallapp.com/qrcode/
  console.log("\n☁  Uploading to maps-sunwayedu.getmallapp.com/qrcode/ …");
  const client = new S3Client({
    endpoint: `https://${MAPS_REGION}.digitaloceanspaces.com`,
    region: MAPS_REGION,
    credentials: { accessKeyId: MAPS_KEY, secretAccessKey: MAPS_SECRET },
    forcePathStyle: false,
  });

  const files = walk(OUT_DIR);
  let uploaded = 0;
  for (const file of files) {
    const rel = relative(OUT_DIR, file).replace(/\\/g, "/");
    const key = SPACE_PREFIX + rel;
    await client.send(new PutObjectCommand({
      Bucket: MAPS_BUCKET,
      Key: key,
      Body: readFileSync(file),
      ContentType: mimeFor(file),
      CacheControl: cacheFor(key),
      ACL: "public-read",
    }));
    process.stdout.write(`\r   ${++uploaded}/${files.length} files`);
  }
  // Also upload index.html at the bare "qrcode" key (no trailing slash) so that
  // maps-sunwayedu.getmallapp.com/qrcode (without /index.html) works too.
  const indexFile = join(OUT_DIR, "index.html");
  const bareKey = SPACE_PREFIX.replace(/\/$/, ""); // "qrcode"
  await client.send(new PutObjectCommand({
    Bucket: MAPS_BUCKET,
    Key: bareKey,
    Body: readFileSync(indexFile),
    ContentType: "text/html; charset=utf-8",
    CacheControl: "no-store",
    ACL: "public-read",
  }));
  console.log(`\n   ✓ ${uploaded} files uploaded + bare index at /${bareKey}`);

  // 4. Fetch staff data and upload as static JSON (bypasses CF Worker captcha issue)
  console.log("\n⬇  Fetching staff data…");
  try {
    const staffRes = await fetch(STAFF_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (staffRes.ok) {
      const staffBody = await staffRes.text();
      // Verify it's valid JSON (not a captcha page)
      JSON.parse(staffBody);
      await client.send(new PutObjectCommand({
        Bucket: MAPS_BUCKET,
        Key: "staff.json",
        Body: staffBody,
        ContentType: "application/json",
        CacheControl: "public, max-age=3600",
        ACL: "public-read",
      }));
      console.log("   ✓ staff.json uploaded");
    } else {
      console.log(`   ⚠ Staff fetch failed (${staffRes.status}), skipping`);
    }
  } catch (e) {
    console.log(`   ⚠ Staff fetch error: ${e.message}, skipping`);
  }

  // 5. Cleanup
  unlinkSync(WAYFINDER_LOCAL);
  console.log("\n✅ Deploy complete.");
  console.log("   https://maps-sunwayedu.getmallapp.com/qrcode/index.html");
})().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
