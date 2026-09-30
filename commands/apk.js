// commands/apk.js (ESM)

// Search APKs and download selected result from eliteprotech APK API

//

// Usage:

//   .apk Facebook        -> search (stores up to 8 results for YOU in this chat)

//   .apk 1               -> downloads result #1 from your last search

//

// Notes:

// - Uses per-user-per-chat cache (so two people in same group won't clash)

// - Clears tmp file after sending

// - Node 18+ (fetch), works best on Node 20+

// - Sends APK as document

import fs from "fs";

import fsp from "fs/promises";

import path from "path";

import { tmpdir } from "os";

import { Readable } from "stream";

import { pipeline } from "stream/promises";

const APK_API_BASE = "https://eliteprotech-apis.zone.id/apk";

const MAX_RESULTS = 8;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

// global cache (persists while bot process is running)

const APK_CACHE = globalThis.__APK_SEARCH_CACHE__ || new Map();

globalThis.__APK_SEARCH_CACHE__ = APK_CACHE;

// ---------- helpers ----------

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || m?.key?.remoteJid || "";

}

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function tagOf(jid) {

  return `@${bare(jid)}`;

}

function cacheKey(from, sender) {

  return `${from}::${bare(sender)}`;

}

function cleanupCache() {

  const now = Date.now();

  for (const [k, v] of APK_CACHE.entries()) {

    if (!v || !v.ts || now - v.ts > CACHE_TTL_MS) APK_CACHE.delete(k);

  }

}

function formatBytes(bytes) {

  const n = Number(bytes || 0);

  if (!Number.isFinite(n) || n <= 0) return "Unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];

  let i = 0;

  let v = n;

  while (v >= 1024 && i < units.length - 1) {

    v /= 1024;

    i++;

  }

  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;

}

function formatNum(n) {

  const x = Number(n);

  if (!Number.isFinite(x)) return "Unknown";

  return x.toLocaleString();

}

function sanitizeFileName(name) {

  return String(name || "app")

    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")

    .replace(/\s+/g, "_")

    .slice(0, 90);

}

function parseIndexArg(text) {

  // allow "1", "#1", "01"

  const m = String(text || "").trim().match(/^#?(\d{1,2})$/);

  if (!m) return null;

  const n = Number(m[1]);

  return Number.isInteger(n) ? n : null;

}

function buildSearchText(query, results, sender) {

  const tag = tagOf(sender);

  let out = `📦 *APK SEARCH*\n\n`;

  out += `👤 ${tag}\n`;

  out += `🔎 Query: *${query}*\n`;

  out += `📋 Results shown: *${results.length}* (max ${MAX_RESULTS})\n`;

  out += `\nReply with *apk <number>* to download (example: *apk 1*)\n\n`;

  for (let i = 0; i < results.length; i++) {

    const r = results[i] || {};

    const dev =

      r?.developer?.name ||

      r?.file?.signature?.owner ||

      r?.store?.name ||

      "Unknown";

    const downloads =

      r?.stats?.downloads ??

      r?.stats?.pdownloads ??

      r?.store?.stats?.downloads ??

      null;

    const icon = r?.icon || "N/A";

    const link = r?.file?.path_alt || r?.file?.path || "N/A";

    const ver = r?.file?.vername || r?.file?.vercode || "Unknown";

    const size = r?.file?.filesize || r?.size || 0;

    const pkg = r?.package || "Unknown";

    const malware = r?.file?.malware?.rank || "Unknown";

    out += `*${i + 1}. ${r?.name || "Unknown App"}*\n`;

    out += `👨‍💻 Author: ${dev}\n`;

    out += `⬇️ Downloads: ${formatNum(downloads)}\n`;

    out += `📦 Package: ${pkg}\n`;

    out += `🧩 Version: ${ver}\n`;

    out += `💾 Size: ${formatBytes(size)}\n`;

    out += `🛡️ Malware: ${malware}\n`;

    out += `🖼️ Icon: ${icon}\n`;

    out += `🔗 Download: ${link}\n\n`;

  }

  return out.trim();

}

async function fetchJson(url) {

  const res = await fetch(url, {

    method: "GET",

    headers: { accept: "application/json" },

  });

  if (!res.ok) {

    throw new Error(`HTTP ${res.status}`);

  }

  return res.json();

}

async function downloadToFile(url, filePath) {

  const res = await fetch(url, {

    method: "GET",

    redirect: "follow",

    headers: {

      // Some hosts behave better with a UA

      "user-agent": "Mozilla/5.0 (Node.js WhatsApp Bot)",

      accept: "*/*",

    },

  });

  if (!res.ok) {

    throw new Error(`Download HTTP ${res.status}`);

  }

  if (!res.body) {

    throw new Error("Empty download stream");

  }

  // Stream to file (no big memory usage)

  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(filePath));

}

export default {

  name: "apk",

  aliases: ["apksearch", "aptoide"],

  category: "DOWNLOAD",

  description: "Search APKs and download selected result (apk <query> / apk <number>).",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const sender = getSender(m);

    if (!sender) return;

    cleanupCache();

    const raw = String(args.join(" ") || "").trim();

    if (!raw) {

      return sock.sendMessage(

        from,

        {

          text:

            "📦 *APK Command*\n\n" +

            "• Search: *apk Facebook*\n" +

            "• Download a result: *apk 1*",

        },

        { quoted: m }

      );

    }

    // --------- download selected result (apk 1) ---------

    const pick = parseIndexArg(raw);

    if (pick !== null) {

      const key = cacheKey(from, sender);

      const cached = APK_CACHE.get(key);

      if (!cached || !Array.isArray(cached.results) || !cached.results.length) {

        return sock.sendMessage(

          from,

          { text: "❌ No recent APK search found for you in this chat.\n\nSearch first: *apk Facebook*" },

          { quoted: m }

        );

      }

      if (Date.now() - cached.ts > CACHE_TTL_MS) {

        APK_CACHE.delete(key);

        return sock.sendMessage(

          from,

          { text: "⌛ Your APK search session expired. Please search again." },

          { quoted: m }

        );

      }

      if (pick < 1 || pick > cached.results.length) {

        return sock.sendMessage(

          from,

          { text: `❌ Invalid selection. Choose 1 to ${cached.results.length}.` },

          { quoted: m }

        );

      }

      const app = cached.results[pick - 1];

      const apkUrl = app?.file?.path_alt || app?.file?.path;

      if (!apkUrl) {

        return sock.sendMessage(

          from,

          { text: "❌ Selected app does not have a downloadable APK link." },

          { quoted: m }

        );

      }

      const appName = app?.name || "app";

      const ver = app?.file?.vername || app?.file?.vercode || "latest";

      const packageName = app?.package || "unknown.package";

      const fileName = `${sanitizeFileName(appName)}_${sanitizeFileName(String(ver))}.apk`;

      const tempPath = path.join(tmpdir(), `apk_${Date.now()}_${Math.random().toString(36).slice(2)}.apk`);

      try {

        await sock.sendMessage(

          from,

          { text: `⬇️ Downloading *${appName}*...\nPlease wait.` },

          { quoted: m }

        );

        await downloadToFile(apkUrl, tempPath);

        const caption =

          `📦 *${appName}*\n` +

          `📦 Package: ${packageName}\n` +

          `🧩 Version: ${app?.file?.vername || app?.file?.vercode || "Unknown"}\n` +

          `👨‍💻 Author: ${app?.developer?.name || "Unknown"}\n` +

          `⬇️ Downloads: ${formatNum(app?.stats?.downloads)}\n` +

          `🛡️ Malware: ${app?.file?.malware?.rank || "Unknown"}`;

        await sock.sendMessage(

          from,

          {

            document: { url: tempPath },

            fileName,

            mimetype: "application/vnd.android.package-archive",

            caption,

          },

          { quoted: m }

        );

      } catch (e) {

        return sock.sendMessage(

          from,

          { text: `❌ APK download error: ${e?.message || e}` },

          { quoted: m }

        );

      } finally {

        // clear tmp

        await fsp.unlink(tempPath).catch(() => {});

      }

      return;

    }

    // --------- search mode (apk Facebook) ---------

    const query = raw;

    try {

      const apiUrl = `${APK_API_BASE}?q=${encodeURIComponent(query)}`;

      const data = await fetchJson(apiUrl);

      if (!data?.status || !Array.isArray(data?.results)) {

        return sock.sendMessage(

          from,

          { text: "❌ APK search failed: Invalid API response." },

          { quoted: m }

        );

      }

      // Keep only real downloadable entries

      const filtered = data.results

        .filter((r) => (r?.file?.path_alt || r?.file?.path))

        .slice(0, MAX_RESULTS);

      if (!filtered.length) {

        return sock.sendMessage(

          from,

          { text: `❌ No APK results found for *${query}*.` },

          { quoted: m }

        );

      }

      // Save session for this user in this chat

      APK_CACHE.set(cacheKey(from, sender), {

        ts: Date.now(),

        query,

        results: filtered,

      });

      const text = buildSearchText(query, filtered, sender);

      return sock.sendMessage(

        from,

        {

          text,

          mentions: [sender],

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ APK search error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};