// commands/aivideo2type.js (ESM)

// Endpoint: https://eliteprotech-apis.zone.id/aivideo2?q=<prompt>&type=<video|image>

// Returns ONLY file format (ext) + mime type. Does NOT display the URL.

//

// Usage:

//   !aiv2type video <prompt>

//   !aiv2type image <prompt>

// Aliases: aiformat, aivtype

async function safeFetch(url, opts) {

  if (globalThis.fetch) return fetch(url, opts);

  const mod = await import("node-fetch");

  return mod.default(url, opts);

}

function extFromMime(mime) {

  const m = String(mime || "").toLowerCase();

  if (m.includes("mp4")) return "mp4";

  if (m.includes("webm")) return "webm";

  if (m.includes("quicktime")) return "mov";

  if (m.includes("x-matroska") || m.includes("mkv")) return "mkv";

  if (m.includes("mpeg")) return "mpeg";

  if (m.includes("png")) return "png";

  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";

  if (m.includes("webp")) return "webp";

  if (m.includes("gif")) return "gif";

  if (m.includes("bmp")) return "bmp";

  return "";

}

function guessExtFromUrl(u) {

  if (!u) return "";

  const m = String(u).match(/\.([a-z0-9]{2,6})(?:\?|$)/i);

  return m?.[1]?.toLowerCase() || "";

}

async function headContentType(url) {

  try {

    const res = await safeFetch(url, { method: "HEAD" });

    const ct = res.headers?.get?.("content-type") || "";

    return { ok: res.ok, contentType: ct };

  } catch {

    return { ok: false, contentType: "" };

  }

}

function extractMediaUrl(json) {

  // Try common response shapes

  const candidates = [

    json?.url,

    json?.link,

    json?.result?.url,

    json?.result?.link,

    json?.data?.url,

    json?.data?.link,

    json?.video,

    json?.image,

    json?.result?.video,

    json?.result?.image,

    json?.data?.video,

    json?.data?.image,

  ].filter((v) => typeof v === "string" && v.startsWith("http"));

  return candidates[0] || "";

}

export default {

  name: "aiv2type",

  aliases: ["aivideo2type", "aiformat", "aivtype"],

  category: "AI",

  description: "Get AIvideo2 output file format (video/image) without showing URL.",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const type = String(args?.[0] || "").toLowerCase();

    const prompt = (args || []).slice(1).join(" ").trim();

    if (!["video", "image"].includes(type) || !prompt) {

      return sock.sendMessage(

        from,

        {

          text:

            `Usage:\n` +

            `${prefix}aiv2type video <prompt>\n` +

            `${prefix}aiv2type image <prompt>`,

        },

        { quoted: m }

      );

    }

    const endpoint = "https://eliteprotech-apis.zone.id/aivideo2";

    const apiUrl = `${endpoint}?q=${encodeURIComponent(prompt)}&type=${encodeURIComponent(type)}`;

    try {

      try { await sock.sendPresenceUpdate?.("composing", from); } catch {}

      const res = await safeFetch(apiUrl, {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ API error (${res.status}). Try again.` },

          { quoted: m }

        );

      }

      const json = await res.json().catch(() => null);

      if (!json) {

        return sock.sendMessage(from, { text: "❌ Invalid JSON response." }, { quoted: m });

      }

      const mediaUrl = extractMediaUrl(json);

      if (!mediaUrl) {

        return sock.sendMessage(

          from,

          { text: "❌ Couldn't find media URL in API response." },

          { quoted: m }

        );

      }

      // Determine mime via HEAD, then ext from mime/url

      const head = await headContentType(mediaUrl);

      const mime = (head.contentType || "").split(";")[0].trim();

      const ext = extFromMime(mime) || guessExtFromUrl(mediaUrl) || "unknown";

      const reply =

        `🧠 *AIvideo2 Output*\n` +

        `*Type:* ${type}\n` +

        `*Format:* ${ext}\n` +

        `*MIME:* ${mime || "unknown"}`;

      return sock.sendMessage(from, { text: reply }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Failed: ${e?.message || e}` },

        { quoted: m }

      );

    } finally {

      try { await sock.sendPresenceUpdate?.("paused", from); } catch {}

    }

  },

};