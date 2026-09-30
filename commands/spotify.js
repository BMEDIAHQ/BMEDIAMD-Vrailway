// commands/spotify.js
// Spotify downloader (mp3) via David Cyril API
// Uses the endpoint exactly as provided by the user, only replacing the Spotify URL.

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const TEMP_ROOT = path.join(process.cwd(), "temp");
const TEMP_PREFIX = "spotify-";
const STALE_MS = 15 * 60 * 1000; // 15 minutes

function sanitizeFilename(name) {
  const s = String(name || "spotify").trim() || "spotify";
  return s
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function ensureTempDir() {
  await fsp.mkdir(TEMP_ROOT, { recursive: true });
}

async function removePath(p) {
  if (!p) return;
  try {
    await fsp.rm(p, { force: true, recursive: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
}

async function cleanupStaleSpotifyTemp() {
  try {
    await ensureTempDir();
    const entries = await fsp.readdir(TEMP_ROOT, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith(TEMP_PREFIX)) continue;

      const full = path.join(TEMP_ROOT, entry.name);
      try {
        const st = await fsp.stat(full);
        const age = now - Math.max(Number(st.mtimeMs || 0), Number(st.ctimeMs || 0));
        if (age >= STALE_MS) await removePath(full);
      } catch {
        await removePath(full);
      }
    }
  } catch {}
}

function extractUrl(args) {
  const raw = String(args?.join(" ") || "").trim();
  if (!raw) return "";
  const parts = raw.split(/\s+/).filter(Boolean);
  const url = parts.find((p) => /^https?:\/\//i.test(p)) || "";
  return url.trim();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "BMEDIA-MD/SpotifyDL",
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API error: ${res.status} ${res.statusText}${txt ? ` - ${txt.slice(0, 120)}` : ""}`);
  }

  return res.json();
}

async function downloadToFile(fileUrl, filePath) {
  const res = await fetch(fileUrl, {
    method: "GET",
    headers: { "user-agent": "BMEDIA-MD/SpotifyDL" },
  });

  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const nodeStream = Readable.fromWeb(res.body);
  await pipeline(nodeStream, fs.createWriteStream(filePath));
}

export default {
  name: "spotify",
  aliases: ["spotifydl", "spdl", "sp"],
  category: "DOWNLOAD",
  description: "Download Spotify track as MP3",
  usage: "spotify <spotify track url>",

  async execute(ctx) {
    const { sock, m, from, args } = ctx;

    const spotifyUrl = extractUrl(args);
    if (!spotifyUrl) {
      return sock.sendMessage(
        from,
        {
          text:
            "❌ Provide a Spotify track link.\n\n" +
            "Example:\n" +
            "spotify https://open.spotify.com/track/....",
        },
        { quoted: m }
      );
    }

    const jobId = randomUUID();
    const workDir = path.join(TEMP_ROOT, `${TEMP_PREFIX}${jobId}`);
    const outPath = path.join(workDir, "track.mp3");

    try {
      await ensureTempDir();
      await cleanupStaleSpotifyTemp();
      await fsp.mkdir(workDir, { recursive: true });

      const endpoint =
        `https://apis.davidcyril.name.ng/spotifydl2?url=${encodeURIComponent(spotifyUrl)}&apikey=`;

      const data = await fetchJson(endpoint);

      if (!data?.success || data?.status !== 200 || !data?.results?.downloadMP3) {
        throw new Error("Failed to fetch download link from API.");
      }

      const title = String(data.results.title || "Spotify Track").trim() || "Spotify Track";
      const dlUrl = String(data.results.downloadMP3 || "").trim();

      await sock.sendMessage(from, { text: `⏳ Downloading: *${title}*` }, { quoted: m });

      await downloadToFile(dlUrl, outPath);

      const fileName = `${sanitizeFilename(title)}.mp3`;

      await sock.sendMessage(
        from,
        {
          audio: { url: outPath },
          mimetype: "audio/mpeg",
          fileName,
          ptt: false,
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: `❌ ${e?.message || e}` },
        { quoted: m }
      );
    } finally {
      await removePath(workDir);
      await cleanupStaleSpotifyTemp();

      try {
        if (typeof global.gc === "function") global.gc();
      } catch {}
    }
  },
};
