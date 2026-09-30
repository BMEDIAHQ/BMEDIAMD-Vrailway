// commands/aio3.js (ESM)

// Universal downloader for your website sources (bmediagram, bmediatok, bmediabook, etc.)

// API: https://eliteprotech-apis.zone.id/aio3?url=<link>

// Prefers video (HD if available), downloads bytes, remuxes to MP4, sends to WhatsApp.

//

// Usage: !aio3 <link>

// Aliases: anydl, alldl

//

// Requires: ffmpeg-static

import fs from "fs";

import path from "path";

import { spawn } from "child_process";

import ffmpegPath from "ffmpeg-static";

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

function pickUrl(args) {

  const s = (args || []).join(" ").trim();

  const m = s.match(/https?:\/\/\S+/i);

  return m ? m[0] : "";

}

async function fetchToBuffer(url) {

  const res = await safeFetch(url, {

    method: "GET",

    redirect: "follow",

    headers: {

      "user-agent": "Mozilla/5.0",

      "accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",

    },

  });

  if (!res.ok) throw new Error(`File fetch failed: HTTP ${res.status}`);

  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("text/html") || ct.includes("text/plain")) {

    throw new Error(`Download returned non-media content (${ct})`);

  }

  const arr = await res.arrayBuffer();

  const buf = Buffer.from(arr);

  if (buf.length < 5000) throw new Error("Downloaded file is too small / invalid");

  return buf;

}

function runFfmpeg(args) {

  return new Promise((resolve, reject) => {

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });

    let err = "";

    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {

      if (code === 0) resolve(true);

      else reject(new Error(`ffmpeg failed (${code}): ${err.slice(-700)}`));

    });

  });

}

async function remuxToMp4(inputBuf) {

  const tmpDir = path.join(process.cwd(), "temp");

  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const inPath = path.join(tmpDir, `${id}.bin`);

  const outPath = path.join(tmpDir, `${id}.mp4`);

  fs.writeFileSync(inPath, inputBuf);

  // Remux to MP4 (+faststart). Audio encoded to AAC for compatibility.

  await runFfmpeg([

    "-y",

    "-i", inPath,

    "-movflags", "+faststart",

    "-c:v", "copy",

    "-c:a", "aac",

    "-b:a", "128k",

    outPath,

  ]);

  const mp4Buf = fs.readFileSync(outPath);

  try { fs.unlinkSync(inPath); } catch {}

  try { fs.unlinkSync(outPath); } catch {}

  if (!mp4Buf || mp4Buf.length < 5000) throw new Error("Remuxed MP4 invalid");

  return mp4Buf;

}

function pickBestMedia(medias = []) {

  if (!Array.isArray(medias) || medias.length === 0) return null;

  // Keep only video-capable mp4 entries if possible

  const mp4s = medias.filter(m =>

    (m?.extension || "").toLowerCase() === "mp4" &&

    (m?.videoAvailable !== false) &&

    typeof m?.url === "string"

  );

  const list = mp4s.length ? mp4s : medias.filter(m => typeof m?.url === "string");

  if (!list.length) return null;

  // Prefer HD

  const hd = list.find(m => String(m.quality || "").toLowerCase() === "hd");

  if (hd) return hd;

  // Else prefer biggest size

  const withSize = list.filter(m => Number.isFinite(Number(m.size)));

  if (withSize.length) {

    withSize.sort((a, b) => Number(b.size) - Number(a.size));

    return withSize[0];

  }

  // Else first

  return list[0];

}

export default {

  name: "aio3",

  aliases: ["video", "alldl"],

  category: "DOWNLOAD",

  description: "Download from any BMEDIA site link (video-first).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const targetUrl = pickUrl(args);

    if (!targetUrl) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}aio3 <link>` },

        { quoted: m }

      );

    }

    const apiUrl = `https://eliteprotech-apis.zone.id/aio3?url=${encodeURIComponent(targetUrl)}`;

    try {

      await sock.sendMessage(from, { text: "⏳ Processing... please wait." }, { quoted: m });

      try { await sock.sendPresenceUpdate?.("composing", from); } catch {}

      // 1) Get JSON

      const res = await safeFetch(apiUrl, { method: "GET", headers: { accept: "application/json" } });

      if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);

      const data = await res.json().catch(() => null);

      if (!data || data.success !== true) throw new Error(data?.message || "Invalid API response");

      const title = String(data.title || "Video").trim();

      const best = pickBestMedia(data.medias);

      if (!best?.url) {

        // If no medias array, try common fields as fallback

        const fallbackUrl = data.video || data.mp4 || data.url || data.downloadURL || data.downloadUrl;

        if (!fallbackUrl) throw new Error("No downloadable media found in API response");

        const rawBuf = await fetchToBuffer(fallbackUrl);

        const mp4Buf = await remuxToMp4(rawBuf);

        const sent = await sock.sendMessage(

          from,

          { video: mp4Buf, mimetype: "video/mp4", caption: `✅ video downloaded\n${title}` },

          { quoted: m }

        );

        cleanupTemp(30);

        return sent;

      }

      // 2) Download bytes

      const rawBuf = await fetchToBuffer(best.url);

      // 3) Remux to clean MP4

      const mp4Buf = await remuxToMp4(rawBuf);

      // 4) Send

      const sent = await sock.sendMessage(

        from,

        { video: mp4Buf, mimetype: "video/mp4", caption: `✅ video downloaded\n${title}` },

        { quoted: m }

      );

      cleanupTemp(30);

      return sent;

    } catch (e) {

      return sock.sendMessage(from, { text: `❌ Failed: ${e?.message || e}` }, { quoted: m });

    } finally {

      try { await sock.sendPresenceUpdate?.("paused", from); } catch {}

      cleanupTemp(30);

    }

  },

};