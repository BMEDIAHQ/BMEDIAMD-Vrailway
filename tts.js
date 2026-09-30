// commands/tts.js (ESM)

// ✅ Reliable WhatsApp voice note TTS: generates MP3 then converts to OGG/Opus and sends ptt.

// Deps: google-tts-api, ffmpeg-static

import fs from "fs";

import path from "path";

import { spawn } from "child_process";

import googleTTS from "google-tts-api";

import ffmpegPath from "ffmpeg-static";

async function safeFetch(url, opts) {

  if (globalThis.fetch) return fetch(url, opts);

  const mod = await import("node-fetch");

  return mod.default(url, opts);

}

async function fetchToBuffer(url) {

  const res = await safeFetch(url, {

    method: "GET",

    headers: {

      "user-agent": "Mozilla/5.0",

      "accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",

    },

    redirect: "follow",

  });

  if (!res.ok) throw new Error(`TTS fetch failed: HTTP ${res.status}`);

  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("text/html")) throw new Error("TTS returned HTML instead of audio");

  const arr = await res.arrayBuffer();

  const buf = Buffer.from(arr);

  // quick sanity check

  if (buf.length < 5000) throw new Error("TTS audio too small / invalid");

  return buf;

}

function runFfmpeg(args) {

  return new Promise((resolve, reject) => {

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });

    let err = "";

    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {

      if (code === 0) resolve(true);

      else reject(new Error(`ffmpeg failed (${code}): ${err.slice(-500)}`));

    });

  });

}

async function mp3ToOggOpus(mp3Buf) {

  const tmpDir = path.join(process.cwd(), "temp");

  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const inPath = path.join(tmpDir, `${id}.mp3`);

  const outPath = path.join(tmpDir, `${id}.ogg`);

  fs.writeFileSync(inPath, mp3Buf);

  // Convert to WhatsApp-friendly voice-note: OGG + OPUS

  // -application voip improves compatibility for WhatsApp voice notes

  await runFfmpeg([

    "-y",

    "-i", inPath,

    "-c:a", "libopus",

    "-b:a", "48k",

    "-ar", "48000",

    "-ac", "1",

    "-application", "voip",

    outPath,

  ]);

  const oggBuf = fs.readFileSync(outPath);

  // cleanup

  try { fs.unlinkSync(inPath); } catch {}

  try { fs.unlinkSync(outPath); } catch {}

  if (oggBuf.length < 5000) throw new Error("Converted audio too small / invalid");

  return oggBuf;

}

export default {

  name: "tts",

  aliases: ["say", "voice"],

  category: "TOOLS",

  description: "Convert text to speech and send as a real WhatsApp voice note (Opus).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    if (!args || args.length === 0) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}tts <text>\nExample: ${prefix}tts hello bob\nOr: ${prefix}tts fr bonjour` },

        { quoted: m }

      );

    }

    // optional language code first

    let lang = String(process.env.TTS_LANG || "en").trim();

    let textArgs = args;

    const maybeLang = String(args[0] || "").toLowerCase();

    if (/^[a-z]{2}(-[a-z]{2})?$/i.test(maybeLang) && args.length >= 2) {

      lang = maybeLang;

      textArgs = args.slice(1);

    }

    const text = textArgs.join(" ").trim();

    if (!text) return;

    const clean = text.length > 200 ? text.slice(0, 200) : text;

    const slow = String(process.env.TTS_SLOW || "0").trim() === "1";

    try {

      try { await sock.sendPresenceUpdate?.("composing", from); } catch {}

      // 1) get MP3 url

      const mp3Url = googleTTS.getAudioUrl(clean, {

        lang,

        slow,

        host: "https://translate.google.com",

      });

      // 2) download MP3 bytes

      const mp3Buf = await fetchToBuffer(mp3Url);

      // 3) convert to OGG/Opus

      const oggBuf = await mp3ToOggOpus(mp3Buf);

      // 4) send as voice note (PTT)

      return sock.sendMessage(

        from,

        {

          audio: oggBuf,

          mimetype: "audio/ogg; codecs=opus",

          ptt: true,

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ TTS failed: ${e?.message || e}` },

        { quoted: m }

      );

    } finally {

      try { await sock.sendPresenceUpdate?.("paused", from); } catch {}

    }

  },

};