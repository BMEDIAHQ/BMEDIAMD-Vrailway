// commands/fb.js (ESM)
// Facebook downloader using Prexzy Facebook V2 API.
// Flow intentionally mirrors the working YTV command:
// 1) fetch small JSON metadata
// 2) choose HD (720p) when available, otherwise SD/first MP4
// 3) stream the actual video to ./download_temp on disk (no full video Buffer)
// 4) send the local file with Baileys
// 5) ffmpeg remux only if direct send fails
// 6) remove only this command's temporary files

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Readable } from "stream";
import ffmpegPath from "ffmpeg-static";

const DOWNLOAD_TEMP_DIR = path.join(process.cwd(), "download_temp");
const DISK_STOP_PERCENT = 95;
const MIN_VALID_BYTES = 5000;
const API_BASE = "https://prexzyapis.com/download/facebookv2";

async function safeFetch(url, opts) {
  if (globalThis.fetch) return fetch(url, opts);
  const mod = await import("node-fetch");
  return mod.default(url, opts);
}

function pickUrl(args) {
  const s = (args || []).join(" ").trim();
  const m = s.match(/https?:\/\/\S+/i);
  return m ? m[0] : "";
}

function cleanFileName(name) {
  return String(name || "Facebook Video")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Facebook Video";
}

function ensureDownloadTempDir() {
  if (!fs.existsSync(DOWNLOAD_TEMP_DIR)) {
    fs.mkdirSync(DOWNLOAD_TEMP_DIR, { recursive: true });
  }
}

function getDiskUsagePercent(targetPath = DOWNLOAD_TEMP_DIR) {
  ensureDownloadTempDir();
  if (typeof fs.statfsSync !== "function") return 0;

  const stat = fs.statfsSync(targetPath);
  const blocks = Number(stat.blocks || 0);
  const bfree = Number(stat.bfree || 0);
  if (!blocks || blocks <= 0) return 0;

  return ((blocks - bfree) / blocks) * 100;
}

function enforceDiskLimit() {
  const used = getDiskUsagePercent(DOWNLOAD_TEMP_DIR);
  if (used >= DISK_STOP_PERCENT) {
    throw new Error(`Disk usage is too high (${used.toFixed(2)}%). Download stopped.`);
  }
}

function cleanupOldFbTemp(maxAgeMinutes = 30) {
  ensureDownloadTempDir();
  const now = Date.now();

  for (const name of fs.readdirSync(DOWNLOAD_TEMP_DIR)) {
    if (!name.startsWith("bmedia_fb_")) continue;
    const p = path.join(DOWNLOAD_TEMP_DIR, name);
    try {
      const st = fs.statSync(p);
      if (now - st.mtimeMs > maxAgeMinutes * 60 * 1000) {
        fs.rmSync(p, { force: true, recursive: true });
      }
    } catch {}
  }
}

function responseBodyToNodeReadable(body) {
  if (!body) return null;
  if (typeof body.pipe === "function") return body;
  if (typeof Readable.fromWeb === "function") return Readable.fromWeb(body);
  return null;
}

function safeToStr(value) {
  return value?.toString?.() ?? String(value ?? "");
}

function uniqueJobId() {
  return `bmedia_fb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function removeFiles(paths = []) {
  for (const p of paths) {
    if (!p) continue;
    try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
}

function selectDownloadLink(links) {
  if (!Array.isArray(links) || links.length === 0) return null;

  const valid = links.filter((item) => {
    const url = String(item?.url || "").trim();
    const format = String(item?.format || "").toLowerCase();
    return /^https?:\/\//i.test(url) && (!format || format === "mp4");
  });

  if (!valid.length) return null;

  // The API response supplied by the user currently exposes 720p (HD) and 360p (SD).
  // Prefer 720p specifically; do not blindly choose an arbitrarily huge quality.
  return (
    valid.find((item) => /720p|\(HD\)|\bHD\b/i.test(String(item?.quality || ""))) ||
    valid.find((item) => /360p|\(SD\)|\bSD\b/i.test(String(item?.quality || ""))) ||
    valid[0]
  );
}

async function downloadToFile(url, filePath) {
  enforceDiskLimit();

  const res = await safeFetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) throw new Error(`Video fetch failed: HTTP ${res.status}`);

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("text/plain") || contentType.includes("application/json")) {
    throw new Error(`Download returned non-video content (${contentType || "unknown"})`);
  }

  const stream = responseBodyToNodeReadable(res.body);
  if (!stream) throw new Error("No response body from video server");

  ensureDownloadTempDir();
  const ws = fs.createWriteStream(filePath);
  let totalBytes = 0;

  await new Promise((resolve, reject) => {
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { stream.destroy(); } catch {}
      try { ws.destroy(); } catch {}
      reject(err);
    };

    stream.on("data", (chunk) => {
      totalBytes += chunk?.length || 0;
    });

    stream.on("error", fail);
    ws.on("error", fail);
    ws.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve();
    });

    stream.pipe(ws);
  });

  if (totalBytes < MIN_VALID_BYTES) {
    throw new Error("Downloaded video is too small / invalid");
  }

  enforceDiskLimit();
  return { size: totalBytes, contentType };
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";

    p.stderr.on("data", (d) => {
      err += safeToStr(d);
      if (err.length > 12000) err = err.slice(-12000);
    });

    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`ffmpeg failed (${code}): ${err.slice(-700)}`));
    });
  });
}

async function remuxToMp4(inputPath, outputPath) {
  enforceDiskLimit();

  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-movflags", "+faststart",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath,
  ]);

  const st = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
  if (!st || st.size < MIN_VALID_BYTES) {
    throw new Error("Output MP4 not found or invalid");
  }

  enforceDiskLimit();
  return st.size;
}

export default {
  name: "fb",
  aliases: ["facebook", "fbvideo"],
  category: "DOWNLOAD",
  description: "Download Facebook video with Prexzy V2 using the same disk-based flow as YTV.",

  async execute(ctx) {
    const { sock, m, from, args, prefix } = ctx;
    const targetUrl = pickUrl(args);

    if (!targetUrl) {
      return sock.sendMessage(
        from,
        { text: `Usage: ${prefix}fb <facebook video link>` },
        { quoted: m }
      );
    }

    ensureDownloadTempDir();
    cleanupOldFbTemp(30);
    enforceDiskLimit();

    const apiUrl = `${API_BASE}?url=${encodeURIComponent(targetUrl)}`;
    const id = uniqueJobId();
    const rawPath = path.join(DOWNLOAD_TEMP_DIR, `${id}.mp4`);
    const outPath = path.join(DOWNLOAD_TEMP_DIR, `${id}_remux.mp4`);

    try {
      await sock.sendMessage(
        from,
        { text: "⏳ Processing Facebook video... please wait." },
        { quoted: m }
      );

      try { await sock.sendPresenceUpdate?.("composing", from); } catch {}

      // Small metadata response only. The actual video is never converted to a Buffer here.
      const res = await safeFetch(apiUrl, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);

      const data = await res.json().catch(() => null);
      if (!data || data.status !== true || Number(data.statusCode) !== 200) {
        throw new Error(data?.message || "Invalid Prexzy API response");
      }

      const info = data.data || {};
      const selected = selectDownloadLink(info.download_links);
      if (!selected) {
        throw new Error("No MP4 download link found in API response");
      }

      const videoUrl = String(selected.url).trim();
      const quality = String(selected.quality || "").trim();
      const title = cleanFileName(info.title || "Facebook Video");

      const meta = await downloadToFile(videoUrl, rawPath);

      const caption =
        `✅ *${title}*` +
        (quality ? `\n🎞️ Quality: ${quality}` : "") +
        `\n\n> POWERED BY BMEDIA-MD`;

      // Same first-choice send pattern as the working YTV command.
      try {
        const sent = await sock.sendMessage(
          from,
          {
            video: { url: rawPath },
            mimetype: meta.contentType && meta.contentType.startsWith("video/")
              ? meta.contentType
              : "video/mp4",
            caption,
          },
          { quoted: m }
        );

        return sent;
      } catch {
        // Same fallback idea as YTV: remux only if the original MP4 cannot be sent.
      }

      await remuxToMp4(rawPath, outPath);

      return await sock.sendMessage(
        from,
        {
          video: { url: outPath },
          mimetype: "video/mp4",
          caption,
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        {
          text:
            `❌ Facebook download unsuccessful\n` +
            `Reason: ${e?.message || e}\n\n` +
            `> POWERED BY BMEDIA-MD`,
        },
        { quoted: m }
      );
    } finally {
      try { await sock.sendPresenceUpdate?.("paused", from); } catch {}
      removeFiles([rawPath, outPath]);
      cleanupOldFbTemp(30);
    }
  },
};
