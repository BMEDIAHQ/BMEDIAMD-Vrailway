// commands/fdroid.js (ESM)

// Search F-Droid app via API and download the result.

// Usage:

//   <prefix>fdroid Facebook   -> search/show result

//   <prefix>fdroid 1          -> download last searched result in this chat

import fs from "fs/promises";

import path from "path";

import os from "os";

const fdroidCache = new Map(); // key: chatId -> last result

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || m?.key?.remoteJid || "";

}

function bare(jid) {

  return String(jid || "").split("@")[0].split(":")[0];

}

function humanBytes(bytes) {

  const n = Number(bytes);

  if (!Number.isFinite(n) || n <= 0) return "Unknown";

  const units = ["B", "KB", "MB", "GB"];

  let i = 0;

  let v = n;

  while (v >= 1024 && i < units.length - 1) {

    v /= 1024;

    i++;

  }

  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 2)} ${units[i]}`;

}

function safeText(s, fallback = "--/--") {

  const t = String(s ?? "").trim();

  return t || fallback;

}

function makeChatCacheKey(from, m) {

  const sender = getSender(m);

  return `${from}::${bare(sender)}`;

}

async function fetchJson(url, timeoutMs = 20000) {

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {

    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();

  } finally {

    clearTimeout(timer);

  }

}

async function downloadToTempFile(url, filenameBase = "fdroid_app", timeoutMs = 120000) {

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let tmpPath = null;

  try {

    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) throw new Error(`Download HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());

    // Try to force .apk extension

    tmpPath = path.join(os.tmpdir(), `${filenameBase}_${Date.now()}.apk`);

    await fs.writeFile(tmpPath, buf);

    return { tmpPath, size: buf.length };

  } finally {

    clearTimeout(timer);

  }

}

export default {

  name: "fdroid",

  aliases: ["fapk", "fdriod"],

  category: "DOWNLOAD",

  description: "Search F-Droid app and download it (single-result API).",

  async execute(ctx) {

    const { sock, m, from, args = [], prefix = "." } = ctx;

    try {

      const input = String(args.join(" ") || "").trim();

      if (!input) {

        return sock.sendMessage(

          from,

          {

            text:

              `❌ Provide a search query.\n\n` +

              `Example:\n` +

              `${prefix}fdroid Facebook\n` +

              `${prefix}fdroid 1`,

          },

          { quoted: m }

        );

      }

      const cacheKey = makeChatCacheKey(from, m);

      // DOWNLOAD MODE: .fdroid 1

      if (/^\d+$/.test(input)) {

        const idx = Number(input);

        if (idx !== 1) {

          return sock.sendMessage(

            from,

            { text: "❌ This F-Droid endpoint returns only *1* result.\nUse: *fdroid 1*" },

            { quoted: m }

          );

        }

        const cached = fdroidCache.get(cacheKey);

        if (!cached?.result?.apkUrl) {

          return sock.sendMessage(

            from,

            {

              text:

                `❌ No cached F-Droid result found for this chat.\n` +

                `Search first with: *${prefix}fdroid <app name>*`,

            },

            { quoted: m }

          );

        }

        const app = cached.result;

        const apkUrl = app.apkUrl;

        await sock.sendMessage(

          from,

          { text: `📥 Downloading *${safeText(app.name)}* ...` },

          { quoted: m }

        );

        let tmp = null;

        try {

          const filenameBase = safeText(app.name, "fdroid-app")

            .replace(/[^\w.-]+/g, "_")

            .slice(0, 50);

          const { tmpPath, size } = await downloadToTempFile(apkUrl, filenameBase);

          tmp = tmpPath;

          const caption =

            `✅ *F-DROID APK*\n\n` +

            `📦 *Name:* ${safeText(app.name)}\n` +

            `🧩 *Version:* ${safeText(app.version)}\n` +

            `👨‍💻 *Author:* ${safeText(app.source)}\n` +

            `📏 *Size:* ${humanBytes(size)}\n` +

            `🔗 *Source:* ${safeText(app.apkUrl)}`;

          await sock.sendMessage(

            from,

            {

              document: { url: tmpPath },

              mimetype: "application/vnd.android.package-archive",

              fileName: `${filenameBase}.apk`,

              caption,

            },

            { quoted: m }

          );

        } finally {

          if (tmp) {

            await fs.unlink(tmp).catch(() => {});

          }

        }

        return;

      }

      // SEARCH MODE: .fdroid <query>

      const query = input;

      const apiUrl = `https://eliteprotech-apis.zone.id/fdriod?q=${encodeURIComponent(query)}`;

      const data = await fetchJson(apiUrl);

      if (!data?.success || !data?.result) {

        return sock.sendMessage(

          from,

          { text: `❌ No F-Droid result found for *${query}*.` },

          { quoted: m }

        );

      }

      const app = data.result;

      if (!app?.apkUrl) {

        return sock.sendMessage(

          from,

          { text: `❌ API returned a result but no APK link was found.` },

          { quoted: m }

        );

      }

      // Cache result for ".fdroid 1"

      fdroidCache.set(cacheKey, {

        query,

        result: app,

        ts: Date.now(),

      });

      const msgText =

        `📱 *F-DROID SEARCH RESULT*\n\n` +

        `*1.* ${safeText(app.name)}\n` +

        `📝 *Summary:* ${safeText(app.summary)}\n` +

        `🧩 *Version:* ${safeText(app.version)}\n` +

        `👨‍💻 *Author / Source:* ${safeText(app.source)}\n` +

        `🌐 *Website:* ${safeText(app.website)}\n` +

        `🔗 *Download Link:* ${safeText(app.apkUrl)}\n\n` +

        `📥 Reply with *${prefix}fdroid 1* to download this APK.`;

      // Send with icon if available

      if (app.icon) {

        try {

          return await sock.sendMessage(

            from,

            {

              image: { url: app.icon },

              caption: msgText,

            },

            { quoted: m }

          );

        } catch {

          // fallback to text if icon fails

        }

      }

      return sock.sendMessage(from, { text: msgText }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ fdroid error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};