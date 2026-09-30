// commands/play.js (ESM)

//

// ✅ Safe Play: ytsearch -> ytdown(mp3) -> stream download to disk -> ffmpeg mp3 -> send

// - Low RAM (no big buffers)

// - Internal timeout (prevents server crash / command timeout)

// - ffmpeg is killable on timeout

// - Temp files deleted ONLY in finally

//

// Usage: !play <query>

// Sends: audio + caption "✅ <title>"

import fs from "fs";

import path from "path";

import { spawn } from "child_process";

import ffmpegPath from "ffmpeg-static";

// ---------------- Helpers ----------------

function ensureTempDir() {

  const dir = path.join(process.cwd(), "temp");

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return dir;

}

function cleanupTemp(maxAgeMinutes = 30) {

  const dir = path.join(process.cwd(), "temp");

  if (!fs.existsSync(dir)) return;

  const now = Date.now();

  for (const f of fs.readdirSync(dir)) {

    const p = path.join(dir, f);

    try {

      const st = fs.statSync(p);

      if (now - st.mtimeMs > maxAgeMinutes * 60 * 1000) fs.unlinkSync(p);

    } catch {}

  }

}

async function safeFetch(url, opts) {

  if (globalThis.fetch) return fetch(url, opts);

  const mod = await import("node-fetch");

  return mod.default(url, opts);

}

function cleanFileName(name) {

  return String(name || "audio")

    .replace(/[\\/:*?"<>|]/g, "")

    .replace(/\s+/g, " ")

    .trim()

    .slice(0, 80);

}

function formatBytes(bytes) {

  const n = Number(bytes || 0);

  if (!n) return "0B";

  const units = ["B", "KB", "MB", "GB"];

  let i = 0;

  let v = n;

  while (v >= 1024 && i < units.length - 1) {

    v /= 1024;

    i++;

  }

  return `${v.toFixed(i === 0 ? 0 : 2)}${units[i]}`;

}

function withTimeout(ms) {

  const controller = new AbortController();

  const t = setTimeout(() => controller.abort(new Error("TIMEOUT")), ms);

  return { controller, stop: () => clearTimeout(t) };

}

async function fetchJson(url, signal) {

  const res = await safeFetch(url, {

    method: "GET",

    headers: { accept: "application/json" },

    signal,

  });

  if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);

  const data = await res.json().catch(() => null);

  if (!data) throw new Error("Invalid JSON response");

  return data;

}

// Optional: quick HEAD check to avoid downloading gigantic files

async function headContentLength(url, signal) {

  try {

    const res = await safeFetch(url, {

      method: "HEAD",

      redirect: "follow",

      signal,

      headers: { "user-agent": "Mozilla/5.0" },

    });

    if (!res.ok) return 0;

    const len = Number(res.headers.get("content-length") || 0);

    return Number.isFinite(len) ? len : 0;

  } catch {

    return 0;

  }

}

// Stream download -> file (low RAM)

async function downloadToFile(url, outPath, signal, maxBytes = 0) {

  const res = await safeFetch(url, {

    method: "GET",

    redirect: "follow",

    signal,

    headers: {

      "user-agent": "Mozilla/5.0",

      accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",

    },

  });

  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("text/html") || ct.includes("text/plain")) {

    throw new Error(`Download returned non-audio content (${ct})`);

  }

  const ws = fs.createWriteStream(outPath);

  let written = 0;

  // WebStream (Node18 fetch)

  if (res.body && typeof res.body.getReader === "function") {

    const reader = res.body.getReader();

    try {

      while (true) {

        const { value, done } = await reader.read();

        if (done) break;

        if (!value) continue;

        const chunk = Buffer.from(value);

        written += chunk.length;

        if (maxBytes > 0 && written > maxBytes) {

          try { ws.destroy(); } catch {}

          throw new Error(`File too large (> ${formatBytes(maxBytes)})`);

        }

        ws.write(chunk);

      }

      ws.end();

    } catch (e) {

      try { ws.destroy(); } catch {}

      throw e;

    }

  } else if (res.body && typeof res.body.pipe === "function") {

    // Node stream (node-fetch)

    await new Promise((resolve, reject) => {

      res.body.on("data", (chunk) => {

        written += chunk?.length || 0;

        if (maxBytes > 0 && written > maxBytes) {

          try { res.body.destroy(); } catch {}

          try { ws.destroy(); } catch {}

          reject(new Error(`File too large (> ${formatBytes(maxBytes)})`));

        }

      });

      res.body.on("error", reject);

      ws.on("error", reject);

      ws.on("finish", resolve);

      res.body.pipe(ws);

    });

  } else {

    throw new Error("Unsupported download stream.");

  }

  const st = fs.existsSync(outPath) ? fs.statSync(outPath) : null;

  if (!st || !st.size) throw new Error("Downloaded file is empty.");

  return st.size;

}

// ffmpeg convert -> mp3 (killable)

function convertToMp3(inPath, outPath, signal) {

  return new Promise((resolve, reject) => {

    const args = [

      "-y",

      "-i", inPath,

      "-vn",

      "-c:a", "libmp3lame",

      "-b:a", "128k",

      "-ar", "44100",

      "-ac", "2",

      outPath,

    ];

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });

    let err = "";

    p.stderr.on("data", (d) => {

      err += (d?.toString?.() ?? String(d ?? ""));

    });

    const kill = () => {

      try { p.kill("SIGKILL"); } catch {}

    };

    if (signal) {

      if (signal.aborted) kill();

      signal.addEventListener("abort", kill, { once: true });

    }

    p.on("close", (code) => {

      if (signal) {

        try { signal.removeEventListener("abort", kill); } catch {}

      }

      if (code === 0) return resolve(true);

      reject(new Error(`ffmpeg failed (${code ?? "null"}): ${err.slice(-900)}`));

    });

  });

}

export default {

  name: "play",

  aliases: ["p"],

  category: "DOWNLOAD",

  description: "Search YouTube and download the first result as a clean MP3 (safe, low RAM).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const q = (args || []).join(" ").trim();

    if (!q) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}play <song name>\nExample: ${prefix}play wizkid essence` },

        { quoted: m }

      );

    }

    const tmpDir = ensureTempDir();

    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const srcPath = path.join(tmpDir, `${id}.source`);

    const mp3Path = path.join(tmpDir, `${id}.mp3`);

    let srcSize = 0;

    let mp3Size = 0;

    // ✅ Keep below your overall command timeout (often 300s)

    const INTERNAL_TIMEOUT_MS = 260_000;

    // ✅ Optional file-size cap to reduce crashes (default 25MB)

    const MAX_BYTES = Math.max(

      5 * 1024 * 1024,

      Number(process.env.PLAY_MAX_BYTES || 25 * 1024 * 1024)

    );

    const { controller, stop } = withTimeout(INTERNAL_TIMEOUT_MS);

    try {

      await sock.sendMessage(from, { text: "⏳ Searching..." }, { quoted: m });

      try { await sock.sendPresenceUpdate?.("composing", from); } catch {}

      // 1) Search and pick first result

      const searchUrl = `https://eliteprotech-apis.zone.id/ytsearch?q=${encodeURIComponent(q)}`;

      const search = await fetchJson(searchUrl, controller.signal);

      if (search.success !== true) throw new Error(search?.message || "Search failed");

      const videos = search?.results?.videos || [];

      const first = videos[0];

      if (!first?.url) {

        return sock.sendMessage(from, { text: `❌ No results for: *${q}*` }, { quoted: m });

      }

      const videoUrl = first.url;

      const title = cleanFileName(first.title || "Unknown Title");

      // 2) Get download link

      await sock.sendMessage(from, { text: "⏳ Downloading..." }, { quoted: m });

      const ytdownUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(videoUrl)}&format=mp3`;

      const down = await fetchJson(ytdownUrl, controller.signal);

      if (down.success !== true) throw new Error(down?.message || "Download API failed");

      const downloadURL = down.downloadURL || down.downloadUrl || down.url || down.link;

      if (!downloadURL || typeof downloadURL !== "string") throw new Error("No valid downloadURL");

      // 2.5) HEAD size check (best effort)

      const cl = await headContentLength(downloadURL, controller.signal);

      if (cl > 0 && cl > MAX_BYTES) {

        return sock.sendMessage(

          from,

          { text: `❌ File too large (${formatBytes(cl)}). Try a shorter audio.` },

          { quoted: m }

        );

      }

      // 3) Stream download to disk (low RAM)

      srcSize = await downloadToFile(downloadURL, srcPath, controller.signal, MAX_BYTES);

      // 4) Convert to clean mp3

      await convertToMp3(srcPath, mp3Path, controller.signal);

      if (!fs.existsSync(mp3Path)) throw new Error("MP3 was not created.");

      mp3Size = fs.statSync(mp3Path).size || 0;

      if (!mp3Size) throw new Error("MP3 created but empty.");

      // 5) Send (Baileys reads from disk)

      await sock.sendMessage(

        from,

        {

          audio: { url: mp3Path },

          mimetype: "audio/mpeg",

          ptt: false,

          fileName: `${title}.mp3`,

          caption: `✅ ${title}`,

        },

        { quoted: m }

      );

      cleanupTemp(30);

      return;

    } catch (e) {

      const msg = String(e?.message ?? e ?? "Unknown error");

      const sizeLine = `📦 Size: source: ${formatBytes(srcSize)} | mp3: ${formatBytes(mp3Size)}`;

      if (msg.includes("TIMEOUT") || controller.signal.aborted) {

        return sock.sendMessage(

          from,

          { text: `❌ download unsuccessful\nReason: timeout\n${sizeLine}` },

          { quoted: m }

        );

      }

      return sock.sendMessage(

        from,

        { text: `❌ Failed: ${msg}\n${sizeLine}` },

        { quoted: m }

      );

    } finally {

      stop();

      try { await sock.sendPresenceUpdate?.("paused", from); } catch {}

      // ✅ delete ONLY here

      try { fs.existsSync(srcPath) && fs.unlinkSync(srcPath); } catch {}

      try { fs.existsSync(mp3Path) && fs.unlinkSync(mp3Path); } catch {}

      cleanupTemp(30);

    }

  },

};